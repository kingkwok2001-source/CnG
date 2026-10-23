-- Authenticated, disposable fixtures. Every write rolls back.
begin;
do $$ begin if to_regprocedure('public.finance_receipts_write(uuid,text,jsonb)') is null then raise exception 'Feature missing: multi-receipt writer'; end if; end $$;
select set_config('request.jwt.claim.sub',(select owner_id::text from public.projects where archived_at is null limit 1),true);
set local role authenticated;
do $$
declare p uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); eid uuid; other uuid; cat uuid:=gen_random_uuid(); first jsonb; again jsonb; payload jsonb; addition jsonb; failed boolean; count_before int; total_before numeric;
begin
 insert into public.projects(id,owner_id,name,project_type,currency) values(p,auth.uid(),'Receipt rollback test','custom','HKD'),(p2,auth.uid(),'Receipt isolation test','custom','HKD');
 insert into public.categories(id,project_id,name,kind) values(cat,p,'回禮','expense');
 payload:=jsonb_build_object('title','回禮用品','category_id',cat,'receipts',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'merchant','商店 A','amount',120,'date','2026-10-23','method','PayMe'),jsonb_build_object('id',gen_random_uuid(),'merchant','商店 B','amount',80,'date','2026-10-22','method','現金'),jsonb_build_object('id',gen_random_uuid(),'merchant','商店 C','amount',150,'date','2026-10-23','method','信用卡')));
 first:=public.finance_receipts_write(p,'receipt-batch-test-001',payload);eid:=(first->>'expense_id')::uuid;
 if (select count(*) from public.expenses where project_id=p)<>1 or (select total_amount from public.expenses where id=eid)<>350 or (select sum(amount) from public.payments where expense_id=eid)<>350 or (select count(*) from public.payments where expense_id=eid)<>3 or jsonb_array_length(first->'payments')<>3 then raise exception 'Receipts did not become one expense and three payments'; end if;
 if not exists(select 1 from public.payments where expense_id=eid and amount=80 and method='現金' and notes like '%商店 B%') then raise exception 'Merchant/method mapping lost'; end if;
 again:=public.finance_receipts_write(p,'receipt-batch-test-001',payload);
 if again<>first or (select count(*) from public.payments where expense_id=eid)<>3 then raise exception 'Retry duplicated purchases'; end if;
 addition:=jsonb_build_object('expense_id',eid,'receipts',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'merchant','商店 D','amount',.10,'date','2026-10-23'),jsonb_build_object('id',gen_random_uuid(),'amount',.20,'date','2026-10-23')));
 perform public.finance_receipts_write(p,'receipt-batch-test-002',addition);
 if (select total_amount from public.expenses where id=eid)<>350.30 or (select sum(amount) from public.payments where expense_id=eid)<>350.30 or (select count(*) from public.expenses where project_id=p)<>1 then raise exception 'Append total or precision failed'; end if;
 failed:=false;begin perform public.finance_receipts_write(p,'receipt-batch-test-001',payload||'{"title":"changed"}');exception when others then failed:=true;end;if not failed then raise exception 'Changed retry accepted';end if;
 count_before:=(select count(*) from public.payments where expense_id=eid);total_before:=(select total_amount from public.expenses where id=eid);
 failed:=false;begin perform public.finance_receipts_write(p,'receipt-batch-invalid',jsonb_build_object('expense_id',eid,'receipts',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'amount',10,'date','2026-10-23'),jsonb_build_object('id',gen_random_uuid(),'amount',-5,'date','2026-10-23'))));exception when others then failed:=true;end;
 if not failed or (select count(*) from public.payments where expense_id=eid)<>count_before or (select total_amount from public.expenses where id=eid)<>total_before then raise exception 'Invalid last receipt partially committed';end if;
 insert into public.expenses(project_id,title,total_amount) values(p2,'Other expense',100) returning id into other;
 failed:=false;begin perform public.finance_receipts_write(p,'receipt-batch-wrong-project',addition||jsonb_build_object('expense_id',other));exception when others then failed:=true;end;if not failed then raise exception 'Foreign expense accepted';end if;
 failed:=false;begin perform public.finance_receipts_write(p2,'receipt-batch-wrong-category',payload);exception when others then failed:=true;end;if not failed then raise exception 'Foreign category accepted';end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 failed:=false;begin perform public.finance_receipts_write(p,'receipt-batch-outsider',addition);exception when others then failed:=true;end;if not failed then raise exception 'Outsider write accepted';end if;
end $$;
rollback;
select 'PASS: one expense, receipts, append, exact cents, retry, atomic failure and isolation' result;
