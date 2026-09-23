-- Complete the existing Project Finance data model without replacing any data.

-- Editors can correct payment mistakes and remove uploaded attachment records.
create policy payments_editor_delete on public.payments for delete to authenticated
using (private.project_access(project_id, true));

create policy attachments_editor_delete on public.attachments for delete to authenticated
using (private.project_access(project_id, true));

-- Keep an audit trail for the records collaborators can change.
create or replace function private.log_finance_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid := coalesce(new.project_id, old.project_id);
  v_entity_id uuid := coalesce(new.id, old.id);
  v_action text;
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_changes := jsonb_build_object('new', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    v_changes := jsonb_build_object('old', to_jsonb(old));
  else
    v_action := case
      when tg_table_name in ('expenses','incomes') and old.deleted_at is null and new.deleted_at is not null then 'deleted'
      when tg_table_name in ('expenses','incomes') and old.deleted_at is not null and new.deleted_at is null then 'restored'
      else 'updated'
    end;
    v_changes := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  end if;

  insert into public.activity_logs(project_id,user_id,entity_type,entity_id,action,changed_fields)
  values (v_project_id,(select auth.uid()),tg_table_name,v_entity_id,v_action,v_changes);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.log_finance_activity() from public, anon, authenticated;

create trigger expenses_activity after insert or update or delete on public.expenses
for each row execute function private.log_finance_activity();
create trigger payments_activity after insert or update or delete on public.payments
for each row execute function private.log_finance_activity();
create trigger incomes_activity after insert or update or delete on public.incomes
for each row execute function private.log_finance_activity();

-- A collaborator can leave a shared project without gaining access to other rows.
create or replace function public.leave_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Please sign in';
  end if;
  if exists (select 1 from public.projects where id=p_project_id and owner_id=(select auth.uid())) then
    raise exception 'The owner cannot leave their own project';
  end if;
  delete from public.project_members
  where project_id=p_project_id and user_id=(select auth.uid());
end;
$$;
revoke all on function public.leave_project(uuid) from public, anon;
grant execute on function public.leave_project(uuid) to authenticated;

-- Index the filters used by the app, RLS checks and activity screen.
create index if not exists expenses_project_active_idx on public.expenses(project_id, created_at desc) where deleted_at is null;
create index if not exists incomes_project_active_idx on public.incomes(project_id, income_date desc) where deleted_at is null;
create index if not exists payments_expense_idx on public.payments(expense_id, created_at desc);
create index if not exists activity_logs_project_created_idx on public.activity_logs(project_id, created_at desc);
create index if not exists attachments_expense_idx on public.attachments(expense_id, created_at desc);
