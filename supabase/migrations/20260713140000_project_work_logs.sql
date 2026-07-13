-- Project enrichment + cafe daily wage work logs + supervisor helpers.

alter table public.projects
  add column if not exists description text,
  add column if not exists goal_minor bigint,
  add column if not exists color_token text not null default 'primary';

alter table public.projects
  drop constraint if exists projects_description_length;

alter table public.projects
  add constraint projects_description_length
    check (description is null or char_length(description) <= 500);

alter table public.projects
  drop constraint if exists projects_goal_minor_nonnegative;

alter table public.projects
  add constraint projects_goal_minor_nonnegative
    check (goal_minor is null or goal_minor >= 0);

alter table public.projects
  drop constraint if exists projects_color_token_format;

alter table public.projects
  add constraint projects_color_token_format
    check (color_token in ('primary', 'success', 'warning', 'danger', 'info'));

create type public.work_log_entry_type as enum (
  'daily_wage',
  'bonus',
  'deduction',
  'withdrawal',
  'adjustment'
);

create type public.worker_status as enum ('active', 'inactive');

create table public.project_workers (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  name text not null,
  phone text,
  daily_wage_minor bigint not null default 0,
  status public.worker_status not null default 'active',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint project_workers_workspace_id_id unique (workspace_id, id),
  constraint project_workers_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_workers_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint project_workers_name_length
    check (char_length(btrim(name)) between 1 and 120),
  constraint project_workers_phone_length
    check (phone is null or char_length(btrim(phone)) between 6 and 30),
  constraint project_workers_daily_wage_nonnegative
    check (daily_wage_minor >= 0)
);

create unique index project_workers_name_unique
  on public.project_workers (workspace_id, project_id, lower(btrim(name)))
  where status = 'active';

create table public.project_work_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  worker_id uuid not null,
  entry_type public.work_log_entry_type not null,
  work_date date not null,
  amount_minor bigint not null,
  currency_code text not null references public.currencies (code),
  note text,
  financial_event_id uuid,
  created_by uuid not null references public.profiles (id),
  client_id uuid not null,
  operation text not null,
  payload_hash bytea not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint project_work_logs_workspace_id_id unique (workspace_id, id),
  constraint project_work_logs_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_work_logs_worker_fk
    foreign key (workspace_id, worker_id)
    references public.project_workers (workspace_id, id),
  constraint project_work_logs_event_fk
    foreign key (workspace_id, financial_event_id)
    references public.financial_events (workspace_id, id),
  constraint project_work_logs_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint project_work_logs_idempotency_unique
    unique (workspace_id, client_id, operation),
  constraint project_work_logs_operation
    check (
      operation in (
        'record_daily_work',
        'post_wage_bonus',
        'post_wage_deduction',
        'post_wage_withdrawal',
        'post_wage_adjustment'
      )
    ),
  constraint project_work_logs_note_length
    check (note is null or char_length(note) <= 500),
  constraint project_work_logs_nonzero
    check (amount_minor <> 0)
);

create unique index project_work_logs_one_daily_wage
  on public.project_work_logs (workspace_id, worker_id, work_date)
  where entry_type = 'daily_wage';

create index project_workers_project_status_idx
  on public.project_workers (workspace_id, project_id, status);

create index project_work_logs_worker_date_idx
  on public.project_work_logs (workspace_id, worker_id, work_date desc);

create index project_work_logs_project_date_idx
  on public.project_work_logs (workspace_id, project_id, work_date desc);

create trigger project_workers_set_updated_at
before update on public.project_workers
for each row execute function private.set_updated_at();

create trigger project_work_logs_immutable
before update or delete on public.project_work_logs
for each row execute function private.reject_row_mutation();

alter table public.project_workers enable row level security;
alter table public.project_work_logs enable row level security;

create policy project_workers_select_member
on public.project_workers
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy project_workers_insert_writer
on public.project_workers
for insert
to authenticated
with check (
  created_by = auth.uid()
  and private.can_write_workspace(workspace_id)
);

create policy project_workers_update_writer
on public.project_workers
for update
to authenticated
using (private.can_write_workspace(workspace_id))
with check (private.can_write_workspace(workspace_id));

create policy project_work_logs_select_member
on public.project_work_logs
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create view public.project_worker_balances
with (security_invoker = true)
as
select
  worker.id as worker_id,
  worker.workspace_id,
  worker.project_id,
  worker.name,
  worker.phone,
  worker.daily_wage_minor,
  worker.status,
  coalesce(sum(log.amount_minor::numeric), 0)::text as balance_minor,
  coalesce(
    sum(
      case
        when log.entry_type in ('daily_wage', 'bonus', 'adjustment')
          and log.amount_minor > 0
          then log.amount_minor::numeric
        else 0
      end
    ),
    0
  )::text as earned_minor,
  coalesce(
    sum(
      case
        when log.entry_type = 'withdrawal'
          then -log.amount_minor::numeric
        else 0
      end
    ),
    0
  )::text as withdrawn_minor,
  coalesce(
    sum(
      case
        when log.entry_type = 'deduction'
          then -log.amount_minor::numeric
        else 0
      end
    ),
    0
  )::text as deducted_minor,
  count(log.id) filter (where log.entry_type = 'daily_wage') as work_days
from public.project_workers as worker
left join public.project_work_logs as log
  on log.workspace_id = worker.workspace_id
 and log.worker_id = worker.id
group by worker.id;

create view public.project_labor_totals
with (security_invoker = true)
as
select
  project.id as project_id,
  project.workspace_id,
  coalesce(sum(balance.balance_minor::numeric), 0)::text as outstanding_minor,
  coalesce(sum(balance.earned_minor::numeric), 0)::text as earned_minor,
  coalesce(sum(balance.withdrawn_minor::numeric), 0)::text as withdrawn_minor,
  coalesce(sum(balance.deducted_minor::numeric), 0)::text as deducted_minor,
  count(balance.worker_id) filter (where balance.status = 'active') as active_workers
from public.projects as project
left join public.project_worker_balances as balance
  on balance.workspace_id = project.workspace_id
 and balance.project_id = project.id
group by project.id;

grant select on public.project_workers to authenticated;
grant insert, update on public.project_workers to authenticated;
grant select on public.project_work_logs to authenticated;
grant select on public.project_worker_balances to authenticated;
grant select on public.project_labor_totals to authenticated;
