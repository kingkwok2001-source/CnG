-- Existing data includes an owner row in project_members. Avoid showing that
-- owner twice and restrict invite table writes to the audited RPC.
revoke all on public.project_invites from anon, authenticated;
grant select on public.project_invites to authenticated;

create or replace function public.project_collaborators(p_project_id uuid)
returns table(user_id uuid, email text, role text)
language sql stable security definer set search_path = '' as $$
  select p.owner_id, u.email::text, 'owner'::text
  from public.projects p join auth.users u on u.id=p.owner_id
  where p.id=p_project_id and private.project_access(p_project_id,false)
  union all
  select m.user_id, u.email::text, m.role
  from public.project_members m join auth.users u on u.id=m.user_id
  where m.project_id=p_project_id and m.role <> 'owner'
    and private.project_access(p_project_id,false);
$$;
revoke all on function public.project_collaborators(uuid) from public, anon;
grant execute on function public.project_collaborators(uuid) to authenticated;
