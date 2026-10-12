-- Additive upgrade: no existing expense or payment is rewritten.
create table public.finance_wallets (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 80), opening_balance numeric(14,2) not null default 0 check(opening_balance>=0),
 created_at timestamptz not null default now(), unique(id,project_id), unique(project_id,name)
);
create table public.finance_wallet_entries (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete cascade,
 wallet_id uuid not null, amount numeric(14,2) not null check(amount<>0),
 payment_id uuid unique references public.payments on delete cascade,
 transfer_id uuid, title text not null, entry_date date not null default current_date,
 created_at timestamptz not null default now(),
 foreign key(wallet_id,project_id) references public.finance_wallets(id,project_id) on delete cascade
);
create table public.finance_drafts (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete cascade,
 created_by uuid not null default auth.uid() references auth.users on delete cascade,
 source text not null default 'manual' check(source in ('manual','screenshot','shortcut')),
 title text not null default '', amount numeric(14,2) check(amount>0), transaction_date date not null default current_date,
 method text not null default '', raw_text text not null default '' check(length(raw_text)<=12000),
 status text not null default 'pending' check(status in ('pending','confirmed','dismissed')),
 expense_id uuid references public.expenses on delete set null, created_at timestamptz not null default now()
);
create table public.finance_shortcut_keys (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects on delete cascade,
 user_id uuid not null default auth.uid() references auth.users on delete cascade,
 token_hash text not null unique, created_at timestamptz not null default now(), unique(project_id,user_id)
);
do $$ declare t text; begin
 foreach t in array array['finance_wallets','finance_wallet_entries','finance_drafts','finance_shortcut_keys'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create index on public.%I(project_id)',t);
 end loop;
end $$;
grant select on public.finance_wallets,public.finance_wallet_entries,public.finance_drafts to authenticated;
grant insert on public.finance_wallets,public.finance_drafts to authenticated;
create policy wallet_read on public.finance_wallets for select to authenticated using(private.project_access(project_id,false));
create policy wallet_create on public.finance_wallets for insert to authenticated with check(private.project_access(project_id,true));
create policy entries_read on public.finance_wallet_entries for select to authenticated using(private.project_access(project_id,false));
create policy draft_read on public.finance_drafts for select to authenticated using(private.project_access(project_id,false));
create policy draft_create on public.finance_drafts for insert to authenticated with check(private.project_access(project_id,true) and created_by=auth.uid() and status='pending' and expense_id is null);
create view public.finance_wallet_balances with(security_invoker=true) as
 select w.*,w.opening_balance+coalesce((select sum(e.amount) from public.finance_wallet_entries e where e.wallet_id=w.id),0) as balance from public.finance_wallets w;
grant select on public.finance_wallet_balances to authenticated;

-- Internal privileged writer owns the ledger invariants. Every entry checks the caller.
create function private.finance_money_write(p_project uuid,p_request text,p_kind text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior public.finance_write_requests; answer jsonb; w uuid; dest uuid; value numeric; balance_value numeric;
 eid uuid; payid uuid; transfer uuid; draft public.finance_drafts; dt date;
begin
 if not private.project_access(p_project,true) then raise exception '沒有編輯帳本權限'; end if;
 if p_kind not in ('expense','transfer','dismiss') or length(p_request) not between 16 and 128 then raise exception 'Invalid operation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project::text||p_request,0));
 select * into prior from public.finance_write_requests where project_id=p_project and request_id=p_request;
 if found then
  if prior.kind<>('money:'||p_kind) or prior.payload<>p_payload then raise exception '請關閉並重新開啟表格後修改'; end if;
  return prior.result;
 end if;
 if p_payload->>'draft_id' is not null then
  select * into draft from public.finance_drafts where id=(p_payload->>'draft_id')::uuid and project_id=p_project for update;
  if not found or draft.status<>'pending' then raise exception '呢筆待確認交易已處理'; end if;
 end if;
 if p_kind='dismiss' then
  if draft.id is null then raise exception 'Missing draft'; end if;
  update public.finance_drafts set status='dismissed' where id=draft.id;
  answer:=jsonb_build_object('dismissed',true);
 else
  value:=(p_payload->>'amount')::numeric; dt:=(p_payload->>'date')::date;
  if value is null or value<=0 or value::text in ('NaN','Infinity','-Infinity') or dt is null then raise exception '請輸入有效金額及日期'; end if;
  w:=nullif(p_payload->>'wallet_id','')::uuid;
  dest:=nullif(p_payload->>'destination_id','')::uuid;
  -- Deterministic locks avoid deadlocks between opposite transfers.
  perform 1 from public.finance_wallets where project_id=p_project and id in (w,dest) order by id for update;
  if w is not null then
   select opening_balance+coalesce((select sum(amount) from public.finance_wallet_entries where wallet_id=w),0) into balance_value from public.finance_wallets where id=w and project_id=p_project;
   if not found then raise exception '來源錢包不存在'; end if;
   if balance_value<value then raise exception '錢包餘額不足，請先記錄增值或轉帳'; end if;
  end if;
  if p_kind='transfer' then
   if w is null or dest is null or w=dest or not exists(select 1 from public.finance_wallets where id=dest and project_id=p_project) then raise exception '請選擇兩個不同錢包'; end if;
   transfer:=gen_random_uuid();
   insert into public.finance_wallet_entries(project_id,wallet_id,amount,transfer_id,title,entry_date) values
    (p_project,w,-value,transfer,'轉出',dt),(p_project,dest,value,transfer,'轉入／增值',dt);
   answer:=jsonb_build_object('transfer_id',transfer);
  else
   if nullif(btrim(p_payload->>'title'),'') is null then raise exception '請輸入項目'; end if;
   if nullif(p_payload->>'category_id','') is not null and not exists(select 1 from public.categories where id=(p_payload->>'category_id')::uuid and project_id=p_project and kind='expense') then raise exception '分類不屬於此帳本'; end if;
   insert into public.expenses(project_id,title,total_amount,category_id,expense_date,notes)
    values(p_project,btrim(p_payload->>'title'),value,nullif(p_payload->>'category_id','')::uuid,dt,p_payload->>'notes') returning id into eid;
   insert into public.payments(project_id,expense_id,amount,paid_at,method) values(p_project,eid,value,dt,nullif(p_payload->>'method','')) returning id into payid;
   if w is not null then insert into public.finance_wallet_entries(project_id,wallet_id,amount,payment_id,title,entry_date) values(p_project,w,-value,payid,btrim(p_payload->>'title'),dt); end if;
   if draft.id is not null then update public.finance_drafts set status='confirmed',expense_id=eid where id=draft.id; end if;
   answer:=jsonb_build_object('expense_id',eid);
  end if;
 end if;
 insert into public.finance_write_requests(project_id,request_id,user_id,kind,payload,result) values(p_project,p_request,auth.uid(),'money:'||p_kind,p_payload,answer);
 return answer;
end $$;
revoke all on function private.finance_money_write(uuid,text,text,jsonb) from public,anon;
grant execute on function private.finance_money_write(uuid,text,text,jsonb) to authenticated;
create function public.finance_money_write(p_project uuid,p_request text,p_kind text,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.finance_money_write(p_project,p_request,p_kind,p_payload); $$;
revoke all on function public.finance_money_write(uuid,text,text,jsonb) from public,anon;
grant execute on function public.finance_money_write(uuid,text,text,jsonb) to authenticated;

create function private.finance_shortcut_key(p_project uuid,p_revoke boolean)
returns text language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if not private.project_access(p_project,true) then raise exception 'Not authorized'; end if;
 delete from public.finance_shortcut_keys where project_id=p_project and user_id=auth.uid();
 if p_revoke then return null; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.finance_shortcut_keys(project_id,user_id,token_hash) values(p_project,auth.uid(),encode(extensions.digest(token,'sha256'),'hex'));
 return token;
end $$;
revoke all on function private.finance_shortcut_key(uuid,boolean) from public,anon;
grant execute on function private.finance_shortcut_key(uuid,boolean) to authenticated;
create function public.finance_shortcut_key(p_project uuid,p_revoke boolean default false)
returns text language sql security invoker set search_path='' as $$ select private.finance_shortcut_key(p_project,p_revoke); $$;
revoke all on function public.finance_shortcut_key(uuid,boolean) from public,anon;
grant execute on function public.finance_shortcut_key(uuid,boolean) to authenticated;

-- Service-only ingestion: a key can stage drafts, never read data or confirm expenses.
create function public.finance_shortcut_ingest(p_token text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare k public.finance_shortcut_keys; value numeric; result_id uuid;
begin
 select * into k from public.finance_shortcut_keys where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or not exists(select 1 from auth.users where id=k.user_id) or not exists(select 1 from public.projects p where p.id=k.project_id and p.archived_at is null and (p.owner_id=k.user_id or exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=k.user_id and m.role in ('owner','editor')))) then raise exception 'Invalid shortcut key'; end if;
 if (select count(*) from public.finance_drafts where created_by=k.user_id and source='shortcut' and created_at>now()-interval '1 day')>=100 then raise exception 'Daily limit reached'; end if;
 value:=(p_payload->>'amount')::numeric;
 if value is null or value<=0 or value>999999999 or value::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid amount'; end if;
 insert into public.finance_drafts(project_id,created_by,source,title,amount,transaction_date,method)
 values(k.project_id,k.user_id,'shortcut',left(coalesce(p_payload->>'title','待確認付款'),160),value,coalesce(nullif(p_payload->>'date','')::date,current_date),left(coalesce(p_payload->>'method','Apple Pay'),80)) returning id into result_id;
 return result_id;
end $$;
revoke all on function public.finance_shortcut_ingest(text,jsonb) from public,anon,authenticated;
grant execute on function public.finance_shortcut_ingest(text,jsonb) to service_role;
do $$ declare t text; begin
 foreach t in array array['finance_wallets','finance_wallet_entries','finance_drafts'] loop
  execute format('alter publication supabase_realtime add table public.%I',t);
 end loop;
end $$;
