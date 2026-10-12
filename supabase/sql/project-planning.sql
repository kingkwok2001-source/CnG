alter table public.projects
 add column budget numeric(14,2) check(budget>=0),
 add column event_date date,
 add column monthly_deposit numeric(14,2) not null default 0 check(monthly_deposit>=0),
 add column monthly_limit numeric(14,2) not null default 0 check(monthly_limit>=0);
