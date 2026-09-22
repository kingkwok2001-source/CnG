-- Keep existing projects and finance rows intact. Add reusable invite codes and
-- scoped access for authenticated collaborators.
create schema if not exists private;

create or replace function private.project_access(p_project_id uuid, p_edit boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    exists (select 1 from public.projects p where p.id = p_project_id and p.owner_id = (select auth.uid()))
    or exists (select 1 from public.project_members m where m.project_id = p_project_id
      and m.user_id = (select auth.uid()) and (not p_edit or m.role in ('editor','owner')))
  );
$$;
revoke all on function private.project_access(uuid, boolean) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.project_access(uuid, boolean) to authenticated;

create policy projects_member_read on public.projects for select to authenticated
using (private.project_access(id, false));
create policy members_read_project on public.project_members for select to authenticated
using (private.project_access(project_id, false));

create policy categories_member_read on public.categories for select to authenticated
using (private.project_access(project_id, false));
create policy categories_editor_insert on public.categories for insert to authenticated
with check (private.project_access(project_id, true));
create policy categories_editor_update on public.categories for update to authenticated
using (private.project_access(project_id, true)) with check (private.project_access(project_id, true));

create policy expenses_member_read on public.expenses for select to authenticated
using (private.project_access(project_id, false));
create policy expenses_editor_insert on public.expenses for insert to authenticated
with check (private.project_access(project_id, true));
create policy expenses_editor_update on public.expenses for update to authenticated
using (private.project_access(project_id, true)) with check (private.project_access(project_id, true));

create policy payments_member_read on public.payments for select to authenticated
using (private.project_access(project_id, false));
create policy payments_editor_insert on public.payments for insert to authenticated
with check (private.project_access(project_id, true) and exists
  (select 1 from public.expenses e where e.id = expense_id and e.project_id = payments.project_id));

create policy incomes_member_read on public.incomes for select to authenticated
using (private.project_access(project_id, false));
create policy incomes_editor_insert on public.incomes for insert to authenticated
with check (private.project_access(project_id, true));
create policy incomes_editor_update on public.incomes for update to authenticated
using (private.project_access(project_id, true)) with check (private.project_access(project_id, true));

create policy attachments_member_read on public.attachments for select to authenticated
using (private.project_access(project_id, false));
create policy attachments_editor_insert on public.attachments for insert to authenticated
with check (private.project_access(project_id, true));

-- Views are invoker-secured so finance totals follow the underlying RLS.
alter view public.expense_financials set (security_invoker = true);

create table public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  code text not null unique check (code ~ '^[A-F0-9]{16}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.project_invites enable row level security;
grant select on public.project_invites to authenticated;
create policy invites_owner_read on public.project_invites for select to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));

create or replace function public.get_project_invite(p_project_id uuid, p_rotate boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if (select auth.uid()) is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then
    raise exception 'Please sign in to manage invitations';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id and owner_id = (select auth.uid())) then
    raise exception 'Only the owner can manage invitation codes';
  end if;
  select code into v_code from public.project_invites where project_id = p_project_id;
  if v_code is not null and not p_rotate then return v_code; end if;
  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  insert into public.project_invites(project_id,code,created_by)
  values (p_project_id,v_code,(select auth.uid()))
  on conflict (project_id) do update set code=excluded.code, created_by=excluded.created_by, created_at=now();
  return v_code;
end;
$$;
revoke all on function public.get_project_invite(uuid,boolean) from public, anon;
grant execute on function public.get_project_invite(uuid,boolean) to authenticated;

create or replace function public.join_project_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_project_id uuid;
begin
  if (select auth.uid()) is null or coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false) then
    raise exception 'Please sign in to join a project';
  end if;
  select i.project_id into v_project_id from public.project_invites i
  join public.projects p on p.id=i.project_id
  where i.code=upper(trim(p_code)) and p.archived_at is null;
  if v_project_id is null then raise exception 'Invalid invitation code'; end if;
  if exists (select 1 from public.projects where id=v_project_id and owner_id=(select auth.uid())) then
    return v_project_id;
  end if;
  insert into public.project_members(project_id,user_id,role)
  values(v_project_id,(select auth.uid()),'editor')
  on conflict(project_id,user_id) do nothing;
  return v_project_id;
end;
$$;
revoke all on function public.join_project_by_code(text) from public, anon;
grant execute on function public.join_project_by_code(text) to authenticated;

create or replace function public.project_collaborators(p_project_id uuid)
returns table(user_id uuid, email text, role text)
language sql stable security definer set search_path = '' as $$
  select p.owner_id, u.email::text, 'owner'::text
  from public.projects p join auth.users u on u.id=p.owner_id
  where p.id=p_project_id and private.project_access(p_project_id,false)
  union all
  select m.user_id, u.email::text, m.role
  from public.project_members m join auth.users u on u.id=m.user_id
  where m.project_id=p_project_id and private.project_access(p_project_id,false);
$$;
revoke all on function public.project_collaborators(uuid) from public, anon;
grant execute on function public.project_collaborators(uuid) to authenticated;
