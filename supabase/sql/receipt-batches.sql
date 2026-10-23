-- Additive purchase batching. Existing expense, payment and attachment rows stay intact.
create or replace function public.finance_receipts_write(p_project uuid,p_request text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior public.finance_write_requests; rows jsonb; r jsonb; eid uuid; cid uuid; pid uuid;
 value numeric; total numeric:=0; dt date; first_date date; answer jsonb; results jsonb:='[]'::jsonb;
begin
 if auth.uid() is null or not private.project_access(p_project,true) then raise exception '沒有編輯帳本權限'; end if;
 if length(p_request) not between 16 and 128 or p_request is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid purchase request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project::text||p_request,0));
 select * into prior from public.finance_write_requests where project_id=p_project and request_id=p_request;
 if found then
  if prior.kind<>'receipts' or prior.payload<>p_payload then raise exception '呢批單已儲存；請重新開啟後再加新單'; end if;
  return prior.result;
 end if;
 rows:=p_payload->'receipts';
 if jsonb_typeof(rows) is distinct from 'array' then raise exception '請加入購買單'; end if;
 if jsonb_array_length(rows) not between 1 and 20 then raise exception '每次可加入 1–20 張單'; end if;
 if (select count(distinct (x->>'id')::uuid) from jsonb_array_elements(rows) x)<>jsonb_array_length(rows) then raise exception '購買單 ID 不可重複'; end if;
 for r in select entry.value from jsonb_array_elements(rows) entry loop
  value:=(r->>'amount')::numeric;
  if value is null or value<=0 or value>999999999 or value::text in ('NaN','Infinity','-Infinity') or value<>round(value,2) then raise exception '請核對每張單嘅金額（最多兩位小數）'; end if;
  if (r->>'date') is null or (r->>'date')!~'^\d{4}-\d{2}-\d{2}$' then raise exception '請核對每張單嘅日期'; end if;
  dt:=(r->>'date')::date;first_date:=least(first_date,dt);total:=total+value;
 end loop;
 if total>999999999 then raise exception '合計金額過大'; end if;
 eid:=nullif(p_payload->>'expense_id','')::uuid;
 if eid is not null then
  perform 1 from public.expenses where id=eid and project_id=p_project and deleted_at is null for update;
  if not found then raise exception '原有項目已不存在或不屬於此帳本'; end if;
  update public.expenses set total_amount=total_amount+total where id=eid and project_id=p_project;
 else
  if nullif(btrim(p_payload->>'title'),'') is null then raise exception '請輸入合併項目名稱'; end if;
  cid:=nullif(p_payload->>'category_id','')::uuid;
  if cid is not null and not exists(select 1 from public.categories where id=cid and project_id=p_project and kind='expense') then raise exception '分類不屬於此帳本'; end if;
  insert into public.expenses(project_id,title,total_amount,category_id,expense_date)
   values(p_project,left(btrim(p_payload->>'title'),160),total,cid,first_date) returning id into eid;
 end if;
 for r in select entry.value from jsonb_array_elements(rows) entry loop
  insert into public.payments(project_id,expense_id,amount,paid_at,method,notes)
   values(p_project,eid,(r->>'amount')::numeric,(r->>'date')::date,nullif(left(r->>'method',80),''),
    '購買單'||case when nullif(btrim(r->>'merchant'),'') is not null then ' · '||left(btrim(r->>'merchant'),160) else '' end)
   returning id into pid;
  results:=results||jsonb_build_array(jsonb_build_object('receipt_id',r->>'id','payment_id',pid));
 end loop;
 answer:=jsonb_build_object('expense_id',eid,'payments',results,'added_total',total);
 insert into public.finance_write_requests(project_id,request_id,user_id,kind,payload,result)
  values(p_project,p_request,auth.uid(),'receipts',p_payload,answer);
 return answer;
end $$;
revoke all on function public.finance_receipts_write(uuid,text,jsonb) from public,anon;
grant execute on function public.finance_receipts_write(uuid,text,jsonb) to authenticated;
