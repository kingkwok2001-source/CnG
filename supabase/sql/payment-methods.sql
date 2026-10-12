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
