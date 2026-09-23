-- Cover the remaining foreign keys reported by the database advisor.
create index if not exists activity_logs_user_idx on public.activity_logs(user_id);
create index if not exists attachments_income_idx on public.attachments(income_id);
create index if not exists attachments_payment_idx on public.attachments(payment_id);
create index if not exists expenses_category_idx on public.expenses(category_id);
create index if not exists incomes_category_idx on public.incomes(category_id);
create index if not exists project_invites_created_by_idx on public.project_invites(created_by);
create index if not exists projects_owner_idx on public.projects(owner_id);
