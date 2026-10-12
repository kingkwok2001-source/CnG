begin;
select set_config('request.jwt.claim.sub',(select owner_id::text from public.projects limit 1),true);
set local role authenticated;
do $$ declare p uuid:=gen_random_uuid(); k text; d uuid; begin
 insert into public.projects(id,owner_id,name,project_type,currency) values(p,auth.uid(),'Shortcut rollback','daily','HKD');
 k:=public.finance_shortcut_key(p,false);
 if length(k)<>64 then raise exception 'Invalid key'; end if;
 -- The ingestion function is deliberately not callable by an authenticated client.
 begin perform public.finance_shortcut_ingest(k,'{"amount":128}'::jsonb);raise exception 'Client ingestion allowed';exception when insufficient_privilege then null; end;
 perform public.finance_shortcut_key(p,true);
end $$;
rollback;
