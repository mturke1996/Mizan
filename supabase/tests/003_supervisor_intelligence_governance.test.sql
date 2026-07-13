begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

-- 45 assertion statements covering formulas, authz, currencies,
-- financial audit, and campaign idempotency.
select plan(45);

-- ---------------------------------------------------------------------------
-- Structural contracts
-- ---------------------------------------------------------------------------
select has_table(
  'private',
  'notification_campaigns',
  'private notification campaigns table exists'
);

select ok(
  coalesce(
    (
      select
        not pg_catalog.has_table_privilege(
          'anon',
          relation.oid,
          'SELECT'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated',
          relation.oid,
          'SELECT'
        )
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              relation.relacl,
              pg_catalog.acldefault('r', relation.relowner)
            )
          ) as privilege
          where privilege.grantee = 0
            and privilege.privilege_type in (
              'SELECT',
              'INSERT',
              'UPDATE',
              'DELETE'
            )
        )
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'private'
        and relation.relname = 'notification_campaigns'
    ),
    false
  ),
  'notification campaigns are inaccessible to PUBLIC, anon, and authenticated'
);

select ok(
  pg_catalog.to_regprocedure(
    'private.assert_supervisor_financial_read(uuid,text)'
  ) is not null,
  'financial read assertion helper exists'
);

create temporary table expected_intelligence_functions (
  signature text primary key
) on commit drop;

insert into expected_intelligence_functions (signature)
values
  ('public.supervisor_operational_metrics(timestamptz,timestamptz)'),
  ('public.supervisor_revenue_series(timestamptz,timestamptz,text)'),
  ('public.supervisor_plan_mix()'),
  ('public.supervisor_action_queue(integer)'),
  (
    'public.supervisor_send_notification_campaign(text,text,text,text,uuid)'
  ),
  ('public.supervisor_list_notification_campaigns(integer,integer)'),
  (
    'public.supervisor_list_customer_notifications(uuid,integer,integer)'
  ),
  ('public.supervisor_customer_financial_snapshot(uuid)'),
  ('public.supervisor_customer_wallets(uuid,integer,integer)'),
  ('public.supervisor_customer_transactions(uuid,integer,integer)'),
  ('public.supervisor_customer_projects(uuid,integer,integer)'),
  ('public.supervisor_customer_workers(uuid,integer,integer)'),
  (
    'public.supervisor_list_audit_events(text,text,uuid,uuid,timestamptz,timestamptz,integer,integer)'
  ),
  ('public.supervisor_customer_control_ledger(uuid,integer,integer)');

select ok(
  pg_catalog.count(*) = 14
    and pg_catalog.bool_and(
      procedure.oid is not null
      and procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']
      and pg_catalog.has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      )
      and not pg_catalog.has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      )
      and not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            procedure.proacl,
            pg_catalog.acldefault('f', procedure.proowner)
          )
        ) as privilege
        where privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
      )
    ),
  'intelligence RPCs are SECURITY DEFINER, empty search_path, authenticated-only'
)
from expected_intelligence_functions as expected
left join pg_catalog.pg_proc as procedure
  on procedure.oid = pg_catalog.to_regprocedure(expected.signature);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname like 'supervisor_customer_%'
      and procedure.proname ~ '(write|mutate|post|adjust|create|update|delete|reverse)'
  ),
  'no supervisor financial write/mutation RPCs exist'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
reset role;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

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
values
  (
    '00000000-0000-4000-8000-000000000501'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'intel-regular@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Intel Regular"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000502'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'intel-supervisor@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Intel Supervisor"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000503'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'intel-trial-converted@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Intel Trial Converted"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000504'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'intel-expiring@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Intel Expiring"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000505'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'intel-grace@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Intel Grace"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000506'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'intel-frozen@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Intel Frozen"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000507'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'intel-usd-owner@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Intel USD Owner"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  );

update public.profiles
set system_role = 'supervisor',
    account_status = 'active'
where id = '00000000-0000-4000-8000-000000000502'::uuid;

insert into public.subscription_plans (
  id,
  code,
  name,
  price_minor,
  currency_code,
  billing_interval,
  interval_count,
  trial_days,
  is_public,
  is_active,
  features
)
values
  (
    '00000000-0000-4000-8000-000000000601'::uuid,
    'intel-lyd-monthly',
    'Intel LYD monthly',
    50000,
    'LYD',
    'monthly',
    1,
    0,
    true,
    true,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000602'::uuid,
    'intel-usd-monthly',
    'Intel USD monthly',
    2000,
    'USD',
    'monthly',
    1,
    0,
    true,
    true,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000603'::uuid,
    'intel-orphan-plan',
    'Intel orphan plan',
    1000,
    'LYD',
    'monthly',
    1,
    0,
    true,
    true,
    '{}'::jsonb
  );

-- Shape subscription states for segment/metrics fixtures.
update public.workspace_subscriptions
set plan_id = '00000000-0000-4000-8000-000000000601'::uuid,
    status = 'active',
    starts_at = pg_catalog.transaction_timestamp() - interval '40 days',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() + interval '20 days',
    grace_ends_at = null,
    frozen_at = null,
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by = '00000000-0000-4000-8000-000000000503'::uuid
);

update public.workspace_subscriptions
set plan_id = '00000000-0000-4000-8000-000000000601'::uuid,
    status = 'active',
    starts_at = pg_catalog.transaction_timestamp() - interval '20 days',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() + interval '5 days',
    grace_ends_at = null,
    frozen_at = null,
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by = '00000000-0000-4000-8000-000000000504'::uuid
);

update public.workspace_subscriptions
set plan_id = '00000000-0000-4000-8000-000000000601'::uuid,
    status = 'grace',
    starts_at = pg_catalog.transaction_timestamp() - interval '40 days',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() - interval '2 days',
    grace_ends_at =
      pg_catalog.transaction_timestamp() + interval '5 days',
    frozen_at = null,
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by = '00000000-0000-4000-8000-000000000505'::uuid
);

update public.workspace_subscriptions
set plan_id = '00000000-0000-4000-8000-000000000601'::uuid,
    status = 'frozen',
    starts_at = pg_catalog.transaction_timestamp() - interval '40 days',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() + interval '10 days',
    grace_ends_at = null,
    frozen_at = pg_catalog.transaction_timestamp() - interval '1 day',
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by = '00000000-0000-4000-8000-000000000506'::uuid
);

update public.workspaces
set default_currency_code = 'USD'
where created_by = '00000000-0000-4000-8000-000000000507'::uuid;

update public.workspace_subscriptions
set plan_id = '00000000-0000-4000-8000-000000000602'::uuid,
    status = 'trialing',
    starts_at = pg_catalog.transaction_timestamp() - interval '2 days',
    trial_ends_at =
      pg_catalog.transaction_timestamp() + interval '12 days',
    current_period_ends_at = null,
    grace_ends_at = null,
    frozen_at = null,
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by = '00000000-0000-4000-8000-000000000507'::uuid
);

-- Trial conversion event for metrics.
insert into public.subscription_events (
  workspace_id,
  subscription_id,
  actor_user_id,
  event_type,
  from_status,
  to_status,
  metadata,
  created_at
)
select
  subscription.workspace_id,
  subscription.id,
  '00000000-0000-4000-8000-000000000502'::uuid,
  'supervisor_set_subscription_state',
  'trialing',
  'active',
  '{}'::jsonb,
  pg_catalog.transaction_timestamp() - interval '1 day'
from public.workspace_subscriptions as subscription
where subscription.workspace_id = (
  select id
  from public.workspaces
  where created_by = '00000000-0000-4000-8000-000000000503'::uuid
);

-- Payments: 3 LYD (2 approved, 1 rejected) + 2 USD (1 approved, 1 pending).
insert into public.payment_requests (
  id,
  workspace_id,
  requested_by,
  plan_id,
  period_count,
  amount_minor,
  currency_code,
  proof_object_path,
  status,
  reviewed_by,
  reviewed_at,
  created_at
)
select
  payment.id,
  workspace.id,
  workspace.created_by,
  payment.plan_id,
  1,
  payment.amount_minor,
  payment.currency_code,
  payment.proof_object_path,
  payment.status,
  payment.reviewed_by,
  payment.reviewed_at,
  payment.created_at
from (
  values
    (
      '00000000-0000-4000-8000-000000000701'::uuid,
      '00000000-0000-4000-8000-000000000503'::uuid,
      '00000000-0000-4000-8000-000000000601'::uuid,
      100000::bigint,
      'LYD',
      'proofs/intel-1',
      'approved'::public.payment_request_status,
      '00000000-0000-4000-8000-000000000502'::uuid,
      pg_catalog.transaction_timestamp() - interval '2 days',
      pg_catalog.transaction_timestamp() - interval '3 days'
    ),
    (
      '00000000-0000-4000-8000-000000000702'::uuid,
      '00000000-0000-4000-8000-000000000504'::uuid,
      '00000000-0000-4000-8000-000000000601'::uuid,
      150000::bigint,
      'LYD',
      'proofs/intel-2',
      'approved'::public.payment_request_status,
      '00000000-0000-4000-8000-000000000502'::uuid,
      pg_catalog.transaction_timestamp() - interval '1 day',
      pg_catalog.transaction_timestamp() - interval '2 days'
    ),
    (
      '00000000-0000-4000-8000-000000000703'::uuid,
      '00000000-0000-4000-8000-000000000505'::uuid,
      '00000000-0000-4000-8000-000000000601'::uuid,
      80000::bigint,
      'LYD',
      null,
      'rejected'::public.payment_request_status,
      '00000000-0000-4000-8000-000000000502'::uuid,
      pg_catalog.transaction_timestamp() - interval '12 hours',
      pg_catalog.transaction_timestamp() - interval '1 day'
    ),
    (
      '00000000-0000-4000-8000-000000000704'::uuid,
      '00000000-0000-4000-8000-000000000507'::uuid,
      '00000000-0000-4000-8000-000000000602'::uuid,
      2500::bigint,
      'USD',
      'proofs/intel-usd-1',
      'approved'::public.payment_request_status,
      '00000000-0000-4000-8000-000000000502'::uuid,
      pg_catalog.transaction_timestamp() - interval '6 hours',
      pg_catalog.transaction_timestamp() - interval '1 day'
    ),
    (
      '00000000-0000-4000-8000-000000000705'::uuid,
      '00000000-0000-4000-8000-000000000507'::uuid,
      '00000000-0000-4000-8000-000000000602'::uuid,
      3000::bigint,
      'USD',
      null,
      'pending'::public.payment_request_status,
      null::uuid,
      null::timestamptz,
      pg_catalog.transaction_timestamp() - interval '3 hours'
    )
) as payment (
  id,
  owner_id,
  plan_id,
  amount_minor,
  currency_code,
  proof_object_path,
  status,
  reviewed_by,
  reviewed_at,
  created_at
)
join public.workspaces as workspace
  on workspace.created_by = payment.owner_id;

-- ---------------------------------------------------------------------------
-- Supervisor-only gate
-- ---------------------------------------------------------------------------
set local "request.jwt.claim.sub" =
  '00000000-0000-4000-8000-000000000501';
set local role authenticated;

select throws_ok(
  $statement$
    select public.supervisor_operational_metrics(
      pg_catalog.transaction_timestamp() - interval '30 days',
      pg_catalog.transaction_timestamp()
    )
  $statement$,
  '42501',
  'forbidden',
  'regular users cannot read operational metrics'
);

select throws_ok(
  $statement$
    select public.supervisor_customer_financial_snapshot(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-4000-8000-000000000503'::uuid
      )
    )
  $statement$,
  '42501',
  'forbidden',
  'regular users cannot open financial snapshots'
);

select throws_ok(
  $statement$
    select public.supervisor_send_notification_campaign(
      'grace',
      'Hello',
      'Body text',
      'note for campaign',
      '00000000-0000-4000-8000-000000000801'::uuid
    )
  $statement$,
  '42501',
  'forbidden',
  'regular users cannot send notification campaigns'
);

select throws_ok(
  $statement$
    select public.supervisor_list_audit_events(
      null, null, null, null, null, null, 10, 0
    )
  $statement$,
  '42501',
  'forbidden',
  'regular users cannot list audit events'
);

-- ---------------------------------------------------------------------------
-- Formula contracts as supervisor
-- ---------------------------------------------------------------------------
reset role;
set local "request.jwt.claim.sub" =
  '00000000-0000-4000-8000-000000000502';
set local role authenticated;

create temporary table intel_metrics on commit drop as
select public.supervisor_operational_metrics(
  pg_catalog.transaction_timestamp() - interval '30 days',
  pg_catalog.transaction_timestamp() + interval '1 hour'
) as payload;

select is(
  (select payload #>> '{payments,approved}' from intel_metrics),
  '3',
  'metrics count three approved payments in window'
);

select is(
  (select payload #>> '{payments,rejected}' from intel_metrics),
  '1',
  'metrics count one rejected payment in window'
);

select is(
  (select payload #>> '{payments,pending}' from intel_metrics),
  '1',
  'metrics count one pending payment in window'
);

select is(
  (select payload #>> '{payments,approval_sample_size}' from intel_metrics),
  '4',
  'approval sample size excludes pending'
);

select ok(
  (
    select (payload #>> '{payments,approval_rate}')::numeric
    from intel_metrics
  ) = 75::numeric,
  'approval_rate = approved/(approved+rejected)*100'
);

select ok(
  (
    select payload #>> '{payments,average_review_minutes}' is not null
    from intel_metrics
  ),
  'average review minutes is computed for decided payments'
);

select is(
  (select payload #>> '{trials,sample_size}' from intel_metrics),
  '1',
  'trial sample size counts decided trial transitions'
);

select ok(
  (
    select (payload #>> '{trials,conversion_rate}')::numeric
    from intel_metrics
  ) = 100::numeric,
  'trial conversion rate is 100% for converted trial fixture'
);

select ok(
  (
    select (payload #>> '{customers,grace}')::integer >= 1
      and (payload #>> '{customers,frozen}')::integer >= 1
      and (payload #>> '{customers,expiring_7d}')::integer >= 1
    from intel_metrics
  ),
  'customer snapshot includes grace, frozen, and expiring_7d'
);

-- Empty sample returns null rate, never fake 0%.
select ok(
  (
    select
      payload -> 'payments' ->> 'approval_rate' is null
      and (payload -> 'payments' ->> 'approval_sample_size')::integer = 0
    from (
      select public.supervisor_operational_metrics(
        '2000-01-01'::timestamptz,
        '2000-01-02'::timestamptz
      ) as payload
    ) as empty_window
  ),
  'empty payment window returns null approval_rate with sample_size 0'
);

-- Revenue separates currencies and uses reviewed_at.
create temporary table intel_revenue on commit drop as
select *
from public.supervisor_revenue_series(
  pg_catalog.transaction_timestamp() - interval '30 days',
  pg_catalog.transaction_timestamp() + interval '1 hour',
  'month'
);

select ok(
  exists (
    select 1
    from intel_revenue
    where currency_code = 'LYD'
      and approved_amount_minor = 250000
      and approved_count = 2
  ),
  'LYD revenue aggregates approved amounts only'
);

select ok(
  exists (
    select 1
    from intel_revenue
    where currency_code = 'USD'
      and approved_amount_minor = 2500
      and approved_count = 1
  ),
  'USD revenue stays separate from LYD'
);

select throws_ok(
  $statement$
    select *
    from public.supervisor_revenue_series(
      pg_catalog.transaction_timestamp() - interval '30 days',
      pg_catalog.transaction_timestamp(),
      'quarter'
    )
  $statement$,
  '22023',
  'invalid_bucket',
  'revenue series rejects buckets outside day|week|month'
);

select ok(
  exists (
    select 1
    from public.supervisor_plan_mix() as mix
    where mix.plan_id = '00000000-0000-4000-8000-000000000603'::uuid
      and mix.active_subscriptions = 0
      and mix.trialing_subscriptions = 0
      and mix.frozen_subscriptions = 0
  ),
  'plan mix includes orphan plans with zero subscribers'
);

select ok(
  exists (
    select 1
    from public.supervisor_action_queue(50) as queue
    where queue.item_type = 'subscription_grace'
  ),
  'action queue surfaces grace subscriptions first-class'
);

-- ---------------------------------------------------------------------------
-- Notification campaigns: segments, isolation, idempotency, read_count
-- ---------------------------------------------------------------------------
create temporary table intel_campaign on commit drop as
select public.supervisor_send_notification_campaign(
  'grace',
  'Grace reminder',
  'Please renew before the grace window ends.',
  'ops note for grace campaign',
  '00000000-0000-4000-8000-000000000802'::uuid
) as payload;

select is(
  (select (payload ->> 'recipient_count')::integer from intel_campaign),
  1,
  'grace campaign targets exactly the grace segment'
);

select is(
  (
    select pg_catalog.count(*)::integer
    from public.notifications as notification
    where notification.metadata ->> 'campaign_id' =
      (select payload ->> 'campaign_id' from intel_campaign)
  ),
  1,
  'campaign inserts one notification per recipient'
);

select is(
  (
    select notification.user_id
    from public.notifications as notification
    where notification.metadata ->> 'campaign_id' =
      (select payload ->> 'campaign_id' from intel_campaign)
  ),
  '00000000-0000-4000-8000-000000000505'::uuid,
  'grace campaign does not notify non-matching customers'
);

select is(
  public.supervisor_send_notification_campaign(
    'grace',
    'Grace reminder',
    'Please renew before the grace window ends.',
    'ops note for grace campaign',
    '00000000-0000-4000-8000-000000000802'::uuid
  ),
  (select payload from intel_campaign),
  'campaign retry returns the same idempotent payload'
);

select is(
  (
    select pg_catalog.count(*)::integer
    from public.notifications as notification
    where notification.metadata ->> 'campaign_id' =
      (select payload ->> 'campaign_id' from intel_campaign)
  ),
  1,
  'campaign retry does not duplicate notifications'
);

update public.notifications
set read_at = pg_catalog.clock_timestamp()
where metadata ->> 'campaign_id' =
  (select payload ->> 'campaign_id' from intel_campaign);

select is(
  (
    select campaign.read_count
    from public.supervisor_list_notification_campaigns(10, 0) as campaign
    where campaign.id::text =
      (select payload ->> 'campaign_id' from intel_campaign)
  ),
  1,
  'campaign read_count derives from notifications.read_at'
);

select ok(
  (
    select (page ->> 'total')::integer = 1
      and page -> 'rows' -> 0 ->> 'title' = 'Grace reminder'
    from (
      select public.supervisor_list_customer_notifications(
        '00000000-0000-4000-8000-000000000505'::uuid,
        20,
        0
      ) as page
    ) as customer_page
  ),
  'customer notification list is scoped to the requested user'
);

select is(
  (
    select (page ->> 'total')::integer
    from (
      select public.supervisor_list_customer_notifications(
        '00000000-0000-4000-8000-000000000504'::uuid,
        20,
        0
      ) as page
    ) as other_page
  ),
  0,
  'non-recipient customer does not see the campaign message'
);

-- ---------------------------------------------------------------------------
-- Financial read-only + audit
-- ---------------------------------------------------------------------------
create temporary table intel_finance_workspace on commit drop as
select id as workspace_id
from public.workspaces
where created_by = '00000000-0000-4000-8000-000000000503'::uuid;

create temporary table intel_audit_before on commit drop as
select pg_catalog.count(*)::integer as total
from audit.events
where action = 'supervisor.financial_accessed'
  and workspace_id = (
    select workspace_id from intel_finance_workspace
  );

create temporary table intel_snapshot on commit drop as
select public.supervisor_customer_financial_snapshot(
  (select workspace_id from intel_finance_workspace)
) as payload;

select ok(
  (
    select payload ? 'currencies'
      and pg_catalog.jsonb_typeof(payload -> 'currencies') = 'array'
    from intel_snapshot
  ),
  'financial snapshot returns currency-separated aggregates'
);

select is(
  (
    select pg_catalog.count(*)::integer
    from audit.events
    where action = 'supervisor.financial_accessed'
      and workspace_id = (
        select workspace_id from intel_finance_workspace
      )
  ),
  (select total + 1 from intel_audit_before),
  'financial snapshot writes supervisor.financial_accessed audit'
);

select ok(
  (
    select event.metadata ->> 'resource' = 'financial_snapshot'
    from audit.events as event
    where event.action = 'supervisor.financial_accessed'
      and event.workspace_id = (
        select workspace_id from intel_finance_workspace
      )
    order by event.created_at desc, event.id desc
    limit 1
  ),
  'financial audit metadata records the accessed resource'
);

create temporary table intel_wallets_page on commit drop as
select public.supervisor_customer_wallets(
  (select workspace_id from intel_finance_workspace),
  10,
  0
) as payload;

select ok(
  (
    select payload ? 'rows'
      and payload ? 'total'
      and (payload ->> 'total')::integer >= 1
    from intel_wallets_page
  ),
  'wallet page returns rows+total with bootstrap wallets'
);

select is(
  (
    select pg_catalog.count(*)::integer
    from audit.events
    where action = 'supervisor.financial_accessed'
      and workspace_id = (
        select workspace_id from intel_finance_workspace
      )
  ),
  (select total + 2 from intel_audit_before),
  'wallet reads also write financial access audit events'
);

select ok(
  (
    select page ? 'rows' and page ? 'total'
    from (
      select public.supervisor_customer_transactions(
        (select workspace_id from intel_finance_workspace),
        10,
        0
      ) as page
    ) as tx_page
  ),
  'transaction page returns rows+total'
);

select ok(
  (
    select page ? 'rows' and page ? 'total'
    from (
      select public.supervisor_customer_projects(
        (select workspace_id from intel_finance_workspace),
        10,
        0
      ) as page
    ) as project_page
  ),
  'project page returns rows+total'
);

select ok(
  (
    select page ? 'rows' and page ? 'total'
    from (
      select public.supervisor_customer_workers(
        (select workspace_id from intel_finance_workspace),
        10,
        0
      ) as page
    ) as worker_page
  ),
  'worker page returns rows+total'
);

-- ---------------------------------------------------------------------------
-- Audit + control ledger
-- ---------------------------------------------------------------------------
create temporary table intel_audit_page on commit drop as
select public.supervisor_list_audit_events(
  null,
  'supervisor.financial_accessed',
  (select workspace_id from intel_finance_workspace),
  null,
  null,
  null,
  20,
  0
) as payload;

select ok(
  (
    select (payload ->> 'total')::integer >= 2
      and pg_catalog.jsonb_array_length(payload -> 'rows') >= 2
      and payload -> 'rows' -> 0 ? 'actor_name'
      and payload -> 'rows' -> 0 ? 'customer_name'
      and not (payload -> 'rows' -> 0 -> 'metadata' ? 'password')
      and not (payload -> 'rows' -> 0 -> 'metadata' ? 'capability')
    from intel_audit_page
  ),
  'audit list returns enriched sanitized rows newest-first'
);

create temporary table intel_ledger on commit drop as
select public.supervisor_customer_control_ledger(
  (
    select id
    from public.workspaces
    where created_by = '00000000-0000-4000-8000-000000000505'::uuid
  ),
  50,
  0
) as payload;

select ok(
  (
    select (payload ->> 'total')::integer >= 2
      and exists (
        select 1
        from pg_catalog.jsonb_array_elements(payload -> 'rows') as row_json
        where row_json ->> 'entry_type' = 'notification'
      )
      and exists (
        select 1
        from pg_catalog.jsonb_array_elements(payload -> 'rows') as row_json
        where row_json ->> 'entry_type' = 'payment_review'
      )
    from intel_ledger
  ),
  'control ledger merges notifications and payment reviews chronologically'
);

select ok(
  (
    select
      pg_catalog.jsonb_array_length(payload -> 'rows') >= 2
      and (payload -> 'rows' -> 0 ->> 'occurred_at')
        >= (
          payload -> 'rows'
            -> (pg_catalog.jsonb_array_length(payload -> 'rows') - 1)
            ->> 'occurred_at'
        )
    from intel_ledger
  ),
  'control ledger orders newest entries first'
);

-- Pagination total stays stable across offset.
select is(
  (
    select (page ->> 'total')::integer
    from (
      select public.supervisor_customer_control_ledger(
        (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-4000-8000-000000000505'::uuid
        ),
        1,
        0
      ) as page
    ) as first_page
  ),
  (
    select (page ->> 'total')::integer
    from (
      select public.supervisor_customer_control_ledger(
        (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-4000-8000-000000000505'::uuid
        ),
        1,
        1
      ) as page
    ) as second_page
  ),
  'control ledger total is stable across pagination offsets'
);

select ok(
  (
    select
      first_page.row_id is distinct from second_page.row_id
    from (
      select public.supervisor_customer_control_ledger(
        (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-4000-8000-000000000505'::uuid
        ),
        1,
        0
      ) -> 'rows' -> 0 ->> 'entry_id' as row_id
    ) as first_page
    cross join (
      select public.supervisor_customer_control_ledger(
        (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-4000-8000-000000000505'::uuid
        ),
        1,
        1
      ) -> 'rows' -> 0 ->> 'entry_id' as row_id
    ) as second_page
  ),
  'control ledger pagination does not repeat the same entry'
);

select * from finish();
rollback;
