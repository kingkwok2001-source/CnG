alter table public.finance_drafts add column source_request_id uuid;
create unique index finance_draft_shortcut_request on public.finance_drafts(project_id,source_request_id) where source_request_id is not null;
create policy shortcut_keys_no_client on public.finance_shortcut_keys to authenticated using(false) with check(false);
create or replace function public.finance_shortcut_ingest(p_token text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare k public.finance_shortcut_keys; value numeric; result_id uuid; request_id uuid; prior public.finance_drafts; dt date; title_value text; method_value text;
begin
 select * into k from public.finance_shortcut_keys where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or not exists(select 1 from auth.users where id=k.user_id) or not exists(select 1 from public.projects p where p.id=k.project_id and p.archived_at is null and (p.owner_id=k.user_id or exists(select 1 from public.project_members m where m.project_id=p.id and m.user_id=k.user_id and m.role in ('owner','editor')))) then raise exception 'Invalid shortcut key'; end if;
 perform pg_advisory_xact_lock(hashtextextended('shortcut:'||k.user_id::text,0));
 request_id:=nullif(p_payload->>'request_id','')::uuid;
 value:=(p_payload->>'amount')::numeric;dt:=coalesce(nullif(p_payload->>'date','')::date,current_date);
 title_value:=left(coalesce(p_payload->>'title','待確認付款'),160);method_value:=left(coalesce(p_payload->>'method','Apple Pay'),80);
 if value is null or value<=0 or value>999999999 or value::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid amount'; end if;
 if request_id is not null then
  select * into prior from public.finance_drafts where project_id=k.project_id and source_request_id=request_id;
  if found then
   if prior.created_by<>k.user_id or prior.amount<>value or prior.title<>title_value or prior.transaction_date<>dt or prior.method<>method_value then raise exception 'Request already used'; end if;
   return prior.id;
  end if;
 end if;
 if (select count(*) from public.finance_drafts where created_by=k.user_id and source='shortcut' and created_at>now()-interval '1 day')>=100 then raise exception 'Daily limit reached'; end if;
 insert into public.finance_drafts(project_id,created_by,source,title,amount,transaction_date,method,source_request_id)
 values(k.project_id,k.user_id,'shortcut',title_value,value,dt,method_value,request_id) returning id into result_id;
 return result_id;
end $$;
