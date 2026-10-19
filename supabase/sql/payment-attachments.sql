create or replace function public.finance_write(p_project uuid,p_request text,p_kind text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare prior public.finance_write_requests; r jsonb; eid uuid; cid uuid; payment_uuid uuid;
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
   insert into public.payments(project_id,expense_id,amount,paid_at,method,notes)
   values(p_project,eid,amount_value,(p_payload->>'paid_at')::date,p_payload->>'method',nullif(btrim(p_payload->>'notes'),'')) returning id into payment_uuid;
   answer:=jsonb_build_object('expense_id',eid,'payment_id',payment_uuid);
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
       values(p_project,eid,paid_value,(r->>'expense_date')::date,coalesce(nullif(r->>'method',''),case when p_kind='csv' then 'CSV 匯入' else null end));
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

-- Reuse attachments and its existing exactly-one-parent/composite FK checks.
-- No payment_attachments table. New payment paths are checked before upload.
create or replace function private.finance_payment_upload_allowed(path text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.finance_storage_access(path,true) and
  (split_part(path,'/',2)<>'payments' or exists(
   select 1 from public.payments p join public.expenses e on e.id=p.expense_id and e.project_id=p.project_id
   where p.id::text=split_part(path,'/',3) and p.project_id::text=split_part(path,'/',1) and e.deleted_at is null
  ));
$$;
revoke all on function private.finance_payment_upload_allowed(text) from public,anon;
grant execute on function private.finance_payment_upload_allowed(text) to authenticated;
alter policy members_add_finance_files on storage.objects
 with check(bucket_id='finance-attachments' and private.finance_payment_upload_allowed(name));

create table private.finance_file_cleanup (
 storage_path text primary key,
 queued_at timestamptz not null default now()
);
alter table private.finance_file_cleanup enable row level security;
revoke all on private.finance_file_cleanup from public,anon,authenticated;

create or replace function private.finance_attachment_path()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.payment_id is not null then
  if new.storage_path not like new.project_id::text||'/payments/'||new.payment_id::text||'/'||new.id::text||'.%'
   or new.mime_type not in ('image/jpeg','image/png','image/webp','application/pdf') then
   raise exception 'Invalid payment attachment path or type';
  end if;
  -- A finalization window shorter than the orphan GC grace prevents a stale
  -- uploader attaching a file already selected by the background cleaner.
  if not exists(select 1 from storage.objects where bucket_id='finance-attachments'
     and name=new.storage_path and created_at>now()-interval '30 minutes') then
   raise exception 'Upload missing or expired; please retry the attachment';
  end if;
 end if;
 return new;
end; $$;
create trigger finance_attachment_path before insert or update on public.attachments
 for each row execute function private.finance_attachment_path();
create unique index attachments_storage_path_unique on public.attachments(storage_path);

create or replace function private.finance_queue_attachment_file()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or old.storage_path is distinct from new.storage_path then
  insert into private.finance_file_cleanup(storage_path) values(old.storage_path) on conflict do nothing;
 end if;
 return null;
end; $$;
create trigger finance_queue_attachment_file after delete or update of storage_path on public.attachments
 for each row execute function private.finance_queue_attachment_file();

-- Existing authenticated scheduled worker calls this and deletes through the
-- Storage API. Cascades, closed tabs and lost responses are retried durably.
create or replace function public.finance_cleanup_batch()
returns table(bucket text,path text) language plpgsql security definer set search_path='' as $$
begin
 delete from private.finance_file_cleanup q where q.queued_at<now()-interval '1 hour'
  and not exists(select 1 from storage.objects o where o.bucket_id='finance-attachments' and o.name=q.storage_path);
 return query
 select o.bucket_id,o.name from storage.objects o
 where o.bucket_id='finance-attachments'
 and not exists(select 1 from public.attachments a where a.storage_path=o.name)
 and (
  exists(select 1 from private.finance_deleted_projects d where d.project_id::text=split_part(o.name,'/',1))
  or exists(select 1 from private.finance_file_cleanup q where q.storage_path=o.name)
  or (split_part(o.name,'/',2)='payments' and o.created_at<now()-interval '1 hour')
 )
 order by o.created_at,o.name limit 100;
end; $$;
revoke all on function public.finance_cleanup_batch() from public,anon,authenticated;
grant execute on function public.finance_cleanup_batch() to service_role;

