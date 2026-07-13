begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select no_plan();

-- Schemas and core tables.
select has_schema('private', 'private helper schema exists');
select has_schema('audit', 'audit schema exists');

select has_table('public', 'currencies', 'currencies table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'workspaces', 'workspaces table exists');
select has_table('public', 'workspace_members', 'workspace_members table exists');
select has_table('public', 'wallets', 'wallets table exists');
select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'categories', 'categories table exists');
select has_table('public', 'ledger_accounts', 'ledger_accounts table exists');
select has_table('public', 'financial_events', 'financial_events table exists');
select has_table('public', 'ledger_entries', 'ledger_entries table exists');
select has_table('public', 'subscription_plans', 'subscription_plans table exists');
select has_table('public', 'workspace_subscriptions', 'workspace_subscriptions table exists');
select has_table('public', 'payment_requests', 'payment_requests table exists');
select has_table('public', 'subscription_events', 'subscription_events table exists');
select has_table('public', 'notifications', 'notifications table exists');
select has_table('public', 'project_workers', 'project_workers table exists');
select has_table('public', 'project_work_logs', 'project_work_logs table exists');
select has_table(
  'public',
  'project_capital_entries',
  'project capital entries table exists'
);
select has_table(
  'public',
  'project_inventory_items',
  'project inventory items table exists'
);
select has_table(
  'private',
  'project_creation_idempotency',
  'private project creation idempotency state exists'
);
select has_view('public', 'wallet_balances', 'wallet_balances view exists');
select has_view(
  'public',
  'visible_financial_events',
  'visible_financial_events view exists'
);
select has_view(
  'public',
  'financial_event_details',
  'exact-money financial event detail view exists'
);
select has_view('public', 'project_totals', 'project_totals view exists');
select has_view(
  'public',
  'project_worker_balances',
  'project_worker_balances view exists'
);
select has_view(
  'public',
  'project_labor_totals',
  'project_labor_totals view exists'
);
select has_view(
  'public',
  'project_capital_totals',
  'project capital totals view exists'
);
select has_view(
  'public',
  'project_inventory_totals',
  'project inventory totals view exists'
);
select has_view(
  'public',
  'project_summaries',
  'exact-money project summaries view exists'
);
select has_view(
  'public',
  'project_financial_totals',
  'exact-money project financial totals view exists'
);
select has_view(
  'public',
  'project_labor_summaries',
  'exact-money project labor summaries view exists'
);
select has_view(
  'public',
  'project_capital_entry_details',
  'exact-money project capital detail view exists'
);
select has_view(
  'public',
  'project_inventory_item_details',
  'exact-money project inventory detail view exists'
);
select has_view(
  'public',
  'project_worker_balance_details',
  'exact-money project worker balance view exists'
);
select has_view(
  'public',
  'project_work_log_details',
  'exact-money project work-log detail view exists'
);
select has_column(
  'public',
  'project_inventory_totals',
  'currency_code',
  'inventory totals are partitioned by currency'
);
select has_view(
  'public',
  'supervisor_platform_stats',
  'supervisor_platform_stats view exists'
);

-- Monetary storage and reference data.
select col_type_is(
  'public',
  'ledger_entries',
  'amount_minor',
  'bigint',
  'ledger amounts use bigint minor units'
);
select col_type_is(
  'public',
  'financial_event_details',
  'amount_minor',
  'text',
  'financial event detail amounts are exact decimal text'
);
select has_column(
  'public',
  'financial_event_details',
  'effective_event_type',
  'financial event details expose reversal-effective event types'
);
select col_type_is(
  'public',
  'financial_event_details',
  'is_reversal',
  'boolean',
  'financial event details identify reversal rows explicitly'
);
select col_type_is(
  'public',
  'subscription_plans',
  'price_minor',
  'bigint',
  'plan prices use bigint minor units'
);
select hasnt_column(
  'public',
  'wallets',
  'balance_minor',
  'wallets do not store an authoritative balance'
);
select has_column(
  'public',
  'projects',
  'project_type',
  'projects expose a constrained blueprint type'
);
select col_type_is(
  'public',
  'projects',
  'project_type',
  'text',
  'project type remains API-friendly text'
);
select col_not_null(
  'public',
  'projects',
  'project_type',
  'project type is required'
);
select has_column(
  'public',
  'projects',
  'modules',
  'projects expose module configuration'
);
select col_type_is(
  'public',
  'projects',
  'modules',
  'jsonb',
  'project modules use jsonb'
);
select col_not_null(
  'public',
  'projects',
  'modules',
  'project modules are required'
);
select col_type_is(
  'public',
  'project_capital_entries',
  'amount_minor',
  'bigint',
  'capital amounts use bigint minor units'
);
select col_type_is(
  'public',
  'project_inventory_items',
  'quantity',
  'numeric',
  'inventory quantity uses exact numeric storage'
);
select col_type_is(
  'public',
  'project_inventory_items',
  'currency_code',
  'text',
  'inventory costs identify their currency'
);
select col_not_null(
  'public',
  'project_inventory_items',
  'currency_code',
  'inventory currency is required'
);
select results_eq(
  $$select table_name || '.' || column_name || ':' || data_type
      from information_schema.columns
     where table_schema = 'public'
       and (table_name, column_name) in (
         ('project_summaries', 'goal_minor'),
         ('project_financial_totals', 'income_minor'),
         ('project_financial_totals', 'expense_minor'),
         ('project_financial_totals', 'net_minor'),
         ('project_labor_summaries', 'outstanding_minor'),
         ('project_labor_summaries', 'earned_minor'),
         ('project_labor_summaries', 'withdrawn_minor'),
         ('project_labor_summaries', 'deducted_minor'),
         ('project_capital_entry_details', 'amount_minor'),
         ('project_inventory_item_details', 'unit_cost_minor'),
         ('project_worker_balance_details', 'daily_wage_minor'),
         ('project_worker_balance_details', 'balance_minor'),
         ('project_worker_balance_details', 'earned_minor'),
         ('project_worker_balance_details', 'withdrawn_minor'),
         ('project_worker_balance_details', 'deducted_minor'),
         ('project_work_log_details', 'amount_minor')
       )
     order by table_name, column_name$$,
  array[
    'project_capital_entry_details.amount_minor:text',
    'project_financial_totals.expense_minor:text',
    'project_financial_totals.income_minor:text',
    'project_financial_totals.net_minor:text',
    'project_inventory_item_details.unit_cost_minor:text',
    'project_labor_summaries.deducted_minor:text',
    'project_labor_summaries.earned_minor:text',
    'project_labor_summaries.outstanding_minor:text',
    'project_labor_summaries.withdrawn_minor:text',
    'project_summaries.goal_minor:text',
    'project_work_log_details.amount_minor:text',
    'project_worker_balance_details.balance_minor:text',
    'project_worker_balance_details.daily_wage_minor:text',
    'project_worker_balance_details.deducted_minor:text',
    'project_worker_balance_details.earned_minor:text',
    'project_worker_balance_details.withdrawn_minor:text'
  ]::text[],
  'project API read views expose every touched monetary value as text'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_project_type_allowed'
      and contype = 'c'
  ),
  'project type allow-list constraint exists'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_modules_shape'
      and contype = 'c'
  ),
  'project modules shape constraint exists'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.project_capital_entries'::regclass
      and conname = 'project_capital_entries_signed_amount'
      and contype = 'c'
  ),
  'capital signed-amount constraint exists'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.project_inventory_items'::regclass
      and conname = 'project_inventory_items_quantity_nonnegative'
      and contype = 'c'
  ),
  'inventory nonnegative-quantity constraint exists'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.project_inventory_items'::regclass
      and conname = 'project_inventory_items_currency_fk'
      and contype = 'f'
  ),
  'inventory currency references the currencies table'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_index as index
    join pg_catalog.pg_class as relation
      on relation.oid = index.indexrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'project_inventory_items_active_name_unique'
      and index.indisunique
      and index.indpred is not null
  ),
  'active inventory names have a partial unique index'
);
select ok(
  to_regclass('public.project_inventory_items_currency_idx') is not null,
  'inventory currency filter has an index'
);
select ok(
  to_regclass('public.project_capital_entries_workspace_creator_idx')
    is not null
  and to_regclass('public.project_inventory_items_workspace_creator_idx')
    is not null
  and to_regclass('public.project_workers_workspace_creator_idx')
    is not null
  and to_regclass('public.project_work_logs_workspace_creator_idx')
    is not null,
  'project creator foreign-key filters have useful indexes'
);
select results_eq(
  $$select attribute.attname || case
         when (key.options & 1) = 1 then ':desc'
         else ':asc'
       end
      from pg_catalog.pg_index as index_metadata
      cross join lateral unnest(
        index_metadata.indkey::smallint[],
        index_metadata.indoption::smallint[]
      ) with ordinality as key(attnum, options, position)
      join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = index_metadata.indrelid
       and attribute.attnum = key.attnum
     where index_metadata.indexrelid =
       to_regclass('public.financial_events_project_history_keyset_idx')
       and key.position <= index_metadata.indnkeyatts
     order by key.position$$,
  array[
    'workspace_id:asc',
    'project_id:asc',
    'occurred_at:desc',
    'id:desc'
  ]::text[],
  'project history keyset pagination has a matching ordered index'
);
select results_eq(
  $$select code || ':' || minor_unit::text
      from public.currencies
     where code in ('LYD', 'USD', 'EUR')
     order by code$$,
  array['EUR:2', 'LYD:3', 'USD:2']::text[],
  'required currencies and minor units are seeded'
);
select results_eq(
  $$select trial_days
      from public.subscription_plans
     where code = 'trial'$$,
  array[14::smallint],
  'bootstrap trial lasts 14 days'
);

-- Every public application table has RLS enabled.
select ok(
  c.relrowsecurity,
  format('RLS enabled on public.%I', expected.table_name)
)
from (
  values
    ('currencies'),
    ('profiles'),
    ('workspaces'),
    ('workspace_members'),
    ('wallets'),
    ('projects'),
    ('categories'),
    ('ledger_accounts'),
    ('financial_events'),
    ('ledger_entries'),
    ('subscription_plans'),
    ('workspace_subscriptions'),
    ('payment_requests'),
    ('subscription_events'),
    ('notifications'),
    ('project_workers'),
    ('project_work_logs'),
    ('project_capital_entries'),
    ('project_inventory_items')
) as expected(table_name)
join pg_catalog.pg_class c
  on c.relname = expected.table_name
join pg_catalog.pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = 'public';

select ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'project_capital_entries'
      and policyname = 'project_capital_entries_select_member'
      and cmd = 'SELECT'
  ),
  'project capital entries have a member read policy'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'project_inventory_items'
      and policyname = 'project_inventory_items_select_member'
      and cmd = 'SELECT'
  ),
  'project inventory items have a member read policy'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'project_capital_entries',
        'project_inventory_items'
      )
      and cmd <> 'SELECT'
  ),
  'project blueprint tables expose no direct write policies'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'project_workers'
      and cmd <> 'SELECT'
  ),
  'project workers expose no direct write policies'
);

-- Profile updates are restricted to safe columns at the SQL grant layer.
select ok(
  pg_catalog.has_column_privilege(
    'authenticated',
    'public.profiles',
    'display_name',
    'UPDATE'
  ),
  'authenticated users may update display_name'
);
select ok(
  not pg_catalog.has_column_privilege(
    'authenticated',
    'public.profiles',
    'system_role',
    'UPDATE'
  ),
  'authenticated users cannot update system_role'
);
select ok(
  not pg_catalog.has_column_privilege(
    'authenticated',
    'public.profiles',
    'account_status',
    'UPDATE'
  ),
  'authenticated users cannot update account_status'
);

-- Posted finance is append-only to API clients.
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.financial_events', 'INSERT'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.financial_events', 'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.financial_events', 'DELETE'
  ),
  'authenticated users cannot directly mutate financial events'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.ledger_entries', 'INSERT'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.ledger_entries', 'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.ledger_entries', 'DELETE'
  ),
  'authenticated users cannot directly mutate ledger entries'
);

-- The deferred balancing constraints and immutable-row triggers are installed.
select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'financial_events'
      and t.tgname = 'financial_events_balanced'
      and t.tgdeferrable
  ),
  'financial event balance trigger is deferred'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'ledger_entries'
      and t.tgname = 'ledger_entries_balanced'
      and t.tgdeferrable
  ),
  'ledger entry balance trigger is deferred'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'financial_events'
      and t.tgname = 'financial_events_immutable'
  ),
  'financial event immutable trigger exists'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'financial_events'
      and t.tgname = 'financial_events_project_currency_guard'
  ),
  'project-linked financial events enforce the workspace base currency'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'project_work_logs'
      and t.tgname = 'project_work_logs_immutable'
  ),
  'project work logs are immutable'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'project_capital_entries'
      and t.tgname = 'project_capital_entries_immutable'
  ),
  'project capital entries are immutable'
);

-- API views must invoke the caller's RLS policies.
select ok(
  'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])),
  'wallet_balances is security invoker'
)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'wallet_balances';

select ok(
  'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])),
  'visible_financial_events is security invoker'
)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'visible_financial_events';

select ok(
  'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])),
  'financial_event_details is security invoker'
)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'financial_event_details';

select ok(
  'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])),
  'project_totals is security invoker'
)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'project_totals';

select ok(
  'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])),
  'project_capital_totals is security invoker'
)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'project_capital_totals';

select ok(
  'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])),
  'project_inventory_totals is security invoker'
)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'project_inventory_totals';

select results_eq(
  $$select c.relname
      from pg_catalog.pg_class as c
      join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in (
         'project_summaries',
         'project_financial_totals',
         'project_labor_summaries',
         'project_capital_entry_details',
         'project_inventory_item_details',
         'project_worker_balance_details',
         'project_work_log_details'
       )
       and 'security_invoker=true' = any(
         coalesce(c.reloptions, array[]::text[])
       )
     order by c.relname$$,
  array[
    'project_capital_entry_details',
    'project_financial_totals',
    'project_inventory_item_details',
    'project_labor_summaries',
    'project_summaries',
    'project_work_log_details',
    'project_worker_balance_details'
  ]::name[],
  'exact-money project read views all invoke caller RLS'
);

-- Required authenticated RPCs and private helpers.
select ok(
  pg_catalog.to_regprocedure(
    'public.create_wallet(uuid,uuid,text,text,bigint)'
  ) is not null,
  'create_wallet RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.post_transaction(uuid,uuid,uuid,public.transaction_kind,bigint,timestamp with time zone,text,uuid,uuid)'
  ) is not null,
  'post_transaction RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.post_transfer(uuid,uuid,uuid,uuid,bigint,timestamp with time zone,text)'
  ) is not null,
  'post_transfer RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.reverse_financial_event(uuid,uuid,uuid,timestamp with time zone,text)'
  ) is not null,
  'reverse_financial_event RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.create_payment_request(uuid,uuid,uuid,smallint,text)'
  ) is not null,
  'create_payment_request RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.review_payment_request(uuid,public.payment_review_decision,text)'
  ) is not null,
  'review_payment_request RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.attach_payment_proof(uuid,text)'
  ) is not null,
  'attach_payment_proof RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.record_daily_work(uuid,uuid,uuid,date,bigint,text,uuid)'
  ) is not null,
  'record_daily_work RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.post_wage_movement(uuid,uuid,uuid,public.work_log_entry_type,bigint,date,uuid,text,uuid)'
  ) is not null,
  'post_wage_movement RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.create_project(uuid,text,text,bigint,text,public.project_status,uuid)'
  ) is not null,
  'legacy create_project signature remains available'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.update_project(uuid,uuid,text,text,bigint,text,public.project_status)'
  ) is not null,
  'legacy update_project signature remains available'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.create_project(uuid,text,text,jsonb,text,bigint,text,public.project_status,uuid,bigint,jsonb)'
  ) is not null,
  'blueprint create_project overload exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.update_project(uuid,uuid,text,jsonb,text,text,bigint,text,public.project_status,boolean)'
  ) is not null,
  'blueprint update_project overload exists'
);
select is(
  (
    select pronargdefaults
    from pg_catalog.pg_proc
    where oid =
      'public.create_project(uuid,text,text,jsonb,text,bigint,text,public.project_status,uuid,bigint,jsonb)'::regprocedure
  ),
  7::smallint,
  'blueprint create keeps project type and modules required'
);
select is(
  (
    select pronargdefaults
    from pg_catalog.pg_proc
    where oid =
      'public.update_project(uuid,uuid,text,jsonb,text,text,bigint,text,public.project_status,boolean)'::regprocedure
  ),
  6::smallint,
  'blueprint update keeps project type and modules required'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.post_capital_entry(uuid,uuid,public.project_capital_entry_type,bigint,text,text,date,uuid)'
  ) is not null,
  'post_capital_entry RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.upsert_inventory_item(uuid,uuid,text,numeric,text,bigint,uuid)'
  ) is not null,
  'upsert_inventory_item RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.upsert_inventory_item(uuid,uuid,text,numeric,text,text,bigint,uuid)'
  ) is not null,
  'currency-aware upsert_inventory_item overload exists'
);
select results_eq(
  $$select pronargdefaults
      from pg_catalog.pg_proc
     where oid =
       'public.upsert_inventory_item(uuid,uuid,text,numeric,text,text,bigint,uuid)'::regprocedure$$,
  array[2::smallint],
  'currency-aware inventory overload requires its distinguishing currency argument'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.archive_inventory_item(uuid,uuid,uuid)'
  ) is not null,
  'archive_inventory_item RPC exists'
);
select ok(
  pg_catalog.to_regprocedure(
    'public.supervisor_freeze_workspace(uuid,text)'
  ) is not null,
  'supervisor_freeze_workspace RPC exists'
);

select has_function(
  'private',
  'is_supervisor',
  array[]::text[],
  'is_supervisor helper exists'
);
select has_function(
  'private',
  'is_workspace_member',
  array['uuid'],
  'is_workspace_member helper exists'
);
select has_function(
  'private',
  'has_workspace_role',
  array['uuid', 'public.workspace_role[]'],
  'has_workspace_role helper exists'
);
select has_function(
  'private',
  'can_write_workspace',
  array['uuid'],
  'can_write_workspace helper exists'
);
select has_function(
  'private',
  'has_current_entitlement',
  array['uuid'],
  'billing entitlement helper exists'
);

-- Anonymous clients cannot execute privileged RPCs; authenticated clients can.
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_wallet(uuid,uuid,text,text,bigint)',
    'EXECUTE'
  ),
  'anonymous users cannot execute create_wallet'
);
select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_wallet(uuid,uuid,text,text,bigint)',
    'EXECUTE'
  ),
  'authenticated users can execute create_wallet'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.record_daily_work(uuid,uuid,uuid,date,bigint,text,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot record daily work'
);
select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.record_daily_work(uuid,uuid,uuid,date,bigint,text,uuid)',
    'EXECUTE'
  ),
  'authenticated users can call record_daily_work'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.post_capital_entry(uuid,uuid,public.project_capital_entry_type,bigint,text,text,date,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.post_capital_entry(uuid,uuid,public.project_capital_entry_type,bigint,text,text,date,uuid)',
    'EXECUTE'
  ),
  'only authenticated clients can post capital entries'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.upsert_inventory_item(uuid,uuid,text,numeric,text,text,bigint,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.upsert_inventory_item(uuid,uuid,text,numeric,text,text,bigint,uuid)',
    'EXECUTE'
  ),
  'only authenticated clients can use currency-aware inventory upsert'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'public.post_wage_movement(uuid,uuid,uuid,public.work_log_entry_type,bigint,date,uuid,text,uuid)'::regprocedure
  ) ~* 'and worker[.]project_id = p_project_id[[:space:]]+for update'
  and pg_catalog.pg_get_functiondef(
    'public.post_wage_movement(uuid,uuid,uuid,public.work_log_entry_type,bigint,date,uuid,text,uuid)'::regprocedure
  ) !~* 'and worker[.]status',
  'wage movements lock workers without requiring active status'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_capital_entries', 'INSERT'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_capital_entries', 'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_capital_entries', 'DELETE'
  ),
  'authenticated clients cannot directly mutate project capital'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_inventory_items', 'INSERT'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_inventory_items', 'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_inventory_items', 'DELETE'
  ),
  'authenticated clients cannot directly mutate project inventory'
);
select ok(
  (
    select pg_catalog.bool_and(
      pg_catalog.has_table_privilege(
        'authenticated',
        'public.' || view_name,
        'SELECT'
      )
      and not pg_catalog.has_table_privilege(
        'anon',
        'public.' || view_name,
        'SELECT'
      )
    )
    from (
      values
        ('project_summaries'),
        ('project_financial_totals'),
        ('project_labor_summaries'),
        ('project_capital_entry_details'),
        ('project_inventory_item_details'),
        ('project_worker_balance_details'),
        ('project_work_log_details')
    ) as exact_view(view_name)
  ),
  'only authenticated clients can select exact-money project read views'
);
select ok(
  pg_catalog.has_table_privilege(
    'authenticated',
    'public.financial_event_details',
    'SELECT'
  )
  and not pg_catalog.has_table_privilege(
    'anon',
    'public.financial_event_details',
    'SELECT'
  )
  and not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) as privilege
    where namespace.nspname = 'public'
      and relation.relname = 'financial_event_details'
      and privilege.grantee = 0
      and privilege.privilege_type = 'SELECT'
  ),
  'only authenticated clients can select exact-money financial events'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_workers', 'INSERT'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_workers', 'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_workers', 'DELETE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated', 'public.project_workers', 'TRUNCATE'
  ),
  'authenticated clients cannot directly mutate project workers'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.supervisor_set_account_status(uuid,public.account_status,text)',
    'EXECUTE'
  ),
  'anonymous users cannot call supervisor account controls'
);

-- Helpers fail closed when there is no authenticated subject.
set local role authenticated;
select ok(not private.is_supervisor(), 'missing auth subject is not supervisor');
select ok(
  not private.is_workspace_member(
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'missing auth subject is not a workspace member'
);
select ok(
  not private.can_write_workspace(
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'missing auth subject cannot write a workspace'
);
reset role;

select ok(
  not private.payment_proof_path_is_valid('malformed/path.pdf'),
  'malformed payment proof paths are rejected'
);
select ok(
  not private.can_access_payment_proof('malformed/path.pdf', false),
  'malformed payment proof access fails closed without raising'
);

-- Auth bootstrap and private storage are present.
select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ),
  'auth bootstrap trigger exists'
);
select results_eq(
  $$select public::text || ':' || file_size_limit::text
      from storage.buckets
     where id = 'payment-proofs'$$,
  array['false:10485760']::text[],
  'payment proof bucket is private and limited to 10 MiB'
);

-- Worker mutations must fail before touching work data when the module is off.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000901'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'blueprint-schema-test@example.test',
  extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
  clock_timestamp(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Blueprint schema test"}'::jsonb,
  clock_timestamp(),
  clock_timestamp()
);

insert into public.projects (workspace_id, name, created_by)
select
  workspace.id,
  'Disabled workers module project',
  workspace.created_by
from public.workspaces as workspace
where workspace.created_by =
  '00000000-0000-0000-0000-000000000901'::uuid;

insert into public.project_workers (
  workspace_id,
  project_id,
  name,
  daily_wage_minor,
  created_by
)
select
  project.workspace_id,
  project.id,
  'Existing test worker',
  1000,
  project.created_by
from public.projects as project
where project.created_by =
  '00000000-0000-0000-0000-000000000901'::uuid
  and project.name = 'Disabled workers module project';

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000904'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'blueprint-category-member@example.test',
  extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
  clock_timestamp(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Blueprint category member"}'::jsonb,
  clock_timestamp(),
  clock_timestamp()
);

insert into public.workspace_members (
  workspace_id,
  user_id,
  role,
  status
)
select
  workspace.id,
  '00000000-0000-0000-0000-000000000904'::uuid,
  'member',
  'active'
from public.workspaces as workspace
where workspace.created_by =
  '00000000-0000-0000-0000-000000000901'::uuid;

insert into public.categories (
  workspace_id,
  name,
  kind,
  is_system,
  is_active,
  created_by
)
select
  workspace.id,
  seed.name,
  seed.kind::public.category_kind,
  false,
  seed.is_active,
  '00000000-0000-0000-0000-000000000904'::uuid
from public.workspaces as workspace
cross join (
  values
    ('Shared seed category', 'expense', true),
    ('Dormant seed category', 'income', false),
    ('  أجور يومية  ', 'expense', false)
) as seed(name, kind, is_active)
where workspace.created_by =
  '00000000-0000-0000-0000-000000000901'::uuid;

select is(
  (
    select project.project_type
    from public.projects as project
    where project.created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and project.name = 'Disabled workers module project'
  ),
  'general',
  'new projects default to the general type'
);
select is(
  (
    select project.modules
    from public.projects as project
    where project.created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and project.name = 'Disabled workers module project'
  ),
  '{
    "transactions": true,
    "goal": false,
    "workers": false,
    "capital": false,
    "inventory": false
  }'::jsonb,
  'new projects default to transactions-only modules'
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000901';
set local role authenticated;

select throws_ok(
  $$update public.project_workers
       set daily_wage_minor = 2000
     where created_by =
       '00000000-0000-0000-0000-000000000901'::uuid
       and name = 'Existing test worker'$$,
  '42501',
  'permission denied for table project_workers',
  'authenticated users cannot directly update project workers'
);
select throws_ok(
  $$select public.create_project_worker(
      (select id from public.workspaces where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid),
      (select id from public.projects where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
        and name = 'Disabled workers module project'),
      'Rejected test worker',
      1000,
      null
    )$$,
  'PT409',
  'module_disabled',
  'create_project_worker rejects a disabled workers module'
);
select throws_ok(
  $$select public.record_daily_work(
      (select id from public.workspaces where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid),
      (select id from public.projects where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
        and name = 'Disabled workers module project'),
      (select id from public.project_workers where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
        and name = 'Existing test worker'),
      current_date,
      1000,
      null,
      '00000000-0000-0000-0000-000000000902'::uuid
    )$$,
  'PT409',
  'module_disabled',
  'record_daily_work rejects a disabled workers module'
);
select throws_ok(
  $$select public.post_wage_movement(
      (select id from public.workspaces where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid),
      (select id from public.projects where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
        and name = 'Disabled workers module project'),
      (select id from public.project_workers where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
        and name = 'Existing test worker'),
      'bonus'::public.work_log_entry_type,
      1000,
      current_date,
      null,
      null,
      '00000000-0000-0000-0000-000000000903'::uuid
    )$$,
  'PT409',
  'module_disabled',
  'post_wage_movement rejects a disabled workers module'
);

select lives_ok(
  $$select public.create_project(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_name => 'Retry-safe blueprint project',
      p_project_type => 'goods',
      p_modules => '{
        "transactions": true,
        "goal": true,
        "workers": false,
        "capital": true,
        "inventory": true
      }'::jsonb,
      p_description => 'Blueprint behavior coverage',
      p_goal_minor => 5000,
      p_color_token => 'info',
      p_status => 'active',
      p_client_id =>
        '00000000-0000-0000-0000-000000000910'::uuid,
      p_opening_capital_minor => 10000,
      p_seed_categories => '[
        {"name":"Shared seed category","kind":"expense"},
        {"name":"Dormant seed category","kind":"income"},
        {"name":"General expense","kind":"expense"}
      ]'::jsonb
    )$$,
  'blueprint create reuses equivalent workspace categories'
);

select results_eq(
  $$select (public.create_project(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_name => 'Retry-safe blueprint project',
      p_project_type => 'goods',
      p_modules => '{
        "transactions": true,
        "goal": true,
        "workers": false,
        "capital": true,
        "inventory": true
      }'::jsonb,
      p_description => 'Blueprint behavior coverage',
      p_goal_minor => 5000,
      p_color_token => 'info',
      p_status => 'active',
      p_client_id =>
        '00000000-0000-0000-0000-000000000910'::uuid,
      p_opening_capital_minor => 10000,
      p_seed_categories => '[
        {"kind":"expense","name":"General expense"},
        {"kind":"income","name":"Dormant seed category"},
        {"kind":"expense","name":"Shared seed category"}
      ]'::jsonb
    )).id$$,
  $$select id
      from public.projects
     where created_by =
       '00000000-0000-0000-0000-000000000901'::uuid
       and name = 'Retry-safe blueprint project'$$,
  'matching project retries return the original project'
);

select is(
  (
    select count(*)
    from public.projects
    where created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and name = 'Retry-safe blueprint project'
  ),
  1::bigint,
  'project retry creates exactly one project'
);
select is(
  (
    select count(*)
    from public.project_capital_entries as entry
    join public.projects as project
      on project.workspace_id = entry.workspace_id
     and project.id = entry.project_id
    where project.created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and project.name = 'Retry-safe blueprint project'
      and entry.entry_type = 'opening'
  ),
  1::bigint,
  'project retry creates exactly one opening capital entry'
);
select is(
  (
    select count(*)
    from public.categories
    where workspace_id = (
      select id
      from public.workspaces
      where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
    )
      and kind = 'expense'
      and pg_catalog.lower(pg_catalog.btrim(name)) =
        'shared seed category'
  ),
  1::bigint,
  'existing equivalent category is not duplicated'
);
select is(
  (
    select created_by
    from public.categories
    where workspace_id = (
      select id
      from public.workspaces
      where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
    )
      and kind = 'expense'
      and pg_catalog.lower(pg_catalog.btrim(name)) =
        'shared seed category'
  ),
  '00000000-0000-0000-0000-000000000904'::uuid,
  'reused category keeps its original creator'
);
select ok(
  (
    select is_active
    from public.categories
    where workspace_id = (
      select id
      from public.workspaces
      where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
    )
      and kind = 'income'
      and pg_catalog.lower(pg_catalog.btrim(name)) =
        'dormant seed category'
  ),
  'inactive non-system seed category is reactivated'
);
select is(
  (
    select created_by
    from public.categories
    where workspace_id = (
      select id
      from public.workspaces
      where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
    )
      and kind = 'income'
      and pg_catalog.lower(pg_catalog.btrim(name)) =
        'dormant seed category'
  ),
  '00000000-0000-0000-0000-000000000904'::uuid,
  'reactivated category keeps its original creator'
);
select ok(
  (
    select is_system
    from public.categories
    where workspace_id = (
      select id
      from public.workspaces
      where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
    )
      and kind = 'expense'
      and pg_catalog.lower(pg_catalog.btrim(name)) =
        'general expense'
  ),
  'equivalent system category remains system-owned'
);

select throws_ok(
  $$select public.create_project(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_name => 'Mismatched retry payload',
      p_project_type => 'goods',
      p_modules => '{
        "transactions": true,
        "goal": true,
        "workers": false,
        "capital": true,
        "inventory": true
      }'::jsonb,
      p_description => 'Blueprint behavior coverage',
      p_goal_minor => 5000,
      p_color_token => 'info',
      p_status => 'active',
      p_client_id =>
        '00000000-0000-0000-0000-000000000910'::uuid,
      p_opening_capital_minor => 10000,
      p_seed_categories => '[
        {"name":"Shared seed category","kind":"expense"},
        {"name":"Dormant seed category","kind":"income"},
        {"name":"General expense","kind":"expense"}
      ]'::jsonb
    )$$,
  'PT409',
  'idempotency_conflict',
  'project retry rejects a mismatched payload'
);

select throws_ok(
  $$select public.post_capital_entry(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      'withdrawal'::public.project_capital_entry_type,
      100,
      null,
      null,
      current_date,
      '00000000-0000-0000-0000-000000000911'::uuid
    )$$,
  '22023',
  'invalid_capital_sign',
  'capital withdrawals require a negative signed amount'
);
select lives_ok(
  $$select public.post_capital_entry(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      'contribution'::public.project_capital_entry_type,
      200,
      'LYD',
      'Owner contribution',
      current_date,
      '00000000-0000-0000-0000-000000000912'::uuid
    )$$,
  'valid capital contribution can be posted'
);
select throws_ok(
  $$select public.post_capital_entry(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Disabled workers module project'
      ),
      'contribution'::public.project_capital_entry_type,
      200,
      'LYD',
      'Owner contribution',
      current_date,
      '00000000-0000-0000-0000-000000000912'::uuid
    )$$,
  'PT409',
  'idempotency_conflict',
  'capital retry rejects reuse for a different project before module checks'
);

select lives_ok(
  $$select public.upsert_inventory_item(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_project_id => (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      p_name => 'Feed',
      p_quantity => 2,
      p_unit_label => 'bag',
      p_unit_cost_minor => 250,
      p_item_id => null
    )$$,
  'legacy named inventory upsert remains unambiguous'
);
select lives_ok(
  $$select public.upsert_inventory_item(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      ' feed ',
      3,
      'bag',
      250,
      null
    )$$,
  'case-insensitive inventory upsert reuses the active item'
);
select lives_ok(
  $$select public.upsert_inventory_item(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_project_id => (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      p_name => 'Imported feed',
      p_quantity => 2,
      p_unit_label => 'crate',
      p_currency_code => 'usd',
      p_unit_cost_minor => 500,
      p_item_id => null
    )$$,
  'currency-aware inventory upsert accepts an active currency'
);
select is(
  (
    select count(*)
    from public.project_inventory_items as item
    join public.projects as project
      on project.workspace_id = item.workspace_id
     and project.id = item.project_id
    where project.created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and project.name = 'Retry-safe blueprint project'
      and pg_catalog.lower(pg_catalog.btrim(item.name)) = 'feed'
      and item.status = 'active'
  ),
  1::bigint,
  'active inventory names are case-insensitively unique'
);
select is(
  (
    select item.quantity
    from public.project_inventory_items as item
    join public.projects as project
      on project.workspace_id = item.workspace_id
     and project.id = item.project_id
    where project.created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and project.name = 'Retry-safe blueprint project'
      and pg_catalog.lower(pg_catalog.btrim(item.name)) = 'feed'
      and item.status = 'active'
  ),
  3::numeric,
  'inventory upsert updates the equivalent active item'
);
select is(
  (
    select item.currency_code
    from public.project_inventory_items as item
    join public.projects as project
      on project.workspace_id = item.workspace_id
     and project.id = item.project_id
    where project.created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and project.name = 'Retry-safe blueprint project'
      and pg_catalog.lower(pg_catalog.btrim(item.name)) = 'feed'
  ),
  'LYD',
  'legacy inventory upsert defaults to workspace currency'
);
select is(
  (
    select item.currency_code
    from public.project_inventory_items as item
    join public.projects as project
      on project.workspace_id = item.workspace_id
     and project.id = item.project_id
    where project.created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and project.name = 'Retry-safe blueprint project'
      and item.name = 'Imported feed'
  ),
  'USD',
  'inventory upsert normalizes explicit currency'
);
select results_eq(
  $$select
      total.currency_code
        || ':' || total.item_count::text
        || ':' || total.inventory_value_minor
      from public.project_inventory_totals as total
      join public.projects as project
        on project.workspace_id = total.workspace_id
       and project.id = total.project_id
     where project.created_by =
       '00000000-0000-0000-0000-000000000901'::uuid
       and project.name = 'Retry-safe blueprint project'
     order by total.currency_code$$,
  array['LYD:1:750', 'USD:1:1000']::text[],
  'inventory totals remain separate by currency'
);
select throws_ok(
  $$select public.upsert_inventory_item(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      'Invalid quantity',
      -1,
      'unit',
      null,
      null
    )$$,
  '22023',
  'invalid_inventory_quantity',
  'negative inventory quantity is rejected'
);

reset role;
update public.currencies
   set is_active = false
 where code = 'EUR';
set local role authenticated;

select throws_ok(
  $$select public.upsert_inventory_item(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_project_id => (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      p_name => 'Inactive currency item',
      p_quantity => 1,
      p_unit_label => 'unit',
      p_currency_code => 'EUR',
      p_unit_cost_minor => 100,
      p_item_id => null
    )$$,
  '22023',
  'invalid_currency',
  'inventory upsert rejects an inactive currency'
);

select lives_ok(
  $$select public.update_project(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_project_id => (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      p_project_type => null,
      p_modules => null,
      p_clear_goal => true
    )$$,
  'blueprint update can explicitly clear a goal'
);
select ok(
  (
    select goal_minor is null
    from public.projects
    where created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and name = 'Retry-safe blueprint project'
  ),
  'explicit goal clearing stores null'
);

select lives_ok(
  $$select public.update_project(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_project_id => (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      p_project_type => null,
      p_modules => '{
        "transactions": true,
        "goal": true,
        "workers": true,
        "capital": true,
        "inventory": true
      }'::jsonb
    )$$,
  'workers module can be enabled for behavior coverage'
);
select lives_ok(
  $$select public.create_project_worker(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      'Blueprint worker',
      1000,
      null
    )$$,
  'worker can be created through the guarded RPC'
);
select lives_ok(
  $$select public.post_transaction(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_client_id =>
        '00000000-0000-0000-0000-000000000930'::uuid,
      p_wallet_id => (
        select wallet.id
        from public.wallets as wallet
        where wallet.workspace_id = (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-0000-0000-000000000901'::uuid
        )
          and wallet.status = 'active'
        order by wallet.created_at
        limit 1
      ),
      p_kind => 'income'::public.transaction_kind,
      p_amount_minor => 10000,
      p_description => 'Fund wage withdrawal test'
    )$$,
  'test wallet can be funded for wage withdrawals'
);
select lives_ok(
  $$select public.record_daily_work(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      current_date,
      5000,
      '  Shift one  ',
      '00000000-0000-0000-0000-000000000920'::uuid
    )$$,
  'daily work can be recorded with a canonical note fingerprint'
);
select results_eq(
  $$select (public.record_daily_work(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      current_date,
      5000,
      'Shift one',
      '00000000-0000-0000-0000-000000000920'::uuid
    )).id$$,
  $$select id
      from public.project_work_logs
     where client_id =
       '00000000-0000-0000-0000-000000000920'::uuid
       and operation = 'record_daily_work'$$,
  'normalized matching daily-work retry returns the original log'
);
select throws_ok(
  $$select public.record_daily_work(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      current_date,
      5000,
      'Different note',
      '00000000-0000-0000-0000-000000000920'::uuid
    )$$,
  'PT409',
  'idempotency_conflict',
  'daily-work retry rejects a changed note'
);
select throws_ok(
  $$select public.record_daily_work(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Disabled workers module project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      current_date,
      5000,
      'Shift one',
      '00000000-0000-0000-0000-000000000920'::uuid
    )$$,
  'PT409',
  'idempotency_conflict',
  'daily-work retry rejects another project before module checks'
);
select lives_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'bonus'::public.work_log_entry_type,
      500,
      current_date,
      null,
      'Performance bonus',
      '00000000-0000-0000-0000-000000000921'::uuid
    )$$,
  'wage movement can be posted with a versioned fingerprint'
);
select throws_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'bonus'::public.work_log_entry_type,
      500,
      current_date,
      null,
      'Changed bonus note',
      '00000000-0000-0000-0000-000000000921'::uuid
    )$$,
  'PT409',
  'idempotency_conflict',
  'wage retry rejects a changed note'
);
select throws_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Disabled workers module project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'bonus'::public.work_log_entry_type,
      500,
      current_date,
      null,
      'Performance bonus',
      '00000000-0000-0000-0000-000000000921'::uuid
    )$$,
  'PT409',
  'idempotency_conflict',
  'wage retry rejects another project before module checks'
);
select lives_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'withdrawal'::public.work_log_entry_type,
      1000,
      current_date,
      (
        select wallet.id
        from public.wallets as wallet
        where wallet.workspace_id = (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-0000-0000-000000000901'::uuid
        )
          and wallet.status = 'active'
        order by wallet.created_at
        limit 1
      ),
      'Worker payout',
      '00000000-0000-0000-0000-000000000922'::uuid
    )$$,
  'withdrawal reuses and reactivates the canonical wage category'
);
select ok(
  (
    select
      category.is_active
      and not category.is_system
      and category.created_by =
        '00000000-0000-0000-0000-000000000904'::uuid
    from public.categories as category
    where category.workspace_id = (
      select id
      from public.workspaces
      where created_by =
        '00000000-0000-0000-0000-000000000901'::uuid
    )
      and category.kind = 'expense'
      and pg_catalog.lower(pg_catalog.btrim(category.name)) =
        pg_catalog.lower(pg_catalog.btrim('أجور يومية'))
  ),
  'wage category reactivation preserves safe non-system identity'
);
select ok(
  (
    select event.category_id = category.id
    from public.project_work_logs as log
    join public.financial_events as event
      on event.workspace_id = log.workspace_id
     and event.id = log.financial_event_id
    join public.categories as category
      on category.workspace_id = event.workspace_id
     and category.id = event.category_id
    where log.client_id =
      '00000000-0000-0000-0000-000000000922'::uuid
      and log.operation = 'post_wage_withdrawal'
      and category.is_active
  ),
  'wage withdrawal posts with the active canonical category'
);
select lives_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'deduction'::public.work_log_entry_type,
      4000,
      current_date,
      null,
      'Approved deduction',
      '00000000-0000-0000-0000-000000000923'::uuid
    )$$,
  'deduction within the worker balance succeeds'
);
select throws_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'deduction'::public.work_log_entry_type,
      600,
      current_date,
      null,
      'Overdraw attempt',
      '00000000-0000-0000-0000-000000000924'::uuid
    )$$,
  'PT409',
  'insufficient_worker_balance',
  'sequential wage movements cannot overdraw a worker balance'
);

reset role;

update public.project_workers
   set status = 'inactive'
 where created_by =
   '00000000-0000-0000-0000-000000000901'::uuid
   and name = 'Blueprint worker';

set local role authenticated;

select lives_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'deduction'::public.work_log_entry_type,
      100,
      current_date,
      null,
      'Inactive worker settlement',
      '00000000-0000-0000-0000-000000000927'::uuid
    )$$,
  'inactive worker can settle an outstanding balance'
);
select is(
  (
    select amount_minor
    from public.project_work_logs
    where client_id =
      '00000000-0000-0000-0000-000000000927'::uuid
      and operation = 'post_wage_deduction'
  ),
  (-100)::bigint,
  'inactive worker settlement records the signed movement'
);

reset role;

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
select
  project.workspace_id,
  project.id,
  worker.id,
  'daily_wage',
  current_date - 10,
  100,
  'LYD',
  'Legacy daily note',
  project.created_by,
  '00000000-0000-0000-0000-000000000925'::uuid,
  'record_daily_work',
  private.payload_hash(
    pg_catalog.jsonb_build_object(
      'worker_id',
      worker.id,
      'work_date',
      current_date - 10,
      'amount_minor',
      100,
      'entry_type',
      'daily_wage'
    )
  )
from public.projects as project
join public.project_workers as worker
  on worker.workspace_id = project.workspace_id
 and worker.project_id = project.id
where project.created_by =
  '00000000-0000-0000-0000-000000000901'::uuid
  and project.name = 'Retry-safe blueprint project'
  and worker.name = 'Blueprint worker';

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
select
  project.workspace_id,
  project.id,
  worker.id,
  'bonus',
  current_date - 9,
  100,
  'LYD',
  'Legacy wage note',
  project.created_by,
  '00000000-0000-0000-0000-000000000926'::uuid,
  'post_wage_bonus',
  private.payload_hash(
    pg_catalog.jsonb_build_object(
      'worker_id',
      worker.id,
      'entry_type',
      'bonus'::public.work_log_entry_type,
      'amount_minor',
      100,
      'work_date',
      current_date - 9,
      'wallet_id',
      null::uuid
    )
  )
from public.projects as project
join public.project_workers as worker
  on worker.workspace_id = project.workspace_id
 and worker.project_id = project.id
where project.created_by =
  '00000000-0000-0000-0000-000000000901'::uuid
  and project.name = 'Retry-safe blueprint project'
  and worker.name = 'Blueprint worker';

set local role authenticated;

select lives_ok(
  $$select public.record_daily_work(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      current_date - 10,
      100,
      ' Legacy daily note ',
      '00000000-0000-0000-0000-000000000925'::uuid
    )$$,
  'legacy daily-work fingerprint remains replayable'
);
select throws_ok(
  $$select public.record_daily_work(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      current_date - 10,
      100,
      'Changed legacy daily note',
      '00000000-0000-0000-0000-000000000925'::uuid
    )$$,
  'PT409',
  'idempotency_conflict',
  'legacy daily-work replay still rejects a changed note'
);
select lives_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'bonus'::public.work_log_entry_type,
      100,
      current_date - 9,
      null,
      ' Legacy wage note ',
      '00000000-0000-0000-0000-000000000926'::uuid
    )$$,
  'legacy wage fingerprint remains replayable'
);
select throws_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Disabled workers module project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'bonus'::public.work_log_entry_type,
      100,
      current_date - 9,
      null,
      'Legacy wage note',
      '00000000-0000-0000-0000-000000000926'::uuid
    )$$,
  'PT409',
  'idempotency_conflict',
  'legacy wage replay rejects reuse for a different project'
);

reset role;

update public.workspace_subscriptions
   set status = 'expired',
       expired_at = pg_catalog.clock_timestamp()
 where workspace_id = (
   select id
   from public.workspaces
   where created_by =
     '00000000-0000-0000-0000-000000000901'::uuid
 );
update public.projects
   set status = 'archived',
       modules = '{
         "transactions": true,
         "goal": false,
         "workers": false,
         "capital": false,
         "inventory": false
       }'::jsonb
 where created_by =
   '00000000-0000-0000-0000-000000000901'::uuid
   and name = 'Retry-safe blueprint project';
update public.workspaces
   set status = 'suspended'
 where created_by =
   '00000000-0000-0000-0000-000000000901'::uuid;
update public.currencies
   set is_active = false
 where code = 'LYD';

set local role authenticated;

select lives_ok(
  $$select public.create_project(
      p_workspace_id => (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      p_name => 'Retry-safe blueprint project',
      p_project_type => 'goods',
      p_modules => '{
        "transactions": true,
        "goal": true,
        "workers": false,
        "capital": true,
        "inventory": true
      }'::jsonb,
      p_description => 'Blueprint behavior coverage',
      p_goal_minor => 5000,
      p_color_token => 'info',
      p_status => 'active',
      p_client_id =>
        '00000000-0000-0000-0000-000000000910'::uuid,
      p_opening_capital_minor => 10000,
      p_seed_categories => '[
        {"name":"Shared seed category","kind":"expense"},
        {"name":"Dormant seed category","kind":"income"},
        {"name":"General expense","kind":"expense"}
      ]'::jsonb
    )$$,
  'project replay precedes entitlement and active-workspace checks'
);
select lives_ok(
  $$select public.record_daily_work(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      current_date,
      5000,
      'Shift one',
      '00000000-0000-0000-0000-000000000920'::uuid
    )$$,
  'daily-work replay precedes entitlement, project, module, and currency checks'
);
select lives_ok(
  $$select public.post_wage_movement(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      (
        select id
        from public.project_workers
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Blueprint worker'
      ),
      'bonus'::public.work_log_entry_type,
      500,
      current_date,
      null,
      'Performance bonus',
      '00000000-0000-0000-0000-000000000921'::uuid
    )$$,
  'wage replay precedes entitlement, project, module, and currency checks'
);
select lives_ok(
  $$select public.post_capital_entry(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
      ),
      (
        select id
        from public.projects
        where created_by =
          '00000000-0000-0000-0000-000000000901'::uuid
          and name = 'Retry-safe blueprint project'
      ),
      'contribution'::public.project_capital_entry_type,
      200,
      'LYD',
      'Owner contribution',
      current_date,
      '00000000-0000-0000-0000-000000000912'::uuid
    )$$,
  'capital replay precedes entitlement, project, module, and currency checks'
);

reset role;

select pg_catalog.set_config(
  'test.owner_workspace_id',
  (
    select id::text
    from public.workspaces
    where created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
  ),
  true
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000905';
set local role authenticated;

select is(
  (
    (select count(*) from public.project_summaries
      where workspace_id =
        pg_catalog.current_setting('test.owner_workspace_id')::uuid)
    +
    (select count(*) from public.project_financial_totals
      where workspace_id =
        pg_catalog.current_setting('test.owner_workspace_id')::uuid)
    +
    (select count(*) from public.project_labor_summaries
      where workspace_id =
        pg_catalog.current_setting('test.owner_workspace_id')::uuid)
    +
    (select count(*) from public.project_worker_balance_details
      where workspace_id =
        pg_catalog.current_setting('test.owner_workspace_id')::uuid)
    +
    (select count(*) from public.project_work_log_details
      where workspace_id =
        pg_catalog.current_setting('test.owner_workspace_id')::uuid)
    +
    (select count(*) from public.project_capital_entry_details
      where workspace_id =
        pg_catalog.current_setting('test.owner_workspace_id')::uuid)
    +
    (select count(*) from public.project_inventory_item_details
      where workspace_id =
        pg_catalog.current_setting('test.owner_workspace_id')::uuid)
    +
    (select count(*) from public.financial_event_details
      where workspace_id =
        pg_catalog.current_setting('test.owner_workspace_id')::uuid)
  ),
  0::bigint,
  'exact-money read views hide every nonmember workspace row'
);

reset role;

select throws_ok(
  $$insert into public.project_inventory_items (
      workspace_id,
      project_id,
      name,
      quantity,
      unit_label,
      unit_cost_minor,
      currency_code,
      created_by
    )
    select
      project.workspace_id,
      project.id,
      'FEED',
      1,
      'bag',
      250,
      'LYD',
      project.created_by
    from public.projects as project
    where project.created_by =
      '00000000-0000-0000-0000-000000000901'::uuid
      and project.name = 'Retry-safe blueprint project'$$,
  '23505',
  'duplicate key value violates unique constraint "project_inventory_items_active_name_unique"',
  'database rejects a case-insensitive duplicate active inventory name'
);
select throws_ok(
  $$update public.project_capital_entries
       set note = 'forbidden mutation'
     where client_id =
       '00000000-0000-0000-0000-000000000910'::uuid
       and operation = 'create_project_opening_capital'$$,
  '55000',
  'public.project_capital_entries is append-only',
  'project capital entries reject updates'
);

select * from finish();
rollback;
