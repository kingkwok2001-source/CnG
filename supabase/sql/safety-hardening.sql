-- RLS remains authoritative for all client write RPCs.
create or replace function private.finance_storage_access(path text, editing boolean)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.projects p where p.id::text = split_part(path,'/',1)
   and private.project_access(p.id, editing));
$$;
revoke all on function private.finance_storage_access(text,boolean) from public, anon;
grant execute on function private.finance_storage_access(text,boolean) to authenticated;
drop policy if exists members_add_finance_files on storage.objects;
drop policy if exists members_read_finance_files on storage.objects;
drop policy if exists members_remove_finance_files on storage.objects;
create policy members_add_finance_files on storage.objects for insert to authenticated
 with check(bucket_id='finance-attachments' and private.finance_storage_access(name,true));
create policy members_read_finance_files on storage.objects for select to authenticated
 using(bucket_id='finance-attachments' and private.finance_storage_access(name,false));
create policy members_remove_finance_files on storage.objects for delete to authenticated
 using(bucket_id='finance-attachments' and private.finance_storage_access(name,true));

-- Enforce parent/project consistency independently of the permissive owner policies.
alter table public.expenses add constraint expenses_id_project_unique unique(id,project_id);
alter table public.categories add constraint categories_id_project_unique unique(id,project_id);
alter table public.payments add constraint payments_id_project_unique unique(id,project_id);
alter table public.incomes add constraint incomes_id_project_unique unique(id,project_id);
alter table public.payments add constraint payments_expense_project_fk
 foreign key(expense_id,project_id) references public.expenses(id,project_id) on delete cascade;
alter table public.expenses add constraint expenses_category_project_fk
 foreign key(category_id,project_id) references public.categories(id,project_id);
alter table public.attachments add constraint attachments_expense_project_fk
 foreign key(expense_id,project_id) references public.expenses(id,project_id) on delete cascade;
alter table public.attachments add constraint attachments_payment_project_fk
 foreign key(payment_id,project_id) references public.payments(id,project_id) on delete cascade;
alter table public.attachments add constraint attachments_income_project_fk
 foreign key(income_id,project_id) references public.incomes(id,project_id) on delete cascade;

create or replace function private.finance_parent_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.project_id is distinct from old.project_id then
   raise exception 'Moving records between projects is not allowed';
 end if;
 return new;
end; $$;
do $$ declare t text; begin
 foreach t in array array['categories','expenses','payments','incomes','attachments'] loop
   execute format('create trigger finance_parent_immutable before update on public.%I for each row execute function private.finance_parent_immutable()',t);
 end loop;
end $$;

-- One audit event per change. Parent cascade deletes must not recreate child rows.
drop trigger if exists expenses_activity on public.expenses;
drop trigger if exists payments_activity on public.payments;
drop trigger if exists incomes_activity on public.incomes;
create or replace function private.finance_audit_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb; pid uuid; action_name text;
begin
 r := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 pid := (r->>'project_id')::uuid;
 if exists(select 1 from public.projects where id=pid) then
   action_name := case tg_op when 'INSERT' then 'created' when 'DELETE' then 'deleted' else 'updated' end;
   if tg_op='UPDATE' and r ? 'deleted_at' then
     if old.deleted_at is null and new.deleted_at is not null then action_name:='deleted';
     elsif old.deleted_at is not null and new.deleted_at is null then action_name:='restored'; end if;
   end if;
   insert into public.activity_logs(project_id,user_id,entity_type,entity_id,action,changed_fields)
   values(pid,auth.uid(),tg_table_name,(r->>'id')::uuid,action_name,
     case when tg_op='UPDATE' then jsonb_build_object('before',to_jsonb(old),'after',r) else r end);
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;

create table public.finance_write_requests (
 project_id uuid not null references public.projects(id) on delete cascade,
 request_id text not null check(length(request_id) between 16 and 128),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null,
 payload jsonb not null,
 result jsonb,
 created_at timestamptz not null default now(),
 primary key(project_id,request_id)
);
alter table public.finance_write_requests enable row level security;
grant select,insert,update on public.finance_write_requests to authenticated;
create policy request_read on public.finance_write_requests for select to authenticated
 using(private.project_access(project_id,true));
create policy request_insert on public.finance_write_requests for insert to authenticated
 with check(user_id=auth.uid() and private.project_access(project_id,true));
create policy request_update on public.finance_write_requests for update to authenticated
 using(user_id=auth.uid() and private.project_access(project_id,true))
 with check(user_id=auth.uid() and private.project_access(project_id,true));

-- The request receipt and every write commit/roll back together. Retries return
-- the original result, even when the browser lost the first response.
create or replace function public.finance_write(p_project uuid,p_request text,p_kind text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare prior public.finance_write_requests; r jsonb; eid uuid; cid uuid;
 amount_value numeric; paid_value numeric; answer jsonb; n integer:=0;
begin
 if auth.uid() is null or not private.project_access(p_project,true) then raise exception 'Not authorized'; end if;
 if p_kind not in ('expense','payment','csv') then raise exception 'Invalid operation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project::text||p_request,0));
 select * into prior from public.finance_write_requests where project_id=p_project and request_id=p_request;
 if found then
   if prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'This request was already saved. Close and reopen before editing.'; end if;
   return prior.result;
 end if;
 insert into public.finance_write_requests(project_id,request_id,kind,payload) values(p_project,p_request,p_kind,p_payload);
 if p_kind='payment' then
   eid:=(p_payload->>'expense_id')::uuid;
   perform 1 from public.expenses where id=eid and project_id=p_project and deleted_at is null for update;
   if not found then raise exception 'Expense unavailable'; end if;
   amount_value:=(p_payload->>'amount')::numeric;
   if amount_value is null or amount_value<=0 or amount_value::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid payment amount'; end if;
   insert into public.payments(project_id,expense_id,amount,paid_at,method)
   values(p_project,eid,amount_value,(p_payload->>'paid_at')::date,p_payload->>'method');
   answer:=jsonb_build_object('expense_id',eid);
 else
   if p_kind='csv' and (jsonb_typeof(p_payload)<>'array' or jsonb_array_length(p_payload) not between 1 and 1000) then raise exception 'Import requires 1–1000 rows'; end if;
   for r in select value from jsonb_array_elements(case when p_kind='csv' then p_payload else jsonb_build_array(p_payload) end) loop
     amount_value:=(r->>'total_amount')::numeric; paid_value:=coalesce((r->>'paid')::numeric,0);
     if nullif(btrim(r->>'title'),'') is null or amount_value is null or amount_value<=0
       or amount_value::text in ('NaN','Infinity','-Infinity') or paid_value::text in ('NaN','Infinity','-Infinity')
       or paid_value<0 or paid_value>amount_value then raise exception 'Invalid expense or payment'; end if;
     if p_kind='csv' then
       select id into cid from public.categories where project_id=p_project and name=coalesce(nullif(r->>'category',''),'其他') and kind='expense' order by created_at limit 1;
       if cid is null then
         insert into public.categories(project_id,name,kind) values(p_project,coalesce(nullif(r->>'category',''),'其他'),'expense') returning id into cid;
       end if;
     else cid:=nullif(r->>'category_id','')::uuid; end if;
     insert into public.expenses(project_id,title,total_amount,category_id,expense_date,due_date,responsible_person,notes)
       values(p_project,btrim(r->>'title'),amount_value,cid,(r->>'expense_date')::date,nullif(r->>'due_date','')::date,r->>'responsible_person',r->>'notes') returning id into eid;
     if paid_value>0 then
       insert into public.payments(project_id,expense_id,amount,paid_at,method)
       values(p_project,eid,paid_value,(r->>'expense_date')::date,case when p_kind='csv' then 'CSV 匯入' else null end);
     end if;
     n:=n+1;
   end loop;
   answer:=jsonb_build_object('expense_id',eid,'count',n);
 end if;
 update public.finance_write_requests set result=answer where project_id=p_project and request_id=p_request;
 return answer;
end; $$;
revoke all on function public.finance_write(uuid,text,text,jsonb) from public,anon;
grant execute on function public.finance_write(uuid,text,text,jsonb) to authenticated;

do $$ declare t text; begin
 foreach t in array array['projects','categories','expenses','payments','incomes','attachments','project_members'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
     execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
 end loop;
end $$;
