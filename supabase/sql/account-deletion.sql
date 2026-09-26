-- User/database deletion is atomic. Storage cleanup is an idempotent outbox.
-- No storage metadata is deleted directly. Shared projects keep their files.
create table private.finance_deleted_projects (
 project_id uuid primary key,
 created_at timestamptz not null default now()
);
do $$ begin
 perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'finance_cleanup_token');
end $$;
revoke all on private.finance_deleted_projects from public,anon,authenticated;

create or replace function public.finish_finance_account_deletion(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from auth.users where id=p_user for update;
 if not found then return; end if;
 -- Lock owned projects before taking the file inventory.
 perform 1 from public.projects where owner_id=p_user for update;
 insert into private.finance_deleted_projects(project_id)
 select id from public.projects where owner_id=p_user
 on conflict do nothing;
 delete from public.project_invites where created_by=p_user;
 delete from auth.users where id=p_user;
end; $$;
revoke all on function public.finish_finance_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.finish_finance_account_deletion(uuid) to service_role;

create or replace function public.finance_cleanup_authorized(p_token text)
returns boolean language sql security definer set search_path = '' as $$
 select exists(select 1 from vault.decrypted_secrets where name='finance_cleanup_token' and decrypted_secret=p_token);
$$;
create or replace function public.finance_cleanup_batch()
returns table(bucket text,path text) language sql security definer set search_path = '' as $$
 select o.bucket_id,o.name from storage.objects o
 join private.finance_deleted_projects d on d.project_id::text=split_part(o.name,'/',1)
 where o.bucket_id='finance-attachments' order by d.created_at,o.name limit 100;
$$;
revoke all on function public.finance_cleanup_authorized(text),public.finance_cleanup_batch() from public,anon,authenticated;
grant execute on function public.finance_cleanup_authorized(text),public.finance_cleanup_batch() to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('finance-deleted-account-files','*/10 * * * *',
 $job$select net.http_post(
   url:='https://viulxubgtgruvvbxetsd.supabase.co/functions/v1/delete-account',
   headers:=jsonb_build_object('Content-Type','application/json','x-cleanup-token',(select decrypted_secret from vault.decrypted_secrets where name='finance_cleanup_token')),
   body:='{"action":"cleanup"}'::jsonb,
   timeout_milliseconds:=30000
 );$job$);
