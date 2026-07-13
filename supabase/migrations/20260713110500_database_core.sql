-- Mizan database foundation.
-- workspace_id is the tenant and billing boundary throughout the public API.

create schema if not exists private;
create schema if not exists audit;

comment on schema private is
  'Non-exposed authorization, idempotency, and database helper objects.';
comment on schema audit is
  'Non-exposed immutable audit records.';

revoke all on schema private from public;
revoke all on schema audit from public;

create extension if not exists pgcrypto with schema extensions;

create type public.system_role as enum ('user', 'supervisor');
create type public.account_status as enum ('active', 'suspended', 'disabled');
create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.workspace_member_status as enum ('active', 'inactive');
create type public.workspace_status as enum ('active', 'suspended', 'archived');
create type public.wallet_status as enum ('active', 'inactive', 'archived');
create type public.project_status as enum ('active', 'archived');
create type public.category_kind as enum ('income', 'expense');
create type public.ledger_account_type as enum (
  'asset',
  'liability',
  'income',
  'expense',
  'equity'
);
create type public.ledger_system_key as enum (
  'income',
  'expense',
  'opening_equity'
);
create type public.financial_event_type as enum (
  'income',
  'expense',
  'transfer',
  'opening_balance',
  'reversal'
);
create type public.transaction_kind as enum ('income', 'expense');
create type public.subscription_status as enum (
  'trialing',
  'active',
  'grace',
  'frozen',
  'expired',
  'cancelled'
);
create type public.billing_interval as enum ('none', 'monthly', 'yearly');
create type public.payment_request_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);
create type public.payment_review_decision as enum ('approve', 'reject');
create type public.notification_kind as enum (
  'billing',
  'payment',
  'workspace',
  'system'
);

create table public.currencies (
  code text primary key,
  name text not null,
  minor_unit smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint currencies_code_format
    check (code ~ '^[A-Z]{3}$'),
  constraint currencies_minor_unit_range
    check (minor_unit between 0 and 6),
  constraint currencies_name_not_blank
    check (btrim(name) <> '')
);

insert into public.currencies (code, name, minor_unit)
values
  ('LYD', 'Libyan Dinar', 3),
  ('USD', 'US Dollar', 2),
  ('EUR', 'Euro', 2);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  system_role public.system_role not null default 'user',
  account_status public.account_status not null default 'active',
  display_name text,
  avatar_url text,
  locale text not null default 'ar',
  timezone text not null default 'Africa/Tripoli',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint profiles_display_name_length
    check (
      display_name is null
      or (char_length(btrim(display_name)) between 1 and 120)
    ),
  constraint profiles_avatar_url_length
    check (avatar_url is null or char_length(avatar_url) <= 2048),
  constraint profiles_locale_length
    check (char_length(btrim(locale)) between 2 and 20),
  constraint profiles_timezone_length
    check (char_length(btrim(timezone)) between 1 and 100)
);

create table public.workspaces (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  default_currency_code text not null default 'LYD'
    references public.currencies (code),
  status public.workspace_status not null default 'active',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint workspaces_name_length
    check (char_length(btrim(name)) between 1 and 120)
);

create table public.workspace_members (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  user_id uuid not null references public.profiles (id),
  role public.workspace_role not null,
  status public.workspace_member_status not null default 'active',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint workspace_members_workspace_user unique (workspace_id, user_id),
  constraint workspace_members_workspace_id_id unique (workspace_id, id)
);

create table public.subscription_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_minor bigint not null,
  currency_code text not null references public.currencies (code),
  billing_interval public.billing_interval not null,
  interval_count smallint,
  trial_days smallint not null default 0,
  is_public boolean not null default true,
  is_active boolean not null default true,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint subscription_plans_code_format
    check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint subscription_plans_name_not_blank
    check (btrim(name) <> ''),
  constraint subscription_plans_nonnegative_price
    check (price_minor >= 0),
  constraint subscription_plans_interval_shape
    check (
      (billing_interval = 'none' and interval_count is null)
      or
      (
        billing_interval in ('monthly', 'yearly')
        and interval_count is not null
        and interval_count between 1 and 24
      )
    ),
  constraint subscription_plans_trial_days_range
    check (trial_days between 0 and 90)
);

-- The bootstrap trigger depends on this non-purchasable operational plan.
insert into public.subscription_plans (
  id,
  code,
  name,
  price_minor,
  currency_code,
  billing_interval,
  interval_count,
  trial_days,
  is_public
)
values (
  '00000000-0000-0000-0000-000000000014'::uuid,
  'trial',
  '14-day trial',
  0,
  'LYD',
  'none',
  null,
  14,
  false
);

create table public.workspace_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  plan_id uuid not null references public.subscription_plans (id),
  status public.subscription_status not null,
  starts_at timestamptz not null,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  grace_ends_at timestamptz,
  frozen_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint workspace_subscriptions_one_per_workspace unique (workspace_id),
  constraint workspace_subscriptions_workspace_id_id unique (workspace_id, id),
  constraint workspace_subscriptions_trial_shape
    check (
      status <> 'trialing'
      or (trial_ends_at is not null and trial_ends_at > starts_at)
    ),
  constraint workspace_subscriptions_active_shape
    check (
      status <> 'active'
      or current_period_ends_at is not null
    ),
  constraint workspace_subscriptions_grace_shape
    check (
      status <> 'grace'
      or grace_ends_at is not null
    ),
  constraint workspace_subscriptions_frozen_shape
    check (
      status <> 'frozen'
      or frozen_at is not null
    ),
  constraint workspace_subscriptions_expired_shape
    check (
      status <> 'expired'
      or expired_at is not null
    ),
  constraint workspace_subscriptions_cancelled_shape
    check (
      status <> 'cancelled'
      or cancelled_at is not null
    )
);

create table public.payment_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  requested_by uuid not null references public.profiles (id),
  plan_id uuid not null references public.subscription_plans (id),
  period_count smallint not null default 1,
  amount_minor bigint not null,
  currency_code text not null references public.currencies (code),
  proof_object_path text,
  status public.payment_request_status not null default 'pending',
  requester_note text,
  review_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint payment_requests_workspace_id_id unique (workspace_id, id),
  constraint payment_requests_member_fk
    foreign key (workspace_id, requested_by)
    references public.workspace_members (workspace_id, user_id),
  constraint payment_requests_period_count_range
    check (period_count between 1 and 24),
  constraint payment_requests_positive_amount
    check (amount_minor > 0),
  constraint payment_requests_note_lengths
    check (
      (requester_note is null or char_length(requester_note) <= 1000)
      and (review_note is null or char_length(review_note) <= 1000)
    ),
  constraint payment_requests_review_shape
    check (
      (status = 'pending' and reviewed_by is null and reviewed_at is null)
      or
      (status = 'cancelled')
      or
      (
        status in ('approved', 'rejected')
        and reviewed_by is not null
        and reviewed_at is not null
      )
    )
);

create table public.subscription_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  subscription_id uuid not null,
  payment_request_id uuid,
  actor_user_id uuid references public.profiles (id),
  event_type text not null,
  from_status public.subscription_status,
  to_status public.subscription_status,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint subscription_events_workspace_id_id unique (workspace_id, id),
  constraint subscription_events_subscription_fk
    foreign key (workspace_id, subscription_id)
    references public.workspace_subscriptions (workspace_id, id),
  constraint subscription_events_payment_request_fk
    foreign key (workspace_id, payment_request_id)
    references public.payment_requests (workspace_id, id),
  constraint subscription_events_type_not_blank
    check (btrim(event_type) <> '')
);

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.workspaces (id),
  kind public.notification_kind not null default 'system',
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint notifications_title_length
    check (char_length(btrim(title)) between 1 and 160),
  constraint notifications_body_length
    check (char_length(btrim(body)) between 1 and 2000)
);

create table public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  name text not null,
  status public.project_status not null default 'active',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint projects_workspace_id_id unique (workspace_id, id),
  constraint projects_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint projects_name_length
    check (char_length(btrim(name)) between 1 and 160)
);

create unique index projects_workspace_name_unique
  on public.projects (workspace_id, lower(btrim(name)));

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  name text not null,
  kind public.category_kind not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint categories_workspace_id_id unique (workspace_id, id),
  constraint categories_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint categories_name_length
    check (char_length(btrim(name)) between 1 and 120)
);

create unique index categories_workspace_kind_name_unique
  on public.categories (workspace_id, kind, lower(btrim(name)));

create table public.ledger_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  currency_code text not null references public.currencies (code),
  account_type public.ledger_account_type not null,
  system_key public.ledger_system_key,
  name text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint ledger_accounts_workspace_id_id unique (workspace_id, id),
  constraint ledger_accounts_workspace_id_currency unique (
    workspace_id,
    id,
    currency_code
  ),
  constraint ledger_accounts_workspace_currency_type unique (
    workspace_id,
    id,
    currency_code,
    account_type
  ),
  constraint ledger_accounts_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint ledger_accounts_name_not_blank
    check (btrim(name) <> ''),
  constraint ledger_accounts_system_type
    check (
      system_key is null
      or (system_key = 'income' and account_type = 'income')
      or (system_key = 'expense' and account_type = 'expense')
      or (system_key = 'opening_equity' and account_type = 'equity')
    )
);

create unique index ledger_accounts_system_key_unique
  on public.ledger_accounts (workspace_id, currency_code, system_key)
  where system_key is not null;

create table public.wallets (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  ledger_account_id uuid not null,
  currency_code text not null references public.currencies (code),
  asset_account_type public.ledger_account_type
    generated always as ('asset'::public.ledger_account_type) stored,
  name text not null,
  status public.wallet_status not null default 'active',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint wallets_workspace_id_id unique (workspace_id, id),
  constraint wallets_one_wallet_per_account
    unique (workspace_id, ledger_account_id),
  constraint wallets_asset_account_fk
    foreign key (
      workspace_id,
      ledger_account_id,
      currency_code,
      asset_account_type
    )
    references public.ledger_accounts (
      workspace_id,
      id,
      currency_code,
      account_type
    ),
  constraint wallets_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint wallets_name_length
    check (char_length(btrim(name)) between 1 and 120)
);

create unique index wallets_workspace_name_unique
  on public.wallets (workspace_id, lower(btrim(name)))
  where status <> 'archived';

create table public.financial_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  event_type public.financial_event_type not null,
  currency_code text not null references public.currencies (code),
  occurred_at timestamptz not null,
  description text,
  category_id uuid,
  project_id uuid,
  reversal_of_event_id uuid,
  created_by uuid not null references public.profiles (id),
  client_id uuid not null,
  operation text not null,
  payload_hash bytea not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint financial_events_workspace_id_id unique (workspace_id, id),
  constraint financial_events_workspace_id_currency unique (
    workspace_id,
    id,
    currency_code
  ),
  constraint financial_events_category_fk
    foreign key (workspace_id, category_id)
    references public.categories (workspace_id, id),
  constraint financial_events_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint financial_events_reversal_fk
    foreign key (workspace_id, reversal_of_event_id)
    references public.financial_events (workspace_id, id),
  constraint financial_events_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint financial_events_idempotency_unique
    unique (workspace_id, client_id, operation),
  constraint financial_events_operation
    check (
      operation in (
        'create_wallet',
        'post_transaction',
        'post_transfer',
        'reverse_financial_event'
      )
    ),
  constraint financial_events_description_length
    check (description is null or char_length(description) <= 1000),
  constraint financial_events_reversal_shape
    check (
      (event_type = 'reversal' and reversal_of_event_id is not null)
      or
      (event_type <> 'reversal' and reversal_of_event_id is null)
    )
);

create unique index financial_events_one_reversal
  on public.financial_events (workspace_id, reversal_of_event_id)
  where reversal_of_event_id is not null;

create table public.ledger_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  event_id uuid not null,
  account_id uuid not null,
  currency_code text not null references public.currencies (code),
  line_no smallint not null,
  amount_minor bigint not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint ledger_entries_workspace_id_id unique (workspace_id, id),
  constraint ledger_entries_event_line unique (
    workspace_id,
    event_id,
    line_no
  ),
  constraint ledger_entries_event_currency_fk
    foreign key (workspace_id, event_id, currency_code)
    references public.financial_events (
      workspace_id,
      id,
      currency_code
    ),
  constraint ledger_entries_account_currency_fk
    foreign key (workspace_id, account_id, currency_code)
    references public.ledger_accounts (
      workspace_id,
      id,
      currency_code
    ),
  constraint ledger_entries_nonzero
    check (amount_minor <> 0),
  constraint ledger_entries_positive_line_number
    check (line_no > 0)
);

create table audit.events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid references public.workspaces (id),
  actor_user_id uuid references public.profiles (id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint audit_events_action_not_blank check (btrim(action) <> '')
);

comment on table public.financial_events is
  'Append-only posted business events. Corrections are separate reversal events.';
comment on table public.ledger_entries is
  'Append-only double-entry lines in bigint currency minor units.';
comment on column public.ledger_entries.amount_minor is
  'Signed minor units: debits are positive and credits are negative.';
comment on table public.wallets is
  'Wallet metadata only; balances are derived from ledger entries.';

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function private.reject_row_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%I.%I is append-only', tg_table_schema, tg_table_name);
end;
$$;

create function private.enforce_balanced_financial_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_event_id uuid;
  v_event_currency text;
  v_line_count bigint;
  v_currency_count bigint;
  v_sum numeric;
begin
  if tg_table_name = 'financial_events' then
    v_workspace_id := new.workspace_id;
    v_event_id := new.id;
    v_event_currency := new.currency_code;
  else
    v_workspace_id := coalesce(new.workspace_id, old.workspace_id);
    v_event_id := coalesce(new.event_id, old.event_id);

    select event.currency_code
      into v_event_currency
      from public.financial_events as event
     where event.workspace_id = v_workspace_id
       and event.id = v_event_id;
  end if;

  select
    count(*),
    count(distinct entry.currency_code),
    coalesce(sum(entry.amount_minor::numeric), 0)
    into v_line_count, v_currency_count, v_sum
    from public.ledger_entries as entry
   where entry.workspace_id = v_workspace_id
     and entry.event_id = v_event_id;

  if v_line_count < 2
     or v_currency_count <> 1
     or v_sum <> 0
     or not exists (
       select 1
         from public.ledger_entries as entry
        where entry.workspace_id = v_workspace_id
          and entry.event_id = v_event_id
          and entry.currency_code = v_event_currency
     )
  then
    raise exception using
      errcode = '23514',
      message = format(
        'financial event %s must have at least two same-currency lines summing to zero',
        v_event_id
      );
  end if;

  return null;
end;
$$;

create constraint trigger financial_events_balanced
after insert or update on public.financial_events
deferrable initially deferred
for each row
execute function private.enforce_balanced_financial_event();

create constraint trigger ledger_entries_balanced
after insert or update or delete on public.ledger_entries
deferrable initially deferred
for each row
execute function private.enforce_balanced_financial_event();

create trigger financial_events_immutable
before update or delete on public.financial_events
for each row execute function private.reject_row_mutation();

create trigger ledger_entries_immutable
before update or delete on public.ledger_entries
for each row execute function private.reject_row_mutation();

create trigger subscription_events_immutable
before update or delete on public.subscription_events
for each row execute function private.reject_row_mutation();

create trigger audit_events_immutable
before update or delete on audit.events
for each row execute function private.reject_row_mutation();

create trigger currencies_set_updated_at
before update on public.currencies
for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function private.set_updated_at();
create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function private.set_updated_at();
create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row execute function private.set_updated_at();
create trigger workspace_subscriptions_set_updated_at
before update on public.workspace_subscriptions
for each row execute function private.set_updated_at();
create trigger payment_requests_set_updated_at
before update on public.payment_requests
for each row execute function private.set_updated_at();
create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function private.set_updated_at();
create trigger projects_set_updated_at
before update on public.projects
for each row execute function private.set_updated_at();
create trigger categories_set_updated_at
before update on public.categories
for each row execute function private.set_updated_at();
create trigger ledger_accounts_set_updated_at
before update on public.ledger_accounts
for each row execute function private.set_updated_at();
create trigger wallets_set_updated_at
before update on public.wallets
for each row execute function private.set_updated_at();

-- RLS is enabled before any API grants are introduced.
alter table public.currencies enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.workspace_subscriptions enable row level security;
alter table public.payment_requests enable row level security;
alter table public.subscription_events enable row level security;
alter table public.notifications enable row level security;
alter table public.projects enable row level security;
alter table public.categories enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.wallets enable row level security;
alter table public.financial_events enable row level security;
alter table public.ledger_entries enable row level security;

-- Tenant and RLS lookup indexes.
create index profiles_system_role_status_idx
  on public.profiles (system_role, account_status);
create index workspaces_created_by_idx
  on public.workspaces (created_by);
create index workspaces_status_idx
  on public.workspaces (status);
create index workspace_members_user_status_idx
  on public.workspace_members (user_id, status, workspace_id);
create index workspace_members_workspace_role_status_idx
  on public.workspace_members (workspace_id, role, status);
create index subscription_plans_public_active_idx
  on public.subscription_plans (is_public, is_active);
create index workspace_subscriptions_status_ends_idx
  on public.workspace_subscriptions (
    status,
    trial_ends_at,
    current_period_ends_at,
    grace_ends_at
  );
create index payment_requests_workspace_status_created_idx
  on public.payment_requests (workspace_id, status, created_at desc);
create index payment_requests_requester_status_idx
  on public.payment_requests (requested_by, status);
create index subscription_events_workspace_created_idx
  on public.subscription_events (workspace_id, created_at desc);
create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index projects_workspace_status_idx
  on public.projects (workspace_id, status);
create index categories_workspace_kind_active_idx
  on public.categories (workspace_id, kind, is_active);
create index ledger_accounts_workspace_currency_idx
  on public.ledger_accounts (workspace_id, currency_code, account_type);
create index wallets_workspace_status_idx
  on public.wallets (workspace_id, status);
create index financial_events_workspace_occurred_idx
  on public.financial_events (workspace_id, occurred_at desc, id);
create index financial_events_workspace_project_idx
  on public.financial_events (workspace_id, project_id, occurred_at desc)
  where project_id is not null;
create index financial_events_workspace_category_idx
  on public.financial_events (workspace_id, category_id, occurred_at desc)
  where category_id is not null;
create index ledger_entries_event_idx
  on public.ledger_entries (workspace_id, event_id);
create index ledger_entries_account_idx
  on public.ledger_entries (workspace_id, account_id);
create index audit_events_workspace_created_idx
  on audit.events (workspace_id, created_at desc);
create index audit_events_actor_created_idx
  on audit.events (actor_user_id, created_at desc);

create view public.wallet_balances
with (security_invoker = true)
as
select
  wallet.id,
  wallet.workspace_id,
  wallet.name,
  wallet.currency_code,
  wallet.status,
  coalesce(sum(entry.amount_minor::numeric), 0)::text as balance_minor,
  wallet.created_at,
  wallet.updated_at
from public.wallets as wallet
join public.ledger_accounts as account
  on account.workspace_id = wallet.workspace_id
 and account.id = wallet.ledger_account_id
left join public.ledger_entries as entry
  on entry.workspace_id = account.workspace_id
 and entry.account_id = account.id
group by wallet.id;

create view public.visible_financial_events
with (security_invoker = true)
as
select
  event.id,
  event.workspace_id,
  event.event_type,
  event.currency_code,
  event.occurred_at,
  event.description,
  event.category_id,
  event.project_id,
  event.reversal_of_event_id,
  event.created_by,
  (
    min(wallet.id::text)
      filter (where entry.amount_minor < 0 and wallet.id is not null)
  )::uuid as source_wallet_id,
  (
    min(wallet.id::text)
      filter (where entry.amount_minor > 0 and wallet.id is not null)
  )::uuid as destination_wallet_id,
  coalesce(
    max(abs(entry.amount_minor::numeric))
      filter (where wallet.id is not null),
    0
  )::text as amount_minor,
  event.created_at
from public.financial_events as event
join public.ledger_entries as entry
  on entry.workspace_id = event.workspace_id
 and entry.event_id = event.id
left join public.wallets as wallet
  on wallet.workspace_id = entry.workspace_id
 and wallet.ledger_account_id = entry.account_id
group by event.id;

create view public.project_totals
with (security_invoker = true)
as
select
  project.id as project_id,
  project.workspace_id,
  event.currency_code,
  coalesce(
    sum(
      case
        when coalesce(original.event_type, event.event_type) = 'income'
          then entry.amount_minor::numeric
        else 0
      end
    ),
    0
  )::text as income_minor,
  coalesce(
    sum(
      case
        when coalesce(original.event_type, event.event_type) = 'expense'
          then -entry.amount_minor::numeric
        else 0
      end
    ),
    0
  )::text as expense_minor,
  coalesce(sum(entry.amount_minor::numeric), 0)::text as net_minor
from public.projects as project
join public.financial_events as event
  on event.workspace_id = project.workspace_id
 and event.project_id = project.id
left join public.financial_events as original
  on original.workspace_id = event.workspace_id
 and original.id = event.reversal_of_event_id
join public.ledger_entries as entry
  on entry.workspace_id = event.workspace_id
 and entry.event_id = event.id
join public.wallets as wallet
  on wallet.workspace_id = entry.workspace_id
 and wallet.ledger_account_id = entry.account_id
group by project.id, event.currency_code;

comment on view public.wallet_balances is
  'RLS-aware derived wallet balances; bigint-compatible amounts are returned as text.';
comment on view public.visible_financial_events is
  'RLS-aware posted event summary with amount represented as text.';
comment on view public.project_totals is
  'RLS-aware project totals by currency with amounts represented as text.';

revoke all on all tables in schema audit from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all functions in schema audit from public, anon, authenticated;
