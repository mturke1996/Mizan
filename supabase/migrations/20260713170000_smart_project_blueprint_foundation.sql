-- Smart Project Blueprint database foundation.
-- Capital uses signed minor units: opening/contribution are positive,
-- withdrawal is negative, and adjustment may use either sign.

create type public.project_capital_entry_type as enum (
  'opening',
  'contribution',
  'withdrawal',
  'adjustment'
);

create type public.project_inventory_item_status as enum (
  'active',
  'archived'
);

create function private.project_modules_are_valid(p_modules jsonb)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_modules) <> 'object' then false
    else
      p_modules ?& array[
        'transactions',
        'goal',
        'workers',
        'capital',
        'inventory'
      ]::text[]
      and (
        p_modules - array[
          'transactions',
          'goal',
          'workers',
          'capital',
          'inventory'
        ]::text[]
      ) = '{}'::jsonb
      and pg_catalog.jsonb_typeof(p_modules -> 'transactions') = 'boolean'
      and pg_catalog.jsonb_typeof(p_modules -> 'goal') = 'boolean'
      and pg_catalog.jsonb_typeof(p_modules -> 'workers') = 'boolean'
      and pg_catalog.jsonb_typeof(p_modules -> 'capital') = 'boolean'
      and pg_catalog.jsonb_typeof(p_modules -> 'inventory') = 'boolean'
      and p_modules -> 'transactions' = 'true'::jsonb
  end
$$;

revoke all on function private.project_modules_are_valid(jsonb)
  from public, anon, authenticated;

alter table public.projects
  add column project_type text default 'general',
  add column modules jsonb default '{
    "transactions": true,
    "goal": false,
    "workers": false,
    "capital": false,
    "inventory": false
  }'::jsonb;

alter table public.projects disable trigger projects_set_updated_at;

update public.projects as project
set
  project_type = 'general',
  modules = pg_catalog.jsonb_build_object(
    'transactions',
    true,
    'goal',
    project.goal_minor is not null,
    'workers',
    exists (
      select 1
      from public.project_workers as worker
      where worker.workspace_id = project.workspace_id
        and worker.project_id = project.id
    ),
    'capital',
    false,
    'inventory',
    false
  );

alter table public.projects enable trigger projects_set_updated_at;

alter table public.projects
  alter column project_type set not null,
  alter column modules set not null;

alter table public.projects
  add constraint projects_project_type_allowed
    check (
      project_type in (
        'birds',
        'animals',
        'goods',
        'food',
        'services',
        'general'
      )
    ),
  add constraint projects_modules_shape
    check (
      case
        when pg_catalog.jsonb_typeof(modules) <> 'object' then false
        else
          modules ?& array[
          'transactions',
          'goal',
          'workers',
          'capital',
          'inventory'
        ]::text[]
          and (
            modules - array[
              'transactions',
              'goal',
              'workers',
              'capital',
              'inventory'
            ]::text[]
          ) = '{}'::jsonb
          and pg_catalog.jsonb_typeof(modules -> 'transactions') = 'boolean'
          and pg_catalog.jsonb_typeof(modules -> 'goal') = 'boolean'
          and pg_catalog.jsonb_typeof(modules -> 'workers') = 'boolean'
          and pg_catalog.jsonb_typeof(modules -> 'capital') = 'boolean'
          and pg_catalog.jsonb_typeof(modules -> 'inventory') = 'boolean'
          and modules -> 'transactions' = 'true'::jsonb
      end
    );

comment on column public.projects.project_type is
  'Blueprint classification constrained to supported project templates.';
comment on column public.projects.modules is
  'Exact module flags. Transactions is mandatory and always true.';

create table private.project_creation_idempotency (
  workspace_id uuid not null references public.workspaces (id),
  client_id uuid not null,
  operation text not null default 'create_project',
  payload_hash bytea not null,
  project_id uuid,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (workspace_id, client_id, operation),
  constraint project_creation_idempotency_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_creation_idempotency_operation
    check (operation = 'create_project'),
  constraint project_creation_idempotency_payload_hash_length
    check (pg_catalog.octet_length(payload_hash) = 32)
);

create index project_creation_idempotency_project_idx
  on private.project_creation_idempotency (workspace_id, project_id)
  where project_id is not null;

revoke all on table private.project_creation_idempotency
  from public, anon, authenticated;

create table public.project_capital_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  entry_type public.project_capital_entry_type not null,
  amount_minor bigint not null,
  currency_code text not null references public.currencies (code),
  note text,
  occurred_on date not null
    default (pg_catalog.timezone('utc', pg_catalog.now()))::date,
  created_by uuid not null references public.profiles (id),
  client_id uuid not null,
  operation text not null,
  payload_hash bytea not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint project_capital_entries_workspace_id_id
    unique (workspace_id, id),
  constraint project_capital_entries_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_capital_entries_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint project_capital_entries_idempotency_unique
    unique (workspace_id, client_id, operation),
  constraint project_capital_entries_nonzero
    check (amount_minor <> 0),
  constraint project_capital_entries_signed_amount
    check (
      (
        entry_type in ('opening', 'contribution')
        and amount_minor > 0
      )
      or
      (
        entry_type = 'withdrawal'
        and amount_minor < 0
      )
      or
      (
        entry_type = 'adjustment'
        and amount_minor <> 0
      )
    ),
  constraint project_capital_entries_operation
    check (
      operation in (
        'create_project_opening_capital',
        'post_capital_entry'
      )
    ),
  constraint project_capital_entries_payload_hash_length
    check (pg_catalog.octet_length(payload_hash) = 32),
  constraint project_capital_entries_note_length
    check (note is null or pg_catalog.char_length(note) <= 500)
);

comment on table public.project_capital_entries is
  'Append-only project capital ledger with retry-safe client operations.';
comment on column public.project_capital_entries.amount_minor is
  'Signed minor units: opening/contribution positive, withdrawal negative, adjustment either sign.';

create table public.project_inventory_items (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  name text not null,
  quantity numeric not null default 0,
  unit_label text not null,
  unit_cost_minor bigint,
  currency_code text not null,
  status public.project_inventory_item_status not null default 'active',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint project_inventory_items_workspace_id_id
    unique (workspace_id, id),
  constraint project_inventory_items_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_inventory_items_currency_fk
    foreign key (currency_code)
    references public.currencies (code),
  constraint project_inventory_items_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint project_inventory_items_name_length
    check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 160),
  constraint project_inventory_items_unit_label_length
    check (
      pg_catalog.char_length(pg_catalog.btrim(unit_label)) between 1 and 40
    ),
  constraint project_inventory_items_quantity_nonnegative
    check (
      quantity >= 0
      and quantity <> 'NaN'::numeric
      and quantity <> 'Infinity'::numeric
    ),
  constraint project_inventory_items_unit_cost_nonnegative
    check (unit_cost_minor is null or unit_cost_minor >= 0)
);

comment on column public.project_inventory_items.currency_code is
  'Currency identity for unit_cost_minor; RPCs default it from the workspace.';

create index project_capital_entries_project_date_idx
  on public.project_capital_entries (
    workspace_id,
    project_id,
    currency_code,
    occurred_on desc,
    created_at desc
  );

create index project_capital_entries_workspace_creator_idx
  on public.project_capital_entries (workspace_id, created_by);

create index project_capital_entries_currency_idx
  on public.project_capital_entries (currency_code);

create unique index project_inventory_items_active_name_unique
  on public.project_inventory_items (
    workspace_id,
    project_id,
    pg_catalog.lower(pg_catalog.btrim(name))
  )
  where status = 'active';

create index project_inventory_items_project_status_idx
  on public.project_inventory_items (workspace_id, project_id, status);

create index project_inventory_items_currency_idx
  on public.project_inventory_items (currency_code);

create index project_inventory_items_workspace_creator_idx
  on public.project_inventory_items (workspace_id, created_by);

-- The snapshot cutoff normally admits nearly all existing rows, so keep the
-- equality and keyset-order columns contiguous for an ordered index scan.
create index financial_events_project_history_keyset_idx
  on public.financial_events (
    workspace_id,
    project_id,
    occurred_at desc,
    id desc
  )
  where project_id is not null;

create trigger project_capital_entries_immutable
before update or delete on public.project_capital_entries
for each row execute function private.reject_row_mutation();

create trigger project_inventory_items_set_updated_at
before update on public.project_inventory_items
for each row execute function private.set_updated_at();

alter table public.project_capital_entries enable row level security;
alter table public.project_inventory_items enable row level security;

create policy project_capital_entries_select_member
on public.project_capital_entries
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy project_inventory_items_select_member
on public.project_inventory_items
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create view public.project_capital_totals
with (security_invoker = true)
as
select
  entry.workspace_id,
  entry.project_id,
  entry.currency_code,
  coalesce(
    sum(entry.amount_minor::numeric)
      filter (where entry.entry_type = 'opening'),
    0
  )::text as opening_minor,
  coalesce(
    sum(entry.amount_minor::numeric)
      filter (where entry.entry_type = 'contribution'),
    0
  )::text as contributions_minor,
  coalesce(
    -(
      sum(entry.amount_minor::numeric)
        filter (where entry.entry_type = 'withdrawal')
    ),
    0
  )::text as withdrawals_minor,
  coalesce(
    sum(entry.amount_minor::numeric)
      filter (where entry.entry_type = 'adjustment'),
    0
  )::text as adjustments_minor,
  coalesce(sum(entry.amount_minor::numeric), 0)::text
    as net_capital_minor
from public.project_capital_entries as entry
group by
  entry.workspace_id,
  entry.project_id,
  entry.currency_code;

create view public.project_inventory_totals
with (security_invoker = true)
as
select
  item.workspace_id,
  item.project_id,
  item.currency_code,
  count(*) as item_count,
  coalesce(
    sum(
      pg_catalog.round(
        item.quantity * item.unit_cost_minor::numeric,
        0
      )
    ),
    0
  )::text as inventory_value_minor
from public.project_inventory_items as item
where item.status = 'active'
group by
  item.workspace_id,
  item.project_id,
  item.currency_code;

create view public.project_summaries
with (security_invoker = true)
as
select
  project.id,
  project.workspace_id,
  project.name,
  project.description,
  project.goal_minor::text as goal_minor,
  project.color_token,
  project.status,
  project.project_type,
  project.modules,
  project.created_by,
  project.created_at,
  project.updated_at
from public.projects as project;

create view public.project_financial_totals
with (security_invoker = true)
as
select
  total.project_id,
  total.workspace_id,
  total.currency_code,
  total.income_minor::text as income_minor,
  total.expense_minor::text as expense_minor,
  total.net_minor::text as net_minor
from public.project_totals as total;

create view public.project_labor_summaries
with (security_invoker = true)
as
select
  total.project_id,
  total.workspace_id,
  total.outstanding_minor::text as outstanding_minor,
  total.earned_minor::text as earned_minor,
  total.withdrawn_minor::text as withdrawn_minor,
  total.deducted_minor::text as deducted_minor,
  total.active_workers
from public.project_labor_totals as total;

create view public.project_worker_balance_details
with (security_invoker = true)
as
select
  balance.worker_id,
  balance.workspace_id,
  balance.project_id,
  balance.name,
  balance.phone,
  balance.daily_wage_minor::text as daily_wage_minor,
  balance.status,
  balance.balance_minor::text as balance_minor,
  balance.earned_minor::text as earned_minor,
  balance.withdrawn_minor::text as withdrawn_minor,
  balance.deducted_minor::text as deducted_minor,
  balance.work_days
from public.project_worker_balances as balance;

create view public.project_work_log_details
with (security_invoker = true)
as
select
  log.id,
  log.workspace_id,
  log.project_id,
  log.worker_id,
  log.entry_type,
  log.work_date,
  log.amount_minor::text as amount_minor,
  log.currency_code,
  log.note,
  log.financial_event_id,
  log.created_by,
  log.client_id,
  log.operation,
  log.payload_hash,
  log.created_at,
  log.updated_at
from public.project_work_logs as log;

create view public.project_capital_entry_details
with (security_invoker = true)
as
select
  entry.id,
  entry.workspace_id,
  entry.project_id,
  entry.entry_type,
  entry.amount_minor::text as amount_minor,
  entry.currency_code,
  entry.note,
  entry.occurred_on,
  entry.created_by,
  entry.client_id,
  entry.operation,
  entry.payload_hash,
  entry.created_at,
  entry.updated_at
from public.project_capital_entries as entry;

create view public.project_inventory_item_details
with (security_invoker = true)
as
select
  item.id,
  item.workspace_id,
  item.project_id,
  item.name,
  item.quantity,
  item.unit_label,
  item.unit_cost_minor::text as unit_cost_minor,
  item.currency_code,
  item.status,
  item.created_by,
  item.created_at,
  item.updated_at
from public.project_inventory_items as item;

create view public.financial_event_details
with (security_invoker = true)
as
select
  event.id,
  event.workspace_id,
  event.event_type,
  coalesce(original.event_type, event.event_type) as effective_event_type,
  event.event_type = 'reversal'::public.financial_event_type as is_reversal,
  event.currency_code,
  event.occurred_at,
  event.description,
  event.category_id,
  event.project_id,
  event.reversal_of_event_id,
  event.created_by,
  case
    when event.event_type = 'reversal'::public.financial_event_type
      then original.source_wallet_id
    else event.source_wallet_id
  end as source_wallet_id,
  case
    when event.event_type = 'reversal'::public.financial_event_type
      then original.destination_wallet_id
    else event.destination_wallet_id
  end as destination_wallet_id,
  case
    when event.event_type = 'reversal'::public.financial_event_type
      then (-event.amount_minor::numeric)::text
    else event.amount_minor::text
  end as amount_minor,
  event.created_at
from public.visible_financial_events as event
left join public.visible_financial_events as original
  on event.event_type = 'reversal'::public.financial_event_type
 and original.workspace_id = event.workspace_id
 and original.id = event.reversal_of_event_id;

comment on view public.project_capital_totals is
  'RLS-aware signed capital totals by project and currency; amounts are text.';
comment on view public.project_inventory_totals is
  'RLS-aware active inventory count and valuation by project and currency.';
comment on view public.project_summaries is
  'RLS-aware project read model; goal minor units are returned as text.';
comment on view public.project_financial_totals is
  'RLS-aware project totals read model; all minor-unit amounts are text.';
comment on view public.project_labor_summaries is
  'RLS-aware project labor read model; all minor-unit amounts are text.';
comment on view public.project_worker_balance_details is
  'RLS-aware worker balance read model; all minor-unit amounts are text.';
comment on view public.project_work_log_details is
  'RLS-aware project work-log read model; amount minor units are text.';
comment on view public.project_capital_entry_details is
  'RLS-aware capital entry read model; amount minor units are text.';
comment on view public.project_inventory_item_details is
  'RLS-aware inventory item read model; unit-cost minor units are text.';
comment on view public.financial_event_details is
  'RLS-aware financial event read model; amount minor units are exact decimal text.';

-- Blueprint-aware create overload. Requiring the two new arguments keeps calls
-- unambiguous with the legacy overload, whose remaining arguments have defaults.
create function public.create_project(
  p_workspace_id uuid,
  p_name text,
  p_project_type text,
  p_modules jsonb,
  p_description text default null,
  p_goal_minor bigint default null,
  p_color_token text default 'primary',
  p_status public.project_status default 'active',
  p_client_id uuid default extensions.gen_random_uuid(),
  p_opening_capital_minor bigint default null,
  p_seed_categories jsonb default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := pg_catalog.btrim(p_name);
  v_description text := nullif(
    pg_catalog.btrim(coalesce(p_description, '')),
    ''
  );
  v_project_type text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_project_type, 'general'))
  );
  v_modules jsonb := coalesce(
    p_modules,
    '{
      "transactions": true,
      "goal": false,
      "workers": false,
      "capital": false,
      "inventory": false
    }'::jsonb
  );
  v_color_token text := coalesce(
    nullif(pg_catalog.btrim(coalesce(p_color_token, '')), ''),
    'primary'
  );
  v_status public.project_status := coalesce(p_status, 'active');
  v_workspace public.workspaces%rowtype;
  v_project public.projects%rowtype;
  v_seed jsonb;
  v_seed_name text;
  v_seed_kind text;
  v_seed_category_id uuid;
  v_seed_is_system boolean;
  v_seed_is_active boolean;
  v_canonical_seed_categories jsonb := '[]'::jsonb;
  v_creation_payload jsonb;
  v_creation_payload_hash bytea;
  v_stored_payload_hash bytea;
  v_stored_project_id uuid;
  v_occurred_on date := (
    pg_catalog.timezone('utc', pg_catalog.now())
  )::date;
  v_opening_payload jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_name is null
     or pg_catalog.char_length(v_name) not between 1 and 160
  then
    raise exception 'invalid_project_name' using errcode = '22023';
  end if;

  if v_description is not null
     and pg_catalog.char_length(v_description) > 500
  then
    raise exception 'invalid_project_description' using errcode = '22023';
  end if;

  if p_goal_minor is not null and p_goal_minor < 0 then
    raise exception 'invalid_project_goal' using errcode = '22023';
  end if;

  if v_project_type not in (
    'birds',
    'animals',
    'goods',
    'food',
    'services',
    'general'
  ) then
    raise exception 'invalid_project_type' using errcode = '22023';
  end if;

  if not private.project_modules_are_valid(v_modules) then
    raise exception 'invalid_project_modules' using errcode = '22023';
  end if;

  if p_goal_minor is not null then
    if p_modules is null then
      v_modules := pg_catalog.jsonb_set(
        v_modules,
        '{goal}',
        'true'::jsonb
      );
    elsif v_modules -> 'goal' is distinct from 'true'::jsonb then
      raise exception 'module_disabled' using errcode = 'PT409';
    end if;
  end if;

  if v_color_token not in (
    'primary',
    'success',
    'warning',
    'danger',
    'info'
  ) then
    raise exception 'invalid_color_token' using errcode = '22023';
  end if;

  if p_client_id is null then
    raise exception 'client_id_required' using errcode = '22023';
  end if;

  if p_opening_capital_minor is not null then
    if v_modules -> 'capital' is distinct from 'true'::jsonb then
      raise exception 'module_disabled' using errcode = 'PT409';
    end if;

    if p_opening_capital_minor <= 0 then
      raise exception 'invalid_opening_capital' using errcode = '22023';
    end if;

    if v_status <> 'active' then
      raise exception 'project_not_active' using errcode = 'PT409';
    end if;
  end if;

  if p_seed_categories is not null then
    if pg_catalog.jsonb_typeof(p_seed_categories) <> 'array' then
      raise exception 'invalid_seed_categories' using errcode = '22023';
    end if;

    for v_seed in
      select seed.value
      from pg_catalog.jsonb_array_elements(p_seed_categories)
        as seed(value)
    loop
      if pg_catalog.jsonb_typeof(v_seed) <> 'object' then
        raise exception 'invalid_seed_category' using errcode = '22023';
      end if;

      if not (v_seed ?& array['name', 'kind']::text[])
         or (v_seed - array['name', 'kind']::text[]) <> '{}'::jsonb
      then
        raise exception 'invalid_seed_category' using errcode = '22023';
      end if;

      if pg_catalog.jsonb_typeof(v_seed -> 'name') <> 'string'
         or pg_catalog.jsonb_typeof(v_seed -> 'kind') <> 'string'
      then
        raise exception 'invalid_seed_category' using errcode = '22023';
      end if;

      v_seed_name := pg_catalog.btrim(v_seed ->> 'name');
      v_seed_kind := pg_catalog.lower(
        pg_catalog.btrim(v_seed ->> 'kind')
      );

      if v_seed_name is null
         or pg_catalog.char_length(v_seed_name) not between 1 and 120
         or v_seed_kind not in ('income', 'expense')
      then
        raise exception 'invalid_seed_category' using errcode = '22023';
      end if;
    end loop;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'kind',
          seed.kind,
          'name',
          seed.name
        )
        order by seed.kind, seed.name_key, seed.name
      ),
      '[]'::jsonb
    )
      into v_canonical_seed_categories
      from (
        select distinct
          pg_catalog.lower(
            pg_catalog.btrim(category.value ->> 'kind')
          ) as kind,
          pg_catalog.btrim(category.value ->> 'name') as name,
          pg_catalog.lower(
            pg_catalog.btrim(category.value ->> 'name')
          ) as name_key
        from pg_catalog.jsonb_array_elements(p_seed_categories)
          as category(value)
      ) as seed;
  end if;

  v_creation_payload := pg_catalog.jsonb_build_object(
    'color_token',
    v_color_token,
    'description',
    v_description,
    'goal_minor',
    p_goal_minor,
    'modules',
    v_modules,
    'name',
    v_name,
    'opening_capital_minor',
    p_opening_capital_minor,
    'project_type',
    v_project_type,
    'seed_categories',
    v_canonical_seed_categories,
    'status',
    v_status
  );
  v_creation_payload_hash := private.payload_hash(v_creation_payload);

  -- The unique insert serializes concurrent retries. A competing insert waits
  -- for the first transaction, then reads its completed project under lock.
  insert into private.project_creation_idempotency (
    workspace_id,
    client_id,
    operation,
    payload_hash
  )
  values (
    p_workspace_id,
    p_client_id,
    'create_project',
    v_creation_payload_hash
  )
  on conflict (workspace_id, client_id, operation) do nothing;

  select creation.payload_hash, creation.project_id
    into v_stored_payload_hash, v_stored_project_id
    from private.project_creation_idempotency as creation
   where creation.workspace_id = p_workspace_id
     and creation.client_id = p_client_id
     and creation.operation = 'create_project'
   for update;

  if not found then
    raise exception 'idempotency_state_missing' using errcode = 'XX000';
  end if;

  if v_stored_payload_hash is distinct from v_creation_payload_hash then
    raise exception 'idempotency_conflict' using errcode = 'PT409';
  end if;

  if v_stored_project_id is not null then
    select project.*
      into v_project
      from public.projects as project
     where project.workspace_id = p_workspace_id
       and project.id = v_stored_project_id;

    if not found then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_project;
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select workspace.*
    into v_workspace
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
     and workspace.status = 'active';

  if not found then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  if p_opening_capital_minor is not null
     and not exists (
       select 1
       from public.currencies as currency
       where currency.code = v_workspace.default_currency_code
         and currency.is_active
     )
  then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  insert into public.projects (
    workspace_id,
    name,
    description,
    goal_minor,
    color_token,
    status,
    project_type,
    modules,
    created_by
  )
  values (
    p_workspace_id,
    v_name,
    v_description,
    p_goal_minor,
    v_color_token,
    v_status,
    v_project_type,
    v_modules,
    v_user_id
  )
  returning * into v_project;

  if p_seed_categories is not null then
    for v_seed in
      select seed.value
      from pg_catalog.jsonb_array_elements(v_canonical_seed_categories)
        as seed(value)
    loop
      v_seed_name := pg_catalog.btrim(v_seed ->> 'name');
      v_seed_kind := pg_catalog.lower(
        pg_catalog.btrim(v_seed ->> 'kind')
      );

      insert into public.categories as existing_category (
        workspace_id,
        name,
        kind,
        is_system,
        is_active,
        created_by
      )
      values (
        p_workspace_id,
        v_seed_name,
        v_seed_kind::public.category_kind,
        false,
        true,
        v_user_id
      )
      on conflict (
        workspace_id,
        kind,
        (pg_catalog.lower(pg_catalog.btrim(name)))
      )
      do nothing
      returning id into v_seed_category_id;

      if not found then
        select
          category.id,
          category.is_system,
          category.is_active
          into
            v_seed_category_id,
            v_seed_is_system,
            v_seed_is_active
          from public.categories as category
         where category.workspace_id = p_workspace_id
           and category.kind = v_seed_kind::public.category_kind
           and pg_catalog.lower(pg_catalog.btrim(category.name)) =
             pg_catalog.lower(v_seed_name)
         for update;

        if not found then
          raise exception 'seed_category_conflict' using errcode = 'PT409';
        end if;

        if v_seed_is_system and not v_seed_is_active then
          raise exception 'seed_category_conflict' using errcode = 'PT409';
        end if;

        if not v_seed_is_system and not v_seed_is_active then
          update public.categories
             set is_active = true
           where id = v_seed_category_id
             and workspace_id = p_workspace_id
             and not is_system;

          if not found then
            raise exception 'seed_category_conflict' using errcode = 'PT409';
          end if;
        end if;
      end if;
    end loop;
  end if;

  if p_opening_capital_minor is not null then
    v_opening_payload := pg_catalog.jsonb_build_object(
      'amount_minor',
      p_opening_capital_minor,
      'currency_code',
      v_workspace.default_currency_code,
      'entry_type',
      'opening',
      'occurred_on',
      v_occurred_on,
      'project_id',
      v_project.id
    );

    insert into public.project_capital_entries (
      workspace_id,
      project_id,
      entry_type,
      amount_minor,
      currency_code,
      note,
      occurred_on,
      created_by,
      client_id,
      operation,
      payload_hash
    )
    values (
      p_workspace_id,
      v_project.id,
      'opening',
      p_opening_capital_minor,
      v_workspace.default_currency_code,
      'Opening capital',
      v_occurred_on,
      v_user_id,
      p_client_id,
      'create_project_opening_capital',
      private.payload_hash(v_opening_payload)
    );
  end if;

  update private.project_creation_idempotency
     set project_id = v_project.id,
         updated_at = pg_catalog.clock_timestamp()
   where workspace_id = p_workspace_id
     and client_id = p_client_id
     and operation = 'create_project'
     and payload_hash = v_creation_payload_hash
     and project_id is null;

  if not found then
    raise exception 'idempotency_state_conflict' using errcode = 'XX000';
  end if;

  return v_project;
end;
$$;

-- Preserve the existing frontend parameter set exactly.
create or replace function public.create_project(
  p_workspace_id uuid,
  p_name text,
  p_description text default null,
  p_goal_minor bigint default null,
  p_color_token text default 'primary',
  p_status public.project_status default 'active',
  p_client_id uuid default extensions.gen_random_uuid()
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.create_project(
    p_workspace_id => p_workspace_id,
    p_name => p_name,
    p_project_type => 'general',
    p_modules => pg_catalog.jsonb_build_object(
      'transactions',
      true,
      'goal',
      p_goal_minor is not null,
      'workers',
      false,
      'capital',
      false,
      'inventory',
      false
    ),
    p_description => p_description,
    p_goal_minor => p_goal_minor,
    p_color_token => p_color_token,
    p_status => p_status,
    p_client_id => coalesce(
      p_client_id,
      extensions.gen_random_uuid()
    ),
    p_opening_capital_minor => null,
    p_seed_categories => null
  );
end;
$$;

-- Blueprint-aware update overload. Null type/modules retain their current values.
-- p_clear_goal distinguishes an explicit clear from a legacy omitted/null value.
create function public.update_project(
  p_workspace_id uuid,
  p_project_id uuid,
  p_project_type text,
  p_modules jsonb,
  p_name text default null,
  p_description text default null,
  p_goal_minor bigint default null,
  p_color_token text default null,
  p_status public.project_status default null,
  p_clear_goal boolean default false
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_name text;
  v_description text;
  v_goal_minor bigint;
  v_color_token text;
  v_project_type text;
  v_modules jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select project.*
    into v_project
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.id = p_project_id
   for update;

  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  v_name := v_project.name;
  if p_name is not null
     and nullif(pg_catalog.btrim(p_name), '') is not null
  then
    v_name := pg_catalog.btrim(p_name);
  end if;

  if pg_catalog.char_length(v_name) not between 1 and 160 then
    raise exception 'invalid_project_name' using errcode = '22023';
  end if;

  v_description := case
    when p_description is null then v_project.description
    else nullif(pg_catalog.btrim(p_description), '')
  end;

  if v_description is not null
     and pg_catalog.char_length(v_description) > 500
  then
    raise exception 'invalid_project_description' using errcode = '22023';
  end if;

  v_project_type := v_project.project_type;
  if p_project_type is not null then
    v_project_type := pg_catalog.lower(pg_catalog.btrim(p_project_type));
  end if;

  if v_project_type not in (
    'birds',
    'animals',
    'goods',
    'food',
    'services',
    'general'
  ) then
    raise exception 'invalid_project_type' using errcode = '22023';
  end if;

  v_modules := v_project.modules;
  if p_modules is not null then
    if not private.project_modules_are_valid(p_modules) then
      raise exception 'invalid_project_modules' using errcode = '22023';
    end if;
    v_modules := p_modules;
  end if;

  if p_goal_minor is not null and p_goal_minor < 0 then
    raise exception 'invalid_project_goal' using errcode = '22023';
  end if;

  if coalesce(p_clear_goal, false) and p_goal_minor is not null then
    raise exception 'conflicting_goal_update' using errcode = '22023';
  end if;

  if p_goal_minor is not null
     and p_modules is not null
     and v_modules -> 'goal' is distinct from 'true'::jsonb
  then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  v_goal_minor := v_project.goal_minor;

  if coalesce(p_clear_goal, false)
     or (
       p_modules is not null
       and v_modules -> 'goal' = 'false'::jsonb
     )
  then
    v_goal_minor := null;
  elsif p_goal_minor is not null then
    v_goal_minor := p_goal_minor;

    -- Legacy callers can still add a goal without knowing about modules.
    if p_modules is null
       and v_modules -> 'goal' is distinct from 'true'::jsonb
    then
      v_modules := pg_catalog.jsonb_set(
        v_modules,
        '{goal}',
        'true'::jsonb
      );
    end if;
  end if;

  v_color_token := coalesce(
    nullif(pg_catalog.btrim(coalesce(p_color_token, '')), ''),
    v_project.color_token
  );

  if v_color_token not in (
    'primary',
    'success',
    'warning',
    'danger',
    'info'
  ) then
    raise exception 'invalid_color_token' using errcode = '22023';
  end if;

  update public.projects
     set name = v_name,
         description = v_description,
         goal_minor = v_goal_minor,
         color_token = v_color_token,
         status = coalesce(p_status, v_project.status),
         project_type = v_project_type,
         modules = v_modules
   where workspace_id = p_workspace_id
     and id = p_project_id
  returning * into v_project;

  return v_project;
end;
$$;

-- Preserve the existing update signature and its null-means-unchanged behavior.
create or replace function public.update_project(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text default null,
  p_description text default null,
  p_goal_minor bigint default null,
  p_color_token text default null,
  p_status public.project_status default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.update_project(
    p_workspace_id => p_workspace_id,
    p_project_id => p_project_id,
    p_project_type => null,
    p_modules => null,
    p_name => p_name,
    p_description => p_description,
    p_goal_minor => p_goal_minor,
    p_color_token => p_color_token,
    p_status => p_status,
    p_clear_goal => false
  );
end;
$$;

create or replace function public.create_project_worker(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text,
  p_daily_wage_minor bigint,
  p_phone text default null
)
returns public.project_workers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_worker public.project_workers%rowtype;
  v_name text := pg_catalog.btrim(p_name);
begin
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select project.*
    into v_project
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.id = p_project_id
   for share;

  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  if v_project.modules -> 'workers' is distinct from 'true'::jsonb then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  if v_name is null
     or pg_catalog.char_length(v_name) not between 1 and 120
  then
    raise exception 'invalid_worker_name' using errcode = '22023';
  end if;

  if p_daily_wage_minor is null or p_daily_wage_minor < 0 then
    raise exception 'invalid_daily_wage' using errcode = '22023';
  end if;

  insert into public.project_workers (
    workspace_id,
    project_id,
    name,
    phone,
    daily_wage_minor,
    created_by
  )
  values (
    p_workspace_id,
    p_project_id,
    v_name,
    nullif(pg_catalog.btrim(coalesce(p_phone, '')), ''),
    p_daily_wage_minor,
    auth.uid()
  )
  returning * into v_worker;

  return v_worker;
end;
$$;

-- This replaces the latest retry-safe implementation, not the earlier version.
create or replace function public.record_daily_work(
  p_workspace_id uuid,
  p_project_id uuid,
  p_worker_id uuid,
  p_work_date date,
  p_amount_minor bigint default null,
  p_note text default null,
  p_client_id uuid default extensions.gen_random_uuid()
)
returns public.project_work_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_worker public.project_workers%rowtype;
  v_workspace public.workspaces%rowtype;
  v_amount bigint;
  v_currency_code text;
  v_note text := nullif(
    pg_catalog.btrim(coalesce(p_note, '')),
    ''
  );
  v_log public.project_work_logs%rowtype;
  v_payload jsonb;
  v_payload_hash bytea;
  v_legacy_payload jsonb;
  v_legacy_payload_hash bytea;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_client_id is null
     or p_project_id is null
     or p_worker_id is null
     or p_work_date is null
  then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if p_amount_minor is not null and p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':' || p_client_id::text
        || ':record_daily_work',
      0
    )
  );

  select log.*
    into v_log
    from public.project_work_logs as log
   where log.workspace_id = p_workspace_id
     and log.client_id = p_client_id
     and log.operation = 'record_daily_work';

  if found then
    v_amount := coalesce(p_amount_minor, v_log.amount_minor);
    v_currency_code := v_log.currency_code;

    v_payload := pg_catalog.jsonb_build_object(
      'amount_minor',
      v_amount,
      'currency_code',
      v_currency_code,
      'entry_type',
      'daily_wage',
      'fingerprint_version',
      2,
      'note',
      v_note,
      'project_id',
      p_project_id,
      'work_date',
      p_work_date,
      'worker_id',
      p_worker_id
    );
    v_payload_hash := private.payload_hash(v_payload);

    -- Version 1 omitted project, currency, and note. It is accepted only when
    -- every omitted material field still matches the immutable stored row.
    v_legacy_payload := pg_catalog.jsonb_build_object(
      'worker_id',
      p_worker_id,
      'work_date',
      p_work_date,
      'amount_minor',
      v_amount,
      'entry_type',
      'daily_wage'
    );
    v_legacy_payload_hash := private.payload_hash(v_legacy_payload);

    if v_log.payload_hash = v_payload_hash then
      return v_log;
    end if;

    if v_log.payload_hash = v_legacy_payload_hash
       and v_log.project_id = p_project_id
       and v_log.worker_id = p_worker_id
       and v_log.entry_type = 'daily_wage'
       and v_log.work_date = p_work_date
       and v_log.amount_minor = v_amount
       and v_log.note is not distinct from v_note
    then
      return v_log;
    end if;

    raise exception 'idempotency_conflict' using errcode = 'PT409';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select project.*
    into v_project
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.id = p_project_id
     and project.status = 'active'
   for share;

  if not found then
    raise exception 'active_project_not_found' using errcode = 'P0002';
  end if;

  if v_project.modules -> 'workers' is distinct from 'true'::jsonb then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  select worker.*
    into v_worker
    from public.project_workers as worker
   where worker.workspace_id = p_workspace_id
     and worker.id = p_worker_id
     and worker.project_id = p_project_id
     and worker.status = 'active'
   for share;

  if not found then
    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;

  select workspace.*
    into v_workspace
    from public.workspaces as workspace
   where workspace.id = p_workspace_id;

  if not found then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  v_currency_code := v_workspace.default_currency_code;
  if not exists (
    select 1
    from public.currencies as currency
    where currency.code = v_currency_code
      and currency.is_active
  ) then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  v_amount := coalesce(p_amount_minor, v_worker.daily_wage_minor);
  if v_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'amount_minor',
    v_amount,
    'currency_code',
    v_currency_code,
    'entry_type',
    'daily_wage',
    'fingerprint_version',
    2,
    'note',
    v_note,
    'project_id',
    p_project_id,
    'work_date',
    p_work_date,
    'worker_id',
    p_worker_id
  );
  v_payload_hash := private.payload_hash(v_payload);

  insert into public.project_work_logs (
    workspace_id,
    project_id,
    worker_id,
    entry_type,
    work_date,
    amount_minor,
    currency_code,
    note,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    p_workspace_id,
    p_project_id,
    p_worker_id,
    'daily_wage',
    p_work_date,
    v_amount,
    v_currency_code,
    v_note,
    v_user_id,
    p_client_id,
    'record_daily_work',
    v_payload_hash
  )
  returning * into v_log;

  return v_log;
end;
$$;

-- This replaces the latest retry-safe implementation, including its independent
-- transaction client id for wallet withdrawals.
create or replace function public.post_wage_movement(
  p_workspace_id uuid,
  p_project_id uuid,
  p_worker_id uuid,
  p_entry_type public.work_log_entry_type,
  p_amount_minor bigint,
  p_work_date date default (
    pg_catalog.timezone('utc', pg_catalog.now())
  )::date,
  p_wallet_id uuid default null,
  p_note text default null,
  p_client_id uuid default extensions.gen_random_uuid()
)
returns public.project_work_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_worker public.project_workers%rowtype;
  v_workspace public.workspaces%rowtype;
  v_signed bigint;
  v_currency_code text;
  v_note text := nullif(
    pg_catalog.btrim(coalesce(p_note, '')),
    ''
  );
  v_operation text;
  v_event_id uuid;
  v_category_id uuid;
  v_category_active boolean;
  v_log public.project_work_logs%rowtype;
  v_payload jsonb;
  v_payload_hash bytea;
  v_legacy_payload jsonb;
  v_legacy_payload_hash bytea;
  v_balance numeric;
  v_tx_client_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_client_id is null
     or p_project_id is null
     or p_worker_id is null
     or p_work_date is null
  then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if p_entry_type is null
     or p_entry_type not in (
       'bonus',
       'deduction',
       'withdrawal',
       'adjustment'
     )
  then
    raise exception 'invalid_entry_type' using errcode = '22023';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  if p_entry_type = 'withdrawal' and p_wallet_id is null then
    raise exception 'wallet_required' using errcode = '22023';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  v_operation := case p_entry_type
    when 'bonus' then 'post_wage_bonus'
    when 'deduction' then 'post_wage_deduction'
    when 'withdrawal' then 'post_wage_withdrawal'
    else 'post_wage_adjustment'
  end;

  v_signed := case
    when p_entry_type in ('bonus', 'adjustment') then p_amount_minor
    else -p_amount_minor
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':' || p_client_id::text
        || ':' || v_operation,
      0
    )
  );

  select log.*
    into v_log
    from public.project_work_logs as log
   where log.workspace_id = p_workspace_id
     and log.client_id = p_client_id
     and log.operation = v_operation;

  if found then
    v_currency_code := v_log.currency_code;
    v_payload := pg_catalog.jsonb_build_object(
      'amount_minor',
      p_amount_minor,
      'currency_code',
      v_currency_code,
      'entry_type',
      p_entry_type,
      'fingerprint_version',
      2,
      'note',
      v_note,
      'project_id',
      p_project_id,
      'wallet_id',
      p_wallet_id,
      'work_date',
      p_work_date,
      'worker_id',
      p_worker_id
    );
    v_payload_hash := private.payload_hash(v_payload);

    -- Version 1 omitted project, currency, and note. Its original hash still
    -- proves wallet and amount; omitted fields must match the immutable row.
    v_legacy_payload := pg_catalog.jsonb_build_object(
      'worker_id',
      p_worker_id,
      'entry_type',
      p_entry_type,
      'amount_minor',
      p_amount_minor,
      'work_date',
      p_work_date,
      'wallet_id',
      p_wallet_id
    );
    v_legacy_payload_hash := private.payload_hash(v_legacy_payload);

    if v_log.payload_hash = v_payload_hash then
      return v_log;
    end if;

    if v_log.payload_hash = v_legacy_payload_hash
       and v_log.project_id = p_project_id
       and v_log.worker_id = p_worker_id
       and v_log.entry_type = p_entry_type
       and v_log.work_date = p_work_date
       and v_log.amount_minor = v_signed
       and v_log.note is not distinct from v_note
    then
      return v_log;
    end if;

    raise exception 'idempotency_conflict' using errcode = 'PT409';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select project.*
    into v_project
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.id = p_project_id
     and project.status = 'active'
   for share;

  if not found then
    raise exception 'active_project_not_found' using errcode = 'P0002';
  end if;

  if v_project.modules -> 'workers' is distinct from 'true'::jsonb then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  -- Every balance-changing operation for a worker takes the same row lock.
  -- Different idempotency keys therefore cannot pass the balance check at once.
  select worker.*
    into v_worker
    from public.project_workers as worker
   where worker.workspace_id = p_workspace_id
     and worker.id = p_worker_id
     and worker.project_id = p_project_id
   for update;

  if not found then
    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;

  select workspace.*
    into v_workspace
    from public.workspaces as workspace
   where workspace.id = p_workspace_id;

  if not found then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  v_currency_code := v_workspace.default_currency_code;
  if not exists (
    select 1
    from public.currencies as currency
    where currency.code = v_currency_code
      and currency.is_active
  ) then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'amount_minor',
    p_amount_minor,
    'currency_code',
    v_currency_code,
    'entry_type',
    p_entry_type,
    'fingerprint_version',
    2,
    'note',
    v_note,
    'project_id',
    p_project_id,
    'wallet_id',
    p_wallet_id,
    'work_date',
    p_work_date,
    'worker_id',
    p_worker_id
  );
  v_payload_hash := private.payload_hash(v_payload);

  select coalesce(sum(log.amount_minor::numeric), 0)
    into v_balance
    from public.project_work_logs as log
   where log.workspace_id = p_workspace_id
     and log.worker_id = p_worker_id;

  if p_entry_type in ('withdrawal', 'deduction')
     and (v_balance - p_amount_minor) < 0
  then
    raise exception 'insufficient_worker_balance' using errcode = 'PT409';
  end if;

  if p_entry_type = 'withdrawal' then
    insert into public.categories (
      workspace_id,
      kind,
      name,
      is_system,
      is_active,
      created_by
    )
    values (
      p_workspace_id,
      'expense',
      'أجور يومية',
      true,
      true,
      v_user_id
    )
    on conflict (
      workspace_id,
      kind,
      (pg_catalog.lower(pg_catalog.btrim(name)))
    )
    do nothing
    returning id into v_category_id;

    if not found then
      select category.id, category.is_active
        into v_category_id, v_category_active
        from public.categories as category
       where category.workspace_id = p_workspace_id
         and category.kind = 'expense'
         and pg_catalog.lower(pg_catalog.btrim(category.name)) =
           pg_catalog.lower(pg_catalog.btrim('أجور يومية'))
       for update;

      if not found then
        raise exception 'wage_category_conflict' using errcode = 'PT409';
      end if;

      if not v_category_active then
        update public.categories
           set is_active = true
         where workspace_id = p_workspace_id
           and id = v_category_id
        returning is_active into v_category_active;

        if not found or not v_category_active then
          raise exception 'wage_category_conflict' using errcode = 'PT409';
        end if;
      end if;
    end if;

    v_tx_client_id := extensions.gen_random_uuid();
    v_event_id := public.post_transaction(
      p_workspace_id := p_workspace_id,
      p_client_id := v_tx_client_id,
      p_wallet_id := p_wallet_id,
      p_kind := 'expense'::public.transaction_kind,
      p_amount_minor := p_amount_minor,
      p_occurred_at := p_work_date::timestamptz,
      p_description := coalesce(
        v_note,
        'سحب أجر عامل: ' || v_worker.name
      ),
      p_category_id := v_category_id,
      p_project_id := p_project_id
    );
  end if;

  insert into public.project_work_logs (
    workspace_id,
    project_id,
    worker_id,
    entry_type,
    work_date,
    amount_minor,
    currency_code,
    note,
    financial_event_id,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    p_workspace_id,
    p_project_id,
    p_worker_id,
    p_entry_type,
    p_work_date,
    v_signed,
    v_currency_code,
    v_note,
    v_event_id,
    v_user_id,
    p_client_id,
    v_operation,
    v_payload_hash
  )
  returning * into v_log;

  return v_log;
end;
$$;

create function public.post_capital_entry(
  p_workspace_id uuid,
  p_project_id uuid,
  p_entry_type public.project_capital_entry_type,
  p_amount_minor bigint,
  p_currency_code text default null,
  p_note text default null,
  p_occurred_on date default (
    pg_catalog.timezone('utc', pg_catalog.now())
  )::date,
  p_client_id uuid default extensions.gen_random_uuid()
)
returns public.project_capital_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype;
  v_currency_code text;
  v_requested_currency_code text := nullif(
    pg_catalog.upper(pg_catalog.btrim(coalesce(p_currency_code, ''))),
    ''
  );
  v_note text := nullif(
    pg_catalog.btrim(coalesce(p_note, '')),
    ''
  );
  v_payload jsonb;
  v_payload_hash bytea;
  v_entry public.project_capital_entries%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_client_id is null
     or p_project_id is null
     or p_occurred_on is null
  then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if p_entry_type is null
     or p_amount_minor is null
     or p_amount_minor = 0
  then
    raise exception 'invalid_capital_amount' using errcode = '22023';
  end if;

  if not (
    (
      p_entry_type in ('opening', 'contribution')
      and p_amount_minor > 0
    )
    or
    (
      p_entry_type = 'withdrawal'
      and p_amount_minor < 0
    )
    or
    (
      p_entry_type = 'adjustment'
      and p_amount_minor <> 0
    )
  ) then
    raise exception 'invalid_capital_sign' using errcode = '22023';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':' || p_client_id::text
        || ':post_capital_entry',
      0
    )
  );

  select entry.*
    into v_entry
    from public.project_capital_entries as entry
   where entry.workspace_id = p_workspace_id
     and entry.client_id = p_client_id
     and entry.operation = 'post_capital_entry';

  if found then
    v_currency_code := coalesce(
      v_requested_currency_code,
      v_entry.currency_code
    );
    v_payload := pg_catalog.jsonb_build_object(
      'amount_minor',
      p_amount_minor,
      'currency_code',
      v_currency_code,
      'entry_type',
      p_entry_type,
      'note',
      v_note,
      'occurred_on',
      p_occurred_on,
      'project_id',
      p_project_id
    );
    v_payload_hash := private.payload_hash(v_payload);

    if v_entry.payload_hash is distinct from v_payload_hash then
      raise exception 'idempotency_conflict' using errcode = 'PT409';
    end if;
    return v_entry;
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select project.*
    into v_project
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.id = p_project_id
     and project.status = 'active'
   for share;

  if not found then
    raise exception 'active_project_not_found' using errcode = 'P0002';
  end if;

  if v_project.modules -> 'capital' is distinct from 'true'::jsonb then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  select workspace.*
    into v_workspace
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
     and workspace.status = 'active';

  if not found then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  v_currency_code := coalesce(
    v_requested_currency_code,
    v_workspace.default_currency_code
  );

  if not exists (
    select 1
    from public.currencies as currency
    where currency.code = v_currency_code
      and currency.is_active
  ) then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'amount_minor',
    p_amount_minor,
    'currency_code',
    v_currency_code,
    'entry_type',
    p_entry_type,
    'note',
    v_note,
    'occurred_on',
    p_occurred_on,
    'project_id',
    p_project_id
  );
  v_payload_hash := private.payload_hash(v_payload);

  insert into public.project_capital_entries (
    workspace_id,
    project_id,
    entry_type,
    amount_minor,
    currency_code,
    note,
    occurred_on,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    p_workspace_id,
    p_project_id,
    p_entry_type,
    p_amount_minor,
    v_currency_code,
    v_note,
    p_occurred_on,
    v_user_id,
    p_client_id,
    'post_capital_entry',
    v_payload_hash
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

create function public.upsert_inventory_item(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text,
  p_quantity numeric,
  p_unit_label text,
  p_currency_code text,
  p_unit_cost_minor bigint default null,
  p_item_id uuid default null
)
returns public.project_inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype;
  v_name text := pg_catalog.btrim(p_name);
  v_unit_label text := pg_catalog.btrim(p_unit_label);
  v_currency_code text;
  v_item public.project_inventory_items%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select workspace.*
    into v_workspace
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
     and workspace.status = 'active';

  if not found then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  select project.*
    into v_project
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.id = p_project_id
     and project.status = 'active'
   for share;

  if not found then
    raise exception 'active_project_not_found' using errcode = 'P0002';
  end if;

  if v_project.modules -> 'inventory' is distinct from 'true'::jsonb then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  if v_name is null
     or pg_catalog.char_length(v_name) not between 1 and 160
  then
    raise exception 'invalid_inventory_name' using errcode = '22023';
  end if;

  if p_quantity is null
     or p_quantity < 0
     or p_quantity = 'NaN'::numeric
     or p_quantity = 'Infinity'::numeric
  then
    raise exception 'invalid_inventory_quantity' using errcode = '22023';
  end if;

  if v_unit_label is null
     or pg_catalog.char_length(v_unit_label) not between 1 and 40
  then
    raise exception 'invalid_unit_label' using errcode = '22023';
  end if;

  if p_unit_cost_minor is not null and p_unit_cost_minor < 0 then
    raise exception 'invalid_unit_cost' using errcode = '22023';
  end if;

  v_currency_code := pg_catalog.upper(
    coalesce(
      nullif(pg_catalog.btrim(coalesce(p_currency_code, '')), ''),
      v_workspace.default_currency_code
    )
  );

  if not exists (
    select 1
    from public.currencies as currency
    where currency.code = v_currency_code
      and currency.is_active
  ) then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':' || p_project_id::text
        || ':inventory:' || pg_catalog.lower(v_name),
      0
    )
  );

  if p_item_id is null then
    select item.*
      into v_item
      from public.project_inventory_items as item
     where item.workspace_id = p_workspace_id
       and item.project_id = p_project_id
       and item.status = 'active'
       and pg_catalog.lower(pg_catalog.btrim(item.name))
         = pg_catalog.lower(v_name)
     for update;

    if found then
      update public.project_inventory_items
         set name = v_name,
             quantity = p_quantity,
             unit_label = v_unit_label,
             unit_cost_minor = p_unit_cost_minor,
             currency_code = v_currency_code
       where workspace_id = p_workspace_id
         and id = v_item.id
      returning * into v_item;
    else
      insert into public.project_inventory_items (
        workspace_id,
        project_id,
        name,
        quantity,
        unit_label,
        unit_cost_minor,
        currency_code,
        status,
        created_by
      )
      values (
        p_workspace_id,
        p_project_id,
        v_name,
        p_quantity,
        v_unit_label,
        p_unit_cost_minor,
        v_currency_code,
        'active',
        v_user_id
      )
      returning * into v_item;
    end if;
  else
    select item.*
      into v_item
      from public.project_inventory_items as item
     where item.workspace_id = p_workspace_id
       and item.project_id = p_project_id
       and item.id = p_item_id
     for update;

    if not found then
      raise exception 'inventory_item_not_found' using errcode = 'P0002';
    end if;

    if v_item.status <> 'active' then
      raise exception 'inventory_item_archived' using errcode = 'PT409';
    end if;

    update public.project_inventory_items
       set name = v_name,
           quantity = p_quantity,
           unit_label = v_unit_label,
           unit_cost_minor = p_unit_cost_minor,
           currency_code = v_currency_code
     where workspace_id = p_workspace_id
       and id = p_item_id
    returning * into v_item;
  end if;

  return v_item;
end;
$$;

-- Preserve the convenient legacy signature; omitted currency uses the
-- workspace default. The currency-aware overload has a required text argument,
-- so named PostgREST calls remain unambiguous.
create function public.upsert_inventory_item(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text,
  p_quantity numeric,
  p_unit_label text,
  p_unit_cost_minor bigint default null,
  p_item_id uuid default null
)
returns public.project_inventory_items
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.upsert_inventory_item(
    p_workspace_id => p_workspace_id,
    p_project_id => p_project_id,
    p_name => p_name,
    p_quantity => p_quantity,
    p_unit_label => p_unit_label,
    p_currency_code => null,
    p_unit_cost_minor => p_unit_cost_minor,
    p_item_id => p_item_id
  );
end;
$$;

comment on function public.upsert_inventory_item(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  bigint,
  uuid
) is
  'Currency-aware inventory upsert; PostgREST callers should send p_currency_code.';
comment on function public.upsert_inventory_item(
  uuid,
  uuid,
  text,
  numeric,
  text,
  bigint,
  uuid
) is
  'Compatibility inventory upsert; currency defaults to the workspace currency.';

create function public.archive_inventory_item(
  p_workspace_id uuid,
  p_project_id uuid,
  p_item_id uuid
)
returns public.project_inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_item public.project_inventory_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select project.*
    into v_project
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.id = p_project_id
     and project.status = 'active'
   for share;

  if not found then
    raise exception 'active_project_not_found' using errcode = 'P0002';
  end if;

  if v_project.modules -> 'inventory' is distinct from 'true'::jsonb then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  select item.*
    into v_item
    from public.project_inventory_items as item
   where item.workspace_id = p_workspace_id
     and item.project_id = p_project_id
     and item.id = p_item_id
   for update;

  if not found then
    raise exception 'inventory_item_not_found' using errcode = 'P0002';
  end if;

  if v_item.status = 'active' then
    update public.project_inventory_items
       set status = 'archived'
     where workspace_id = p_workspace_id
       and id = p_item_id
    returning * into v_item;
  end if;

  return v_item;
end;
$$;

-- Explicit API exposure. The two new tables are read-only to authenticated
-- clients; every mutation is performed by the hardened RPCs above.
revoke all on table public.project_capital_entries
  from public, anon, authenticated;
revoke all on table public.project_inventory_items
  from public, anon, authenticated;
revoke all on table public.project_capital_totals
  from public, anon, authenticated;
revoke all on table public.project_inventory_totals
  from public, anon, authenticated;
revoke all on table public.project_summaries
  from public, anon, authenticated;
revoke all on table public.project_financial_totals
  from public, anon, authenticated;
revoke all on table public.project_labor_summaries
  from public, anon, authenticated;
revoke all on table public.project_worker_balance_details
  from public, anon, authenticated;
revoke all on table public.project_work_log_details
  from public, anon, authenticated;
revoke all on table public.project_capital_entry_details
  from public, anon, authenticated;
revoke all on table public.project_inventory_item_details
  from public, anon, authenticated;
revoke all on table public.financial_event_details
  from public, anon, authenticated;

grant select on public.project_capital_entries to authenticated;
grant select on public.project_inventory_items to authenticated;
grant select on public.project_capital_totals to authenticated;
grant select on public.project_inventory_totals to authenticated;
grant select on public.project_summaries to authenticated;
grant select on public.project_financial_totals to authenticated;
grant select on public.project_labor_summaries to authenticated;
grant select on public.project_worker_balance_details to authenticated;
grant select on public.project_work_log_details to authenticated;
grant select on public.project_capital_entry_details to authenticated;
grant select on public.project_inventory_item_details to authenticated;
grant select on public.financial_event_details to authenticated;

-- Project worker mutations are RPC-only so module checks cannot be bypassed.
drop policy if exists project_workers_insert_writer
  on public.project_workers;
drop policy if exists project_workers_update_writer
  on public.project_workers;
revoke all on table public.project_workers
  from public, anon, authenticated;
grant select on public.project_workers to authenticated;

revoke all on function public.create_project(
  uuid,
  text,
  text,
  bigint,
  text,
  public.project_status,
  uuid
) from public, anon, authenticated;
revoke all on function public.create_project(
  uuid,
  text,
  text,
  jsonb,
  text,
  bigint,
  text,
  public.project_status,
  uuid,
  bigint,
  jsonb
) from public, anon, authenticated;
revoke all on function public.update_project(
  uuid,
  uuid,
  text,
  text,
  bigint,
  text,
  public.project_status
) from public, anon, authenticated;
revoke all on function public.update_project(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  bigint,
  text,
  public.project_status,
  boolean
) from public, anon, authenticated;
revoke all on function public.create_project_worker(
  uuid,
  uuid,
  text,
  bigint,
  text
) from public, anon, authenticated;
revoke all on function public.record_daily_work(
  uuid,
  uuid,
  uuid,
  date,
  bigint,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.post_wage_movement(
  uuid,
  uuid,
  uuid,
  public.work_log_entry_type,
  bigint,
  date,
  uuid,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.post_capital_entry(
  uuid,
  uuid,
  public.project_capital_entry_type,
  bigint,
  text,
  text,
  date,
  uuid
) from public, anon, authenticated;
revoke all on function public.upsert_inventory_item(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  bigint,
  uuid
) from public, anon, authenticated;
revoke all on function public.upsert_inventory_item(
  uuid,
  uuid,
  text,
  numeric,
  text,
  bigint,
  uuid
) from public, anon, authenticated;
revoke all on function public.archive_inventory_item(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.create_project(
  uuid,
  text,
  text,
  bigint,
  text,
  public.project_status,
  uuid
) to authenticated;
grant execute on function public.create_project(
  uuid,
  text,
  text,
  jsonb,
  text,
  bigint,
  text,
  public.project_status,
  uuid,
  bigint,
  jsonb
) to authenticated;
grant execute on function public.update_project(
  uuid,
  uuid,
  text,
  text,
  bigint,
  text,
  public.project_status
) to authenticated;
grant execute on function public.update_project(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  text,
  bigint,
  text,
  public.project_status,
  boolean
) to authenticated;
grant execute on function public.create_project_worker(
  uuid,
  uuid,
  text,
  bigint,
  text
) to authenticated;
grant execute on function public.record_daily_work(
  uuid,
  uuid,
  uuid,
  date,
  bigint,
  text,
  uuid
) to authenticated;
grant execute on function public.post_wage_movement(
  uuid,
  uuid,
  uuid,
  public.work_log_entry_type,
  bigint,
  date,
  uuid,
  text,
  uuid
) to authenticated;
grant execute on function public.post_capital_entry(
  uuid,
  uuid,
  public.project_capital_entry_type,
  bigint,
  text,
  text,
  date,
  uuid
) to authenticated;
grant execute on function public.upsert_inventory_item(
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  bigint,
  uuid
) to authenticated;
grant execute on function public.upsert_inventory_item(
  uuid,
  uuid,
  text,
  numeric,
  text,
  bigint,
  uuid
) to authenticated;
grant execute on function public.archive_inventory_item(uuid, uuid, uuid)
  to authenticated;
