-- Wave: expand project types + project cash + clients + personal income sources

create or replace function private.project_type_is_valid(p_project_type text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select pg_catalog.lower(pg_catalog.btrim(coalesce(p_project_type, ''))) in (
    'birds', 'animals', 'goods', 'food', 'services', 'general',
    'construction', 'rental', 'farming', 'delivery', 'maintenance',
    'education', 'ecommerce', 'personal'
  );
$fn$;

alter table public.projects
  drop constraint if exists projects_project_type_allowed;

alter table public.projects
  add constraint projects_project_type_allowed
  check (private.project_type_is_valid(project_type));

do $patch$
declare
  v_def text;
  v_oid oid;
begin
  for v_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_project', 'update_project')
  loop
    v_def := pg_get_functiondef(v_oid);
    v_def := replace(
      v_def,
      $$if v_project_type not in (
    'birds',
    'animals',
    'goods',
    'food',
    'services',
    'general'
  ) then
    raise exception 'invalid_project_type' using errcode = '22023';
  end if;$$,
      $$if not private.project_type_is_valid(v_project_type) then
    raise exception 'invalid_project_type' using errcode = '22023';
  end if;$$
    );
    execute v_def;
  end loop;
end;
$patch$;

-- Project cash mode + linked wallet
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'project_cash_mode'
  ) then
    create type public.project_cash_mode as enum (
      'off',
      'project_cash',
      'project_wallet',
      'hybrid'
    );
  end if;
end $$;

alter table public.projects
  add column if not exists cash_mode public.project_cash_mode not null default 'hybrid';

alter table public.projects
  add column if not exists linked_wallet_id uuid;

alter table public.wallets
  add column if not exists project_id uuid;

alter table public.projects
  drop constraint if exists projects_linked_wallet_fk;

alter table public.projects
  add constraint projects_linked_wallet_fk
  foreign key (workspace_id, linked_wallet_id)
  references public.wallets (workspace_id, id);

alter table public.wallets
  drop constraint if exists wallets_project_fk;

alter table public.wallets
  add constraint wallets_project_fk
  foreign key (workspace_id, project_id)
  references public.projects (workspace_id, id);

create unique index if not exists wallets_one_active_project_wallet
  on public.wallets (workspace_id, project_id)
  where project_id is not null and status = 'active';

create unique index if not exists projects_one_linked_wallet
  on public.projects (workspace_id, linked_wallet_id)
  where linked_wallet_id is not null;

-- Clients
create table if not exists public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  name text not null,
  phone text,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint clients_workspace_id_id unique (workspace_id, id),
  constraint clients_name_shape check (char_length(btrim(name)) between 1 and 160),
  constraint clients_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id)
);

create index if not exists clients_workspace_name_idx
  on public.clients (workspace_id, lower(btrim(name)));

alter table public.financial_events
  add column if not exists business_client_id uuid;

alter table public.financial_events
  drop constraint if exists financial_events_business_client_fk;

alter table public.financial_events
  add constraint financial_events_business_client_fk
  foreign key (workspace_id, business_client_id)
  references public.clients (workspace_id, id);

-- Project cash ledger
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'project_cash_entry_type'
  ) then
    create type public.project_cash_entry_type as enum (
      'income',
      'expense',
      'transfer_out',
      'transfer_in'
    );
  end if;
end $$;

create table if not exists public.project_cash_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  entry_type public.project_cash_entry_type not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null references public.currencies (code),
  title text not null,
  note text,
  category_id uuid,
  business_client_id uuid,
  wallet_id uuid,
  financial_event_id uuid,
  occurred_on date not null default ((timezone('utc', now()))::date),
  created_by uuid not null references public.profiles (id),
  client_id uuid not null,
  operation text not null,
  payload_hash bytea not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint project_cash_entries_workspace_id_id unique (workspace_id, id),
  constraint project_cash_entries_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_cash_entries_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint project_cash_entries_title_shape
    check (char_length(btrim(title)) between 1 and 200),
  constraint project_cash_entries_client_unique
    unique (workspace_id, client_id, operation)
);

create index if not exists project_cash_entries_project_idx
  on public.project_cash_entries (workspace_id, project_id, occurred_on desc);

create or replace view public.project_cash_balances
with (security_invoker = true)
as
select
  project.workspace_id,
  project.id as project_id,
  project.cash_mode,
  project.linked_wallet_id,
  coalesce(sum(
    case entry.entry_type
      when 'income' then entry.amount_minor
      when 'transfer_in' then entry.amount_minor
      when 'expense' then -entry.amount_minor
      when 'transfer_out' then -entry.amount_minor
    end
  ), 0)::bigint as balance_minor,
  coalesce(max(entry.currency_code), workspace.default_currency_code) as currency_code
from public.projects as project
join public.workspaces as workspace
  on workspace.id = project.workspace_id
left join public.project_cash_entries as entry
  on entry.workspace_id = project.workspace_id
 and entry.project_id = project.id
group by
  project.workspace_id,
  project.id,
  project.cash_mode,
  project.linked_wallet_id,
  workspace.default_currency_code;

-- Personal income sources
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'income_pay_kind'
  ) then
    create type public.income_pay_kind as enum ('daily', 'monthly', 'both');
  end if;
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'income_entry_type'
  ) then
    create type public.income_entry_type as enum (
      'daily_wage',
      'bonus',
      'deduction',
      'salary_accrual',
      'withdrawal'
    );
  end if;
end $$;

create table if not exists public.income_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  name text not null,
  place_label text,
  pay_kind public.income_pay_kind not null default 'daily',
  default_daily_wage_minor bigint not null default 0 check (default_daily_wage_minor >= 0),
  monthly_salary_minor bigint not null default 0 check (monthly_salary_minor >= 0),
  currency_code text not null references public.currencies (code),
  status text not null default 'active' check (status in ('active', 'archived')),
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint income_sources_workspace_id_id unique (workspace_id, id),
  constraint income_sources_name_shape check (char_length(btrim(name)) between 1 and 160),
  constraint income_sources_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id)
);

create table if not exists public.income_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  source_id uuid not null,
  entry_type public.income_entry_type not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null references public.currencies (code),
  work_on date,
  period_key text,
  reason text,
  note text,
  wallet_id uuid,
  financial_event_id uuid,
  created_by uuid not null references public.profiles (id),
  client_id uuid not null,
  operation text not null,
  payload_hash bytea not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint income_entries_workspace_id_id unique (workspace_id, id),
  constraint income_entries_source_fk
    foreign key (workspace_id, source_id)
    references public.income_sources (workspace_id, id),
  constraint income_entries_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint income_entries_client_unique
    unique (workspace_id, client_id, operation)
);

create unique index if not exists income_entries_one_daily_per_day
  on public.income_entries (workspace_id, source_id, work_on)
  where entry_type = 'daily_wage' and work_on is not null;

create or replace view public.income_source_balances
with (security_invoker = true)
as
select
  source.workspace_id,
  source.id as source_id,
  source.name,
  source.pay_kind,
  source.status,
  source.currency_code,
  coalesce(sum(
    case entry.entry_type
      when 'daily_wage' then entry.amount_minor
      when 'bonus' then entry.amount_minor
      when 'salary_accrual' then entry.amount_minor
      when 'deduction' then -entry.amount_minor
      when 'withdrawal' then -entry.amount_minor
    end
  ), 0)::bigint as outstanding_minor,
  coalesce(sum(case when entry.entry_type = 'daily_wage' then entry.amount_minor else 0 end), 0)::bigint as earned_daily_minor,
  coalesce(sum(case when entry.entry_type = 'salary_accrual' then entry.amount_minor else 0 end), 0)::bigint as earned_salary_minor,
  coalesce(sum(case when entry.entry_type = 'bonus' then entry.amount_minor else 0 end), 0)::bigint as bonus_minor,
  coalesce(sum(case when entry.entry_type = 'deduction' then entry.amount_minor else 0 end), 0)::bigint as deduction_minor,
  coalesce(sum(case when entry.entry_type = 'withdrawal' then entry.amount_minor else 0 end), 0)::bigint as withdrawn_minor,
  count(*) filter (where entry.entry_type = 'daily_wage')::int as daily_count
from public.income_sources as source
left join public.income_entries as entry
  on entry.workspace_id = source.workspace_id
 and entry.source_id = source.id
group by
  source.workspace_id,
  source.id,
  source.name,
  source.pay_kind,
  source.status,
  source.currency_code;

-- RLS
alter table public.clients enable row level security;
alter table public.project_cash_entries enable row level security;
alter table public.income_sources enable row level security;
alter table public.income_entries enable row level security;

drop policy if exists clients_select_member on public.clients;
create policy clients_select_member on public.clients
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

drop policy if exists project_cash_entries_select_member on public.project_cash_entries;
create policy project_cash_entries_select_member on public.project_cash_entries
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

drop policy if exists income_sources_select_member on public.income_sources;
create policy income_sources_select_member on public.income_sources
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

drop policy if exists income_entries_select_member on public.income_entries;
create policy income_entries_select_member on public.income_entries
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

grant select on public.clients to authenticated;
grant select on public.project_cash_entries to authenticated;
grant select on public.project_cash_balances to authenticated;
grant select on public.income_sources to authenticated;
grant select on public.income_entries to authenticated;
grant select on public.income_source_balances to authenticated;
