begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

-- 141 assertion statements plus 163 additional table-driven result rows.
select plan(304);

-- Structural contract.
select has_extension(
  'pg_cron',
  'pg_cron is installed for guaranteed control-plane cleanup'
);
select has_table(
  'private',
  'customer_onboarding_intents',
  'private onboarding intents table exists'
);
select has_column(
  'private',
  'customer_onboarding_intents',
  'capability_hash',
  'onboarding intents persist only a capability digest'
);
select has_column(
  'private',
  'customer_onboarding_intents',
  'cancelled_at',
  'onboarding intent tombstones record cancellation time'
);
select has_column(
  'private',
  'customer_onboarding_intents',
  'cancelled_by',
  'onboarding intent tombstones record the cancelling supervisor'
);
select has_column(
  'private',
  'customer_onboarding_intents',
  'cancel_reason',
  'onboarding intent tombstones record the cancellation reason'
);
select has_column(
  'public',
  'profiles',
  'must_change_password',
  'profiles track required password changes'
);
select has_column(
  'public',
  'workspace_subscriptions',
  'scheduled_status',
  'subscriptions expose a scheduled terminal state'
);
select has_column(
  'public',
  'workspace_subscriptions',
  'scheduled_status_at',
  'subscriptions expose a scheduled state timestamp'
);
select has_constraint(
  'public',
  'workspace_subscriptions',
  'workspace_subscriptions_scheduled_state_shape',
  'scheduled subscription state shape is constrained'
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
          'anon',
          relation.oid,
          'INSERT'
        )
        and not pg_catalog.has_table_privilege(
          'anon',
          relation.oid,
          'UPDATE'
        )
        and not pg_catalog.has_table_privilege(
          'anon',
          relation.oid,
          'DELETE'
        )
        and not pg_catalog.has_table_privilege(
          'anon',
          relation.oid,
          'TRUNCATE'
        )
        and not pg_catalog.has_table_privilege(
          'anon',
          relation.oid,
          'REFERENCES'
        )
        and not pg_catalog.has_table_privilege(
          'anon',
          relation.oid,
          'TRIGGER'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated',
          relation.oid,
          'SELECT'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated',
          relation.oid,
          'INSERT'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated',
          relation.oid,
          'UPDATE'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated',
          relation.oid,
          'DELETE'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated',
          relation.oid,
          'TRUNCATE'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated',
          relation.oid,
          'REFERENCES'
        )
        and not pg_catalog.has_table_privilege(
          'authenticated',
          relation.oid,
          'TRIGGER'
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
              'DELETE',
              'TRUNCATE',
              'REFERENCES',
              'TRIGGER'
            )
        )
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'private'
        and relation.relname = 'customer_onboarding_intents'
    ),
    false
  ),
  'onboarding intents are inaccessible to PUBLIC, anon, and authenticated'
);
select ok(
  coalesce(
    (
      select pg_catalog.array_agg(
               column_info.column_name
               order by column_info.column_name
             ) = array['capability_hash']::text[]
      from information_schema.columns as column_info
      where column_info.table_schema = 'private'
        and column_info.table_name = 'customer_onboarding_intents'
        and column_info.column_name like '%capability%'
    ),
    false
  )
  and exists (
    select 1
    from pg_catalog.pg_constraint as schema_constraint
    where schema_constraint.conrelid =
        pg_catalog.to_regclass('private.customer_onboarding_intents')
      and schema_constraint.contype = 'u'
      and schema_constraint.conname =
        'customer_onboarding_intents_capability_hash_key'
  ),
  'the private intent stores one unique capability hash and no plaintext capability'
);
select ok(
  coalesce(
    (
      select column_info.is_nullable = 'YES'
      from information_schema.columns as column_info
      where column_info.table_schema = 'private'
        and column_info.table_name = 'customer_onboarding_intents'
        and column_info.column_name = 'capability_hash'
    ),
    false
  )
  and not exists (
    select 1
    from pg_catalog.pg_index as schema_index
    join pg_catalog.pg_attribute as column_info
      on column_info.attrelid = schema_index.indrelid
     and column_info.attnum = any(schema_index.indkey)
    where schema_index.indrelid =
        pg_catalog.to_regclass('private.customer_onboarding_intents')
      and schema_index.indisunique
      and column_info.attname = 'email'
  )
  and exists (
    select 1
    from pg_catalog.pg_constraint as schema_constraint
    where schema_constraint.conrelid =
        pg_catalog.to_regclass('private.customer_onboarding_intents')
      and schema_constraint.conname =
        'customer_onboarding_intents_cancellation_shape'
  )
  and exists (
    select 1
    from pg_catalog.pg_constraint as schema_constraint
    where schema_constraint.conrelid =
        pg_catalog.to_regclass('private.customer_onboarding_intents')
      and schema_constraint.conname =
        'customer_onboarding_intents_terminal_state_exclusive'
  ),
  'capabilities are issued later and email lifecycle tombstones are non-unique and constrained'
);
select ok(
  pg_catalog.to_regclass('private.supervisor_capability_keys') is null
  and pg_catalog.to_regprocedure(
    'private.derive_supervisor_capability(uuid,uuid,text,jsonb)'
  ) is null,
  'no database HMAC key or deterministic capability derivation is retained'
);
select ok(
  coalesce(
    (
      select pg_catalog.bool_and(
        relation.oid is not null
        and relation.relrowsecurity
        and not exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              relation.relacl,
              pg_catalog.acldefault('r', relation.relowner)
            )
          ) as privilege
          where privilege.grantee in (
              0,
              (select role.oid from pg_catalog.pg_roles as role
                where role.rolname = 'anon'),
              (select role.oid from pg_catalog.pg_roles as role
                where role.rolname = 'authenticated')
            )
            and privilege.privilege_type in (
              'SELECT',
              'INSERT',
              'UPDATE',
              'DELETE',
              'TRUNCATE',
              'REFERENCES',
              'TRIGGER'
            )
        )
      )
      from (
        values
          ('supervisor_operation_idempotency')
      ) as expected(relation_name)
      left join pg_catalog.pg_class as relation
        on relation.relname = expected.relation_name
       and relation.relnamespace = pg_catalog.to_regnamespace('private')
    ),
    false
  ),
  'private idempotency state has RLS and no direct client ACLs'
);
select ok(
  coalesce(
    (
      select pg_catalog.bool_and(
        helper.function_oid is not null
        and not pg_catalog.has_function_privilege(
          'anon',
          helper.function_oid,
          'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'authenticated',
          helper.function_oid,
          'EXECUTE'
        )
        and not exists (
          select 1
          from pg_catalog.pg_proc as routine
          cross join lateral pg_catalog.aclexplode(
            coalesce(
              routine.proacl,
              pg_catalog.acldefault('f', routine.proowner)
            )
          ) as privilege
          where routine.oid = helper.function_oid
            and privilege.grantee = 0
            and privilege.privilege_type = 'EXECUTE'
        )
      )
      from (
        select pg_catalog.to_regprocedure(expected.signature) as function_oid
        from (
          values
            ('private.lock_customer_onboarding_email(text)'),
            ('private.cleanup_supervisor_control_plane()'),
            ('private.begin_supervisor_operation(uuid,uuid,text,jsonb)'),
            ('private.finish_supervisor_operation(uuid,uuid,text,jsonb)'),
            ('private.sanitize_onboarding_auth_metadata()'),
            ('private.handle_new_user()')
        ) as expected(signature)
      ) as helper
    ),
    false
  ),
  'private onboarding and idempotency helpers are not client executable'
);

select ok(
  (
    select pg_catalog.count(*) = 2
      and pg_catalog.bool_and(
        case trigger_info.tgname
          when 'on_auth_user_sanitize_onboarding_metadata' then
            (trigger_info.tgtype & 1) = 1
            and (trigger_info.tgtype & 2) = 2
            and (trigger_info.tgtype & 4) = 4
            and (trigger_info.tgtype & 16) = 16
            and trigger_info.function_oid =
              pg_catalog.to_regprocedure(
                'private.sanitize_onboarding_auth_metadata()'
              )
          when 'on_auth_user_created' then
            (trigger_info.tgtype & 1) = 1
            and (trigger_info.tgtype & 2) = 0
            and (trigger_info.tgtype & 4) = 4
            and trigger_info.function_oid =
              pg_catalog.to_regprocedure('private.handle_new_user()')
          else false
        end
      )
    from (
      select
        schema_trigger.tgname,
        schema_trigger.tgtype::integer,
        schema_trigger.tgfoid as function_oid
      from pg_catalog.pg_trigger as schema_trigger
      where schema_trigger.tgrelid = pg_catalog.to_regclass('auth.users')
        and not schema_trigger.tgisinternal
        and schema_trigger.tgname in (
          'on_auth_user_sanitize_onboarding_metadata',
          'on_auth_user_created'
        )
    ) as trigger_info
  ),
  'auth metadata is sanitized BEFORE writes and bootstrapped only AFTER insert'
);

select lives_ok(
  $test$
    do $body$
    declare
      matching_jobs bigint;
      cleanup_definition text;
    begin
      if pg_catalog.to_regclass('cron.job') is null then
        raise exception 'cron.job is missing';
      end if;

      if not exists (
        select 1
        from pg_catalog.pg_extension as extension_info
        where extension_info.extname = 'pg_cron'
          and extension_info.extnamespace =
            pg_catalog.to_regnamespace('pg_catalog')
      ) then
        raise exception 'pg_cron is installed in the wrong schema';
      end if;

      execute $sql$
        select pg_catalog.count(*)
        from cron.job as job
        where job.jobname = 'mizan-supervisor-control-plane-cleanup'
          and job.schedule = '17 3 * * *'
          and job.command =
            'select private.cleanup_supervisor_control_plane()'
          and job.active
      $sql$
      into matching_jobs;

      select pg_catalog.pg_get_functiondef(
               pg_catalog.to_regprocedure(
                 'private.cleanup_supervisor_control_plane()'
               )
             )
        into cleanup_definition;

      if matching_jobs is distinct from 1
         or cleanup_definition not like
           '%v_batch_limit constant integer := 1000%'
         or cleanup_definition not like '%limit v_batch_limit%'
         or cleanup_definition not like '%interval ''30 days''%'
         or cleanup_definition not like '%interval ''90 days''%'
         or cleanup_definition not like
           '%retained.result ->> ''intent_id'' = intent.id::text%'
      then
        raise exception 'cron or cleanup retention contract is invalid';
      end if;
    end
    $body$
  $test$,
  'daily cleanup uses 1,000-row bounded batches and replay-safe retention'
);

select ok(
  (
    select pg_catalog.bool_and(
      function_definition not like '%statement_timestamp%'
      and function_definition like '%clock_timestamp%'
    )
    from (
      select pg_catalog.pg_get_functiondef(
               pg_catalog.to_regprocedure(expected.signature)
             ) as function_definition
      from (
        values
          (
            'public.supervisor_prepare_customer_onboarding(text,text,text,text,uuid,public.subscription_status,timestamp with time zone,timestamp with time zone,timestamp with time zone,boolean,text,text,uuid)'
          ),
          (
            'public.supervisor_issue_customer_onboarding_capability(uuid,text)'
          ),
          (
            'public.supervisor_cancel_customer_onboarding(uuid,text)'
          ),
          ('private.handle_new_user()')
      ) as expected(signature)
    ) as critical_function
  ),
  'intent lifecycle functions revalidate with wall-clock time and never stale statement time'
);

create temporary table expected_supervisor_functions (
  ordinal integer primary key,
  function_name text not null,
  arg_types text[] not null,
  signature text not null,
  is_admin boolean not null
);

insert into expected_supervisor_functions (
  ordinal,
  function_name,
  arg_types,
  signature,
  is_admin
)
values
  (
    1,
    'supervisor_prepare_customer_onboarding',
    array[
      'text',
      'text',
      'text',
      'text',
      'uuid',
      'public.subscription_status',
      'timestamp with time zone',
      'timestamp with time zone',
      'timestamp with time zone',
      'boolean',
      'text',
      'text',
      'uuid'
    ],
    'public.supervisor_prepare_customer_onboarding(text,text,text,text,uuid,public.subscription_status,timestamp with time zone,timestamp with time zone,timestamp with time zone,boolean,text,text,uuid)',
    true
  ),
  (
    2,
    'supervisor_cancel_customer_onboarding',
    array['uuid', 'text'],
    'public.supervisor_cancel_customer_onboarding(uuid,text)',
    true
  ),
  (
    3,
    'supervisor_create_plan',
    array[
      'text',
      'text',
      'bigint',
      'text',
      'public.billing_interval',
      'smallint',
      'smallint',
      'boolean',
      'jsonb',
      'text',
      'uuid'
    ],
    'public.supervisor_create_plan(text,text,bigint,text,public.billing_interval,smallint,smallint,boolean,jsonb,text,uuid)',
    true
  ),
  (
    4,
    'supervisor_update_plan',
    array[
      'uuid',
      'text',
      'bigint',
      'text',
      'public.billing_interval',
      'smallint',
      'smallint',
      'boolean',
      'jsonb',
      'text',
      'uuid'
    ],
    'public.supervisor_update_plan(uuid,text,bigint,text,public.billing_interval,smallint,smallint,boolean,jsonb,text,uuid)',
    true
  ),
  (
    5,
    'supervisor_archive_plan',
    array['uuid', 'text', 'uuid'],
    'public.supervisor_archive_plan(uuid,text,uuid)',
    true
  ),
  (
    6,
    'supervisor_change_subscription_plan',
    array['uuid', 'uuid', 'text', 'uuid'],
    'public.supervisor_change_subscription_plan(uuid,uuid,text,uuid)',
    true
  ),
  (
    7,
    'supervisor_renew_subscription',
    array['uuid', 'smallint', 'text', 'uuid'],
    'public.supervisor_renew_subscription(uuid,smallint,text,uuid)',
    true
  ),
  (
    8,
    'supervisor_set_subscription_state',
    array[
      'uuid',
      'public.subscription_status',
      'timestamp with time zone',
      'timestamp with time zone',
      'timestamp with time zone',
      'text',
      'uuid'
    ],
    'public.supervisor_set_subscription_state(uuid,public.subscription_status,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,uuid)',
    true
  ),
  (
    9,
    'supervisor_schedule_subscription_state',
    array[
      'uuid',
      'public.subscription_status',
      'timestamp with time zone',
      'text',
      'uuid'
    ],
    'public.supervisor_schedule_subscription_state(uuid,public.subscription_status,timestamp with time zone,text,uuid)',
    true
  ),
  (
    10,
    'supervisor_send_notification',
    array[
      'uuid',
      'uuid',
      'text',
      'text',
      'text',
      'jsonb',
      'text',
      'uuid'
    ],
    'public.supervisor_send_notification(uuid,uuid,text,text,text,jsonb,text,uuid)',
    true
  ),
  (
    11,
    'supervisor_list_customers',
    array[
      'text',
      'public.account_status',
      'public.subscription_status',
      'uuid',
      'integer',
      'integer'
    ],
    'public.supervisor_list_customers(text,public.account_status,public.subscription_status,uuid,integer,integer)',
    true
  ),
  (
    12,
    'supervisor_get_customer',
    array['uuid'],
    'public.supervisor_get_customer(uuid)',
    true
  ),
  (
    13,
    'supervisor_list_plans',
    array['boolean'],
    'public.supervisor_list_plans(boolean)',
    true
  ),
  (
    14,
    'supervisor_list_payments',
    array[
      'public.payment_request_status',
      'text',
      'uuid',
      'text',
      'timestamp with time zone',
      'timestamp with time zone',
      'integer',
      'integer'
    ],
    'public.supervisor_list_payments(public.payment_request_status,text,uuid,text,timestamp with time zone,timestamp with time zone,integer,integer)',
    true
  ),
  (
    15,
    'complete_required_password_change',
    array[]::text[],
    'public.complete_required_password_change()',
    false
  ),
  (
    16,
    'supervisor_issue_customer_onboarding_capability',
    array['uuid', 'text'],
    'public.supervisor_issue_customer_onboarding_capability(uuid,text)',
    true
  );

alter table expected_supervisor_functions
  add column arg_names text[],
  add column default_count integer,
  add column return_type text;

update expected_supervisor_functions
set
  arg_names = case function_name
    when 'supervisor_prepare_customer_onboarding' then array[
      'p_email',
      'p_display_name',
      'p_workspace_name',
      'p_currency_code',
      'p_plan_id',
      'p_subscription_status',
      'p_starts_at',
      'p_trial_ends_at',
      'p_current_period_ends_at',
      'p_must_change_password',
      'p_delivery_mode',
      'p_note',
      'p_client_id'
    ]
    when 'supervisor_cancel_customer_onboarding' then
      array['p_intent_id', 'p_note']
    when 'supervisor_issue_customer_onboarding_capability' then
      array['p_intent_id', 'p_note']
    when 'supervisor_create_plan' then array[
      'p_code',
      'p_name',
      'p_price_minor',
      'p_currency_code',
      'p_billing_interval',
      'p_interval_count',
      'p_trial_days',
      'p_is_public',
      'p_features',
      'p_note',
      'p_client_id'
    ]
    when 'supervisor_update_plan' then array[
      'p_plan_id',
      'p_name',
      'p_price_minor',
      'p_currency_code',
      'p_billing_interval',
      'p_interval_count',
      'p_trial_days',
      'p_is_public',
      'p_features',
      'p_note',
      'p_client_id'
    ]
    when 'supervisor_archive_plan' then
      array['p_plan_id', 'p_note', 'p_client_id']
    when 'supervisor_change_subscription_plan' then
      array['p_workspace_id', 'p_plan_id', 'p_note', 'p_client_id']
    when 'supervisor_renew_subscription' then
      array['p_workspace_id', 'p_period_count', 'p_note', 'p_client_id']
    when 'supervisor_set_subscription_state' then array[
      'p_workspace_id',
      'p_target_status',
      'p_trial_ends_at',
      'p_current_period_ends_at',
      'p_grace_ends_at',
      'p_note',
      'p_client_id'
    ]
    when 'supervisor_schedule_subscription_state' then array[
      'p_workspace_id',
      'p_target_status',
      'p_scheduled_at',
      'p_note',
      'p_client_id'
    ]
    when 'supervisor_send_notification' then array[
      'p_user_id',
      'p_workspace_id',
      'p_kind',
      'p_title',
      'p_body',
      'p_metadata',
      'p_note',
      'p_client_id'
    ]
    when 'supervisor_list_customers' then array[
      'p_query',
      'p_account_status',
      'p_subscription_status',
      'p_plan_id',
      'p_limit',
      'p_offset'
    ]
    when 'supervisor_get_customer' then array['p_user_id']
    when 'supervisor_list_plans' then array['p_include_archived']
    when 'supervisor_list_payments' then array[
      'p_status',
      'p_query',
      'p_plan_id',
      'p_currency_code',
      'p_from',
      'p_to',
      'p_limit',
      'p_offset'
    ]
    when 'complete_required_password_change' then array[]::text[]
  end,
  default_count = case
    when function_name = 'supervisor_list_plans' then 1
    else 0
  end,
  return_type = case
    when function_name in (
      'supervisor_create_plan',
      'supervisor_update_plan',
      'supervisor_archive_plan'
    ) then 'public.subscription_plans'
    when function_name in (
      'supervisor_change_subscription_plan',
      'supervisor_renew_subscription',
      'supervisor_set_subscription_state',
      'supervisor_schedule_subscription_state'
    ) then 'public.workspace_subscriptions'
    when function_name = 'supervisor_send_notification'
      then 'public.notifications'
    when function_name in (
      'supervisor_prepare_customer_onboarding',
      'supervisor_issue_customer_onboarding_capability'
    )
      then 'uuid'
    when function_name in (
      'supervisor_cancel_customer_onboarding',
      'complete_required_password_change'
    ) then 'void'
    else 'jsonb'
  end;

alter table expected_supervisor_functions
  alter column arg_names set not null,
  alter column default_count set not null,
  alter column return_type set not null;

select has_function(
  'public',
  expected.function_name,
  expected.arg_types,
  pg_catalog.format('%s has the approved signature', expected.function_name)
)
from expected_supervisor_functions as expected
order by expected.ordinal;

select ok(
  procedure.oid is not null
    and pg_catalog.has_function_privilege(
      'authenticated',
      procedure.oid,
      'EXECUTE'
    ),
  pg_catalog.format(
    'authenticated can execute the intended %s API',
    expected.function_name
  )
)
from expected_supervisor_functions as expected
left join pg_catalog.pg_proc as procedure
  on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
order by expected.ordinal;

select ok(
  procedure.oid is not null
    and coalesce(procedure.proargnames, array[]::text[]) =
      expected.arg_names
    and procedure.pronargdefaults = expected.default_count
    and procedure.prorettype =
      pg_catalog.to_regtype(expected.return_type)
    and not procedure.proretset
    and procedure.prosecdef
    and exists (
      select 1
      from pg_catalog.unnest(procedure.proconfig) as setting(value)
      where setting.value in ('search_path=""', 'search_path=pg_catalog')
    ),
  pg_catalog.format(
    '%s has named parameters, approved defaults/return, SECURITY DEFINER, and a safe fixed search_path',
    expected.function_name
  )
)
from expected_supervisor_functions as expected
left join pg_catalog.pg_proc as procedure
  on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
order by expected.ordinal;

select is(
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc as overload
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = overload.pronamespace
    where namespace.nspname = 'public'
      and overload.proname = expected.function_name
  ),
  1::bigint,
  pg_catalog.format(
    '%s has no unexpected public overload',
    expected.function_name
  )
)
from expected_supervisor_functions as expected
order by expected.ordinal;

select is(
  (
    select pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.pg_get_function_arguments(procedure.oid),
        '\s+',
        ' ',
        'g'
      )
    )
    from pg_catalog.pg_proc as procedure
    where procedure.oid = pg_catalog.to_regprocedure(
      'public.supervisor_list_plans(boolean)'
    )
  ),
  'p_include_archived boolean default true',
  'supervisor_list_plans defaults p_include_archived to true'
);

select ok(
  pg_catalog.count(*) = 16
    and pg_catalog.bool_and(
      procedure.oid is not null
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
  'PUBLIC cannot execute any supervisor control-plane function'
)
from expected_supervisor_functions as expected
left join pg_catalog.pg_proc as procedure
  on procedure.oid = pg_catalog.to_regprocedure(expected.signature);

select ok(
  pg_catalog.count(*) = 16
    and pg_catalog.bool_and(
      procedure.oid is not null
      and not pg_catalog.has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      )
    ),
  'anon cannot execute any supervisor control-plane function'
)
from expected_supervisor_functions as expected
left join pg_catalog.pg_proc as procedure
  on procedure.oid = pg_catalog.to_regprocedure(expected.signature);

-- Deterministic users and workspaces. The existing auth trigger creates each
-- profile, owner workspace, trial subscription, wallet, and base records.
reset role;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';
select is(
  auth.uid(),
  null::uuid,
  'fixture auth bootstrap starts without a JWT subject'
);

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
    '00000000-0000-0000-0000-000000000201'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'regular-supervisor-contract@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Regular Contract User"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000202'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'active-supervisor-contract@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Active Contract Supervisor"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000203'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'suspended-supervisor-contract@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Suspended Contract Supervisor"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000204'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'read-model-alpha@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Read Model Contract Alpha"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000205'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'read-model-beta@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Read Model Contract Beta"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  ),
  (
    '00000000-0000-0000-0000-000000000208'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'read-model-decoy@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Read Model Contract Decoy"}'::jsonb,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  );

update public.profiles
set system_role = 'supervisor',
    account_status = 'active'
where id = '00000000-0000-0000-0000-000000000202'::uuid;

update public.profiles
set system_role = 'supervisor',
    account_status = 'suspended'
where id = '00000000-0000-0000-0000-000000000203'::uuid;

update public.profiles
set account_status = 'disabled',
    created_at = pg_catalog.transaction_timestamp() - interval '3 days'
where id = '00000000-0000-0000-0000-000000000208'::uuid;

update public.profiles
set created_at = pg_catalog.transaction_timestamp() - interval '1 day'
where id in (
  '00000000-0000-0000-0000-000000000204'::uuid,
  '00000000-0000-0000-0000-000000000205'::uuid
);

update public.workspaces
set name = case created_by
  when '00000000-0000-0000-0000-000000000204'::uuid
    then 'Read Model Contract Alpha Workspace'
  when '00000000-0000-0000-0000-000000000205'::uuid
    then 'Read Model Contract Beta Workspace'
  when '00000000-0000-0000-0000-000000000208'::uuid
    then 'Read Model Contract Decoy Workspace'
  else name
end
where created_by in (
  '00000000-0000-0000-0000-000000000204'::uuid,
  '00000000-0000-0000-0000-000000000205'::uuid,
  '00000000-0000-0000-0000-000000000208'::uuid
);

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
    '00000000-0000-0000-0000-000000000301'::uuid,
    'contract-monthly-base',
    'Contract monthly base',
    25000,
    'LYD',
    'monthly',
    1,
    0,
    true,
    true,
    '{"reports":true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000302'::uuid,
    'contract-archived',
    'Contract archived',
    10000,
    'LYD',
    'monthly',
    1,
    0,
    false,
    false,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000303'::uuid,
    'contract-yearly-target',
    'Contract yearly target',
    240000,
    'LYD',
    'yearly',
    1,
    0,
    true,
    true,
    '{"reports":true,"exports":true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000304'::uuid,
    'contract-archive-target',
    'Contract archive target',
    15000,
    'LYD',
    'monthly',
    1,
    0,
    true,
    true,
    '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000305'::uuid,
    'contract-update-target',
    'Contract update target',
    12000,
    'USD',
    'monthly',
    1,
    0,
    false,
    true,
    '{"reports":false}'::jsonb
  );

update public.workspace_subscriptions
set plan_id = '00000000-0000-0000-0000-000000000301'::uuid,
    status = 'active',
    starts_at = pg_catalog.transaction_timestamp() - interval '30 days',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() + interval '40 days',
    grace_ends_at = null,
    frozen_at = null,
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by =
    '00000000-0000-0000-0000-000000000204'::uuid
);

update public.workspace_subscriptions
set plan_id = '00000000-0000-0000-0000-000000000302'::uuid,
    status = 'expired',
    starts_at = pg_catalog.transaction_timestamp() - interval '60 days',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() - interval '10 days',
    grace_ends_at = null,
    frozen_at = null,
    expired_at = pg_catalog.transaction_timestamp() - interval '10 days',
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by =
    '00000000-0000-0000-0000-000000000205'::uuid
);

update public.workspace_subscriptions
set plan_id = '00000000-0000-0000-0000-000000000304'::uuid,
    status = 'frozen',
    starts_at = pg_catalog.transaction_timestamp() - interval '30 days',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() + interval '20 days',
    grace_ends_at = null,
    frozen_at = pg_catalog.transaction_timestamp() - interval '1 day',
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by =
    '00000000-0000-0000-0000-000000000208'::uuid
);

select throws_ok(
  $statement$
    update public.workspace_subscriptions
       set scheduled_status = null,
           scheduled_status_at = pg_catalog.transaction_timestamp()
     where workspace_id = (
       select id
       from public.workspaces
       where created_by =
         '00000000-0000-0000-0000-000000000204'::uuid
     )
  $statement$,
  '23514',
  null,
  'scheduled state rejects a timestamp without a target status'
);

select throws_ok(
  $statement$
    update public.workspace_subscriptions
       set scheduled_status = 'cancelled',
           scheduled_status_at = null
     where workspace_id = (
       select id
       from public.workspaces
       where created_by =
         '00000000-0000-0000-0000-000000000204'::uuid
     )
  $statement$,
  '23514',
  null,
  'scheduled state rejects a target status without a timestamp'
);

insert into public.payment_requests (
  id,
  workspace_id,
  requested_by,
  plan_id,
  period_count,
  amount_minor,
  currency_code,
  status,
  requester_note,
  created_at
)
select
  '00000000-0000-0000-0000-000000000501'::uuid,
  workspace.id,
  '00000000-0000-0000-0000-000000000204'::uuid,
  '00000000-0000-0000-0000-000000000301'::uuid,
  1,
  25000,
  'LYD',
  'pending',
  'Supervisor control-plane contract fixture',
  pg_catalog.transaction_timestamp() - interval '2 hours'
from public.workspaces as workspace
where workspace.created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

insert into public.payment_requests (
  id,
  workspace_id,
  requested_by,
  plan_id,
  period_count,
  amount_minor,
  currency_code,
  status,
  requester_note,
  reviewed_by,
  reviewed_at,
  created_at
)
select
  fixture.id,
  workspace.id,
  fixture.user_id,
  fixture.plan_id,
  fixture.period_count,
  fixture.amount_minor,
  fixture.currency_code,
  fixture.status,
  fixture.requester_note,
  fixture.reviewed_by,
  fixture.reviewed_at,
  fixture.created_at
from (
  values
    (
      '00000000-0000-0000-0000-000000000502'::uuid,
      '00000000-0000-0000-0000-000000000204'::uuid,
      '00000000-0000-0000-0000-000000000303'::uuid,
      2::smallint,
      480000::bigint,
      'USD'::text,
      'pending'::public.payment_request_status,
      'Pending USD decoy'::text,
      null::uuid,
      null::timestamp with time zone,
      pg_catalog.transaction_timestamp() - interval '2 hours'
    ),
    (
      '00000000-0000-0000-0000-000000000503'::uuid,
      '00000000-0000-0000-0000-000000000205'::uuid,
      '00000000-0000-0000-0000-000000000303'::uuid,
      1::smallint,
      240000::bigint,
      'USD'::text,
      'approved'::public.payment_request_status,
      'Old approved decoy'::text,
      '00000000-0000-0000-0000-000000000202'::uuid,
      pg_catalog.transaction_timestamp() - interval '9 days',
      pg_catalog.transaction_timestamp() - interval '10 days'
    ),
    (
      '00000000-0000-0000-0000-000000000504'::uuid,
      '00000000-0000-0000-0000-000000000204'::uuid,
      '00000000-0000-0000-0000-000000000301'::uuid,
      1::smallint,
      25000::bigint,
      'LYD'::text,
      'rejected'::public.payment_request_status,
      'Rejected LYD decoy'::text,
      '00000000-0000-0000-0000-000000000202'::uuid,
      pg_catalog.transaction_timestamp() - interval '20 minutes',
      pg_catalog.transaction_timestamp() - interval '30 minutes'
    )
) as fixture(
  id,
  user_id,
  plan_id,
  period_count,
  amount_minor,
  currency_code,
  status,
  requester_note,
  reviewed_by,
  reviewed_at,
  created_at
)
join public.workspaces as workspace
  on workspace.created_by = fixture.user_id;

-- Every administrative RPC must authorize before validating or looking up
-- targets. Calls are text so this file still parses before the RPCs exist.
create temporary table regular_user_admin_denials (
  ordinal integer primary key,
  function_name text not null,
  statement text not null
);

insert into regular_user_admin_denials (
  ordinal,
  function_name,
  statement
)
values
  (
    1,
    'supervisor_prepare_customer_onboarding',
    $call$
      select public.supervisor_prepare_customer_onboarding(
        'denied-onboarding@example.test',
        'Denied onboarding',
        'Denied workspace',
        'LYD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        null,
        pg_catalog.transaction_timestamp() + interval '1 month',
        false,
        'invite',
        'authorization must run first',
        '00000000-0000-0000-0000-000000000401'::uuid
      )
    $call$
  ),
  (
    2,
    'supervisor_cancel_customer_onboarding',
    $call$
      select public.supervisor_cancel_customer_onboarding(
        '00000000-0000-0000-0000-000000000399'::uuid,
        'authorization must run first'
      )
    $call$
  ),
  (
    3,
    'supervisor_create_plan',
    $call$
      select public.supervisor_create_plan(
        'denied-plan',
        'Denied plan',
        1000,
        'LYD',
        'monthly'::public.billing_interval,
        1::smallint,
        0::smallint,
        true,
        '{}'::jsonb,
        'authorization must run first',
        '00000000-0000-0000-0000-000000000402'::uuid
      )
    $call$
  ),
  (
    4,
    'supervisor_update_plan',
    $call$
      select public.supervisor_update_plan(
        '00000000-0000-0000-0000-000000000301'::uuid,
        'Denied update',
        1000,
        'LYD',
        'monthly'::public.billing_interval,
        1::smallint,
        0::smallint,
        true,
        '{}'::jsonb,
        'authorization must run first',
        '00000000-0000-0000-0000-000000000403'::uuid
      )
    $call$
  ),
  (
    5,
    'supervisor_archive_plan',
    $call$
      select public.supervisor_archive_plan(
        '00000000-0000-0000-0000-000000000301'::uuid,
        'authorization must run first',
        '00000000-0000-0000-0000-000000000404'::uuid
      )
    $call$
  ),
  (
    6,
    'supervisor_change_subscription_plan',
    $call$
      select public.supervisor_change_subscription_plan(
        (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-0000-0000-000000000204'::uuid
        ),
        '00000000-0000-0000-0000-000000000301'::uuid,
        'authorization must run first',
        '00000000-0000-0000-0000-000000000405'::uuid
      )
    $call$
  ),
  (
    7,
    'supervisor_renew_subscription',
    $call$
      select public.supervisor_renew_subscription(
        (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-0000-0000-000000000204'::uuid
        ),
        1::smallint,
        'authorization must run first',
        '00000000-0000-0000-0000-000000000406'::uuid
      )
    $call$
  ),
  (
    8,
    'supervisor_set_subscription_state',
    $call$
      select public.supervisor_set_subscription_state(
        (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-0000-0000-000000000204'::uuid
        ),
        'grace'::public.subscription_status,
        null,
        pg_catalog.transaction_timestamp() + interval '1 month',
        pg_catalog.transaction_timestamp() + interval '7 days',
        'authorization must run first',
        '00000000-0000-0000-0000-000000000407'::uuid
      )
    $call$
  ),
  (
    9,
    'supervisor_schedule_subscription_state',
    $call$
      select public.supervisor_schedule_subscription_state(
        (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-0000-0000-000000000204'::uuid
        ),
        'cancelled'::public.subscription_status,
        pg_catalog.transaction_timestamp() + interval '10 days',
        'authorization must run first',
        '00000000-0000-0000-0000-000000000408'::uuid
      )
    $call$
  ),
  (
    10,
    'supervisor_send_notification',
    $call$
      select public.supervisor_send_notification(
        '00000000-0000-0000-0000-000000000204'::uuid,
        (
          select id
          from public.workspaces
          where created_by =
            '00000000-0000-0000-0000-000000000204'::uuid
        ),
        'system',
        'Denied notification',
        'Authorization must run before notification validation.',
        '{}'::jsonb,
        'authorization must run first',
        '00000000-0000-0000-0000-000000000409'::uuid
      )
    $call$
  ),
  (
    11,
    'supervisor_list_customers',
    $call$
      select public.supervisor_list_customers(
        null::text,
        null::public.account_status,
        null::public.subscription_status,
        null::uuid,
        10,
        0
      )
    $call$
  ),
  (
    12,
    'supervisor_get_customer',
    $call$
      select public.supervisor_get_customer(
        '00000000-0000-0000-0000-000000000204'::uuid
      )
    $call$
  ),
  (
    13,
    'supervisor_list_plans',
    $call$
      select public.supervisor_list_plans(true)
    $call$
  ),
  (
    14,
    'supervisor_list_payments',
    $call$
      select public.supervisor_list_payments(
        null::public.payment_request_status,
        null::text,
        null::uuid,
        null::text,
        null::timestamp with time zone,
        null::timestamp with time zone,
        10,
        0
      )
    $call$
  ),
  (
    15,
    'supervisor_issue_customer_onboarding_capability',
    $call$
      select public.supervisor_issue_customer_onboarding_capability(
        '00000000-0000-0000-0000-000000000399'::uuid,
        'authorization must run first'
      )
    $call$
  );

grant select on regular_user_admin_denials to authenticated;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000201';
set local role authenticated;

select throws_ok(
  denial.statement,
  '42501',
  'forbidden',
  pg_catalog.format(
    'regular authenticated users are rejected by %s',
    denial.function_name
  )
)
from regular_user_admin_denials as denial
order by denial.ordinal;

reset role;
set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000203';
set local role authenticated;

select throws_ok(
  denial.statement,
  '42501',
  'forbidden',
  pg_catalog.format(
    'suspended supervisors are rejected by %s',
    denial.function_name
  )
)
from regular_user_admin_denials as denial
order by denial.ordinal;

reset role;

select ok(
  relation.oid is not null
    and not exists (
      select 1
      from (
        values ('anon'::name), ('authenticated'::name)
      ) as grantee(role_name)
      cross join (
        values
          ('INSERT'::text),
          ('UPDATE'::text),
          ('DELETE'::text),
          ('TRUNCATE'::text)
      ) as mutation(privilege_name)
      where pg_catalog.has_table_privilege(
        grantee.role_name,
        relation.oid,
        mutation.privilege_name
      )
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
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE'
        )
    ),
  pg_catalog.format(
    '%s has no direct mutation privileges for PUBLIC, anon, or authenticated',
    expected.relation_name
  )
)
from (
  values
    ('subscription_plans'::name),
    ('workspace_subscriptions'::name)
) as expected(relation_name)
left join pg_catalog.pg_class as relation
  on relation.relname = expected.relation_name
 and relation.relnamespace = 'public'::regnamespace
order by expected.relation_name;

create temporary table protected_relation_mutations (
  ordinal integer primary key,
  relation_name text not null,
  operation text not null,
  statement text not null
);

insert into protected_relation_mutations (
  ordinal,
  relation_name,
  operation,
  statement
)
values
  (
    1,
    'subscription_plans',
    'INSERT',
    $sql$
      insert into public.subscription_plans (
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
      values (
        'forbidden-direct-insert',
        'Forbidden direct insert',
        0,
        'LYD',
        'monthly',
        1,
        0,
        false,
        true,
        '{}'::jsonb
      )
    $sql$
  ),
  (
    2,
    'subscription_plans',
    'UPDATE',
    $sql$
      update public.subscription_plans
         set name = 'Forbidden direct plan update'
       where id = '00000000-0000-0000-0000-000000000301'::uuid
    $sql$
  ),
  (
    3,
    'subscription_plans',
    'DELETE',
    $sql$
      delete from public.subscription_plans
       where id = '00000000-0000-0000-0000-000000000305'::uuid
    $sql$
  ),
  (
    4,
    'subscription_plans',
    'TRUNCATE',
    $sql$truncate table public.subscription_plans$sql$
  ),
  (
    5,
    'workspace_subscriptions',
    'INSERT',
    $sql$insert into public.workspace_subscriptions default values$sql$
  ),
  (
    6,
    'workspace_subscriptions',
    'UPDATE',
    $sql$
      update public.workspace_subscriptions
         set current_period_ends_at =
           pg_catalog.transaction_timestamp() + interval '2 years'
       where workspace_id = (
         select id
         from public.workspaces
         where created_by =
           '00000000-0000-0000-0000-000000000204'::uuid
       )
    $sql$
  ),
  (
    7,
    'workspace_subscriptions',
    'DELETE',
    $sql$
      delete from public.workspace_subscriptions
       where workspace_id = (
         select id
         from public.workspaces
         where created_by =
           '00000000-0000-0000-0000-000000000204'::uuid
       )
    $sql$
  ),
  (
    8,
    'workspace_subscriptions',
    'TRUNCATE',
    $sql$truncate table public.workspace_subscriptions$sql$
  );

grant select on protected_relation_mutations to authenticated;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select results_eq(
  $query$
    update public.workspaces
       set name = 'Forbidden supervisor direct update'
     where created_by =
       '00000000-0000-0000-0000-000000000204'::uuid
    returning id
  $query$,
  $expected$select null::uuid where false$expected$,
  'a supervisor cannot directly update customer workspaces'
);

reset role;
set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000204';
set local role authenticated;

select results_eq(
  $query$
    update public.workspaces
       set name = 'Owner workspace update contract'
     where created_by =
       '00000000-0000-0000-0000-000000000204'::uuid
    returning id
  $query$,
  $expected$
    select id
    from public.workspaces
    where created_by =
      '00000000-0000-0000-0000-000000000204'::uuid
  $expected$,
  'a workspace owner can update their entitled workspace'
);

reset role;
update public.workspace_members as membership
   set role = 'admin'
 where membership.user_id =
     '00000000-0000-0000-0000-000000000204'::uuid
   and membership.workspace_id = (
     select workspace.id
     from public.workspaces as workspace
     where workspace.created_by = membership.user_id
   );

set local role authenticated;

select results_eq(
  $query$
    update public.workspaces
       set name = 'Admin workspace update contract'
     where created_by =
       '00000000-0000-0000-0000-000000000204'::uuid
    returning id
  $query$,
  $expected$
    select id
    from public.workspaces
    where created_by =
      '00000000-0000-0000-0000-000000000204'::uuid
  $expected$,
  'a workspace admin can update their entitled workspace'
);

reset role;
update public.workspace_members as membership
   set role = 'owner'
 where membership.user_id =
     '00000000-0000-0000-0000-000000000204'::uuid
   and membership.workspace_id = (
     select workspace.id
     from public.workspaces as workspace
     where workspace.created_by = membership.user_id
   );

create temporary table entitlement_start_snapshot (
  workspace_id uuid primary key,
  starts_at timestamptz not null
);

insert into entitlement_start_snapshot (workspace_id, starts_at)
select subscription.workspace_id, subscription.starts_at
from public.workspace_subscriptions as subscription
join public.workspaces as workspace
  on workspace.id = subscription.workspace_id
where workspace.created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

update public.workspace_subscriptions
   set starts_at = pg_catalog.statement_timestamp() + interval '1 day'
 where workspace_id = (
   select workspace_id
   from entitlement_start_snapshot
 );

set local role authenticated;

select is(
  private.has_current_entitlement(
    (
      select workspace_id
      from entitlement_start_snapshot
    )
  ),
  false,
  'a future subscription start does not grant current entitlement'
);

reset role;
update public.workspace_subscriptions as subscription
   set starts_at = snapshot.starts_at
  from entitlement_start_snapshot as snapshot
 where subscription.workspace_id = snapshot.workspace_id;

update public.workspaces
   set name = 'Read Model Contract Alpha Workspace'
 where created_by =
   '00000000-0000-0000-0000-000000000204'::uuid;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  pg_catalog.format(
    $test$
      do $body$
      begin
        begin
          execute %L;
          raise exception 'direct mutation unexpectedly succeeded';
        exception
          when insufficient_privilege then null;
        end;
      end
      $body$
    $test$,
    mutation.statement
  ),
  pg_catalog.format(
    'supervisors cannot directly %s %s',
    mutation.operation,
    mutation.relation_name
  )
)
from protected_relation_mutations as mutation
order by mutation.ordinal;

select lives_ok(
  $test$
    do $body$
    begin
      begin
        update public.profiles
           set must_change_password = false
         where id =
           '00000000-0000-0000-0000-000000000204'::uuid;
        raise exception 'supervisor directly cleared a password marker';
      exception
        when insufficient_privilege then null;
      end;
    end
    $body$
  $test$,
  'a supervisor cannot directly mutate must_change_password'
);

reset role;
update public.workspaces
set name = 'Read Model Contract Alpha Workspace'
where created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select throws_ok(
  $call$
    select public.supervisor_send_notification(
      '00000000-0000-0000-0000-000000000204'::uuid,
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000205'::uuid
      ),
      'system',
      'Mismatched target',
      'The user is not a member of this workspace.',
      '{}'::jsonb,
      'Reject target mismatch',
      '00000000-0000-0000-0000-000000000440'::uuid
    )
  $call$,
  '22023',
  'notification_target_mismatch',
  'notification rejects a user/workspace membership mismatch'
);

select throws_ok(
  $call$
    select public.supervisor_send_notification(
      null::uuid,
      null::uuid,
      'system',
      'Missing target',
      'A notification requires an explicit recipient.',
      '{}'::jsonb,
      'Reject missing target',
      '00000000-0000-0000-0000-000000000441'::uuid
    )
  $call$,
  '22023',
  'invalid_notification_target',
  'notification rejects a missing recipient target'
);

select throws_ok(
  $call$
    select public.supervisor_send_notification(
      '00000000-0000-0000-0000-000000000204'::uuid,
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'system',
      '   ',
      'Valid body',
      '{}'::jsonb,
      'Reject blank title',
      '00000000-0000-0000-0000-000000000442'::uuid
    )
  $call$,
  '22023',
  'invalid_notification_title',
  'notification rejects a blank title'
);

select throws_ok(
  $call$
    select public.supervisor_send_notification(
      '00000000-0000-0000-0000-000000000204'::uuid,
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'system',
      pg_catalog.repeat('T', 121),
      'Valid body',
      '{}'::jsonb,
      'Reject long title',
      '00000000-0000-0000-0000-000000000443'::uuid
    )
  $call$,
  '22023',
  'invalid_notification_title',
  'notification rejects a title longer than 120 characters'
);

select throws_ok(
  $call$
    select public.supervisor_send_notification(
      '00000000-0000-0000-0000-000000000204'::uuid,
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'system',
      'Valid title',
      '   ',
      '{}'::jsonb,
      'Reject blank body',
      '00000000-0000-0000-0000-000000000444'::uuid
    )
  $call$,
  '22023',
  'invalid_notification_body',
  'notification rejects a blank body'
);

select throws_ok(
  $call$
    select public.supervisor_send_notification(
      '00000000-0000-0000-0000-000000000204'::uuid,
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'system',
      'Valid title',
      pg_catalog.repeat('B', 2001),
      '{}'::jsonb,
      'Reject long body',
      '00000000-0000-0000-0000-000000000445'::uuid
    )
  $call$,
  '22023',
  'invalid_notification_body',
  'notification rejects a body longer than 2000 characters'
);

reset role;

create temporary table mutation_snapshots (
  snapshot_key text primary key,
  snapshot jsonb not null
);

grant select on mutation_snapshots to authenticated;

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'plan-create-before',
  pg_catalog.jsonb_build_object(
    'existing_count',
    pg_catalog.count(*)
  )
from public.subscription_plans as plan
where plan.code = 'supervisor-contract-created';

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_create_plan(
      'supervisor-contract-created',
      'Supervisor contract created',
      50000,
      'LYD',
      'monthly'::public.billing_interval,
      1::smallint,
      7::smallint,
      true,
      '{"exports":true,"reports":true}'::jsonb,
      'Create through the audited supervisor path',
      '00000000-0000-0000-0000-000000000410'::uuid
    )
  $call$,
  'an active supervisor can create a plan through the intended RPC'
);

select lives_ok(
  $test$
    do $body$
    declare
      replayed public.subscription_plans;
      stored_id uuid;
      stored_count bigint;
    begin
      select *
        into replayed
        from public.supervisor_create_plan(
          'supervisor-contract-created',
          'Supervisor contract created',
          50000,
          'LYD',
          'monthly'::public.billing_interval,
          1::smallint,
          7::smallint,
          true,
          '{"reports":true,"exports":true}'::jsonb,
          'Create through the audited supervisor path',
          '00000000-0000-0000-0000-000000000410'::uuid
        );

      select plan.id, pg_catalog.count(*) over ()
        into stored_id, stored_count
        from public.subscription_plans as plan
       where plan.code = 'supervisor-contract-created';

      if replayed.id is null
         or stored_id is null
         or replayed.id is distinct from stored_id
         or stored_count is distinct from 1
      then
        raise exception 'identical plan retry did not return one original row';
      end if;
    end
    $body$
  $test$,
  'an identical client-id retry returns the original plan once'
);

select throws_ok(
  $call$
    select public.supervisor_create_plan(
      'supervisor-contract-created',
      'Changed idempotent payload',
      50000,
      'LYD',
      'monthly'::public.billing_interval,
      1::smallint,
      7::smallint,
      true,
      '{"exports":true,"reports":true}'::jsonb,
      'Create through the audited supervisor path',
      '00000000-0000-0000-0000-000000000410'::uuid
    )
  $call$,
  'PT409',
  'idempotency_conflict',
  'a client-id retry with a changed payload is rejected'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      persisted public.subscription_plans;
      before_count bigint;
      audit_count bigint;
    begin
      select (snapshot ->> 'existing_count')::bigint
        into before_count
        from mutation_snapshots
       where snapshot_key = 'plan-create-before';

      select *
        into persisted
        from public.subscription_plans
       where code = 'supervisor-contract-created';

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
       where event.actor_user_id =
         '00000000-0000-0000-0000-000000000202'::uuid
         and event.action = 'supervisor_create_plan'
         and event.target_table = 'subscription_plans'
         and event.target_id = persisted.id
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000410'
         and event.metadata -> 'before' = 'null'::jsonb
         and event.metadata -> 'after' = pg_catalog.to_jsonb(persisted);

      if before_count is distinct from 0
         or persisted.id is null
         or persisted.code <> 'supervisor-contract-created'
         or persisted.name <> 'Supervisor contract created'
         or persisted.price_minor <> 50000
         or persisted.currency_code <> 'LYD'
         or persisted.billing_interval <> 'monthly'
         or persisted.interval_count <> 1
         or persisted.trial_days <> 7
         or not persisted.is_public
         or not persisted.is_active
         or persisted.features <>
           '{"exports":true,"reports":true}'::jsonb
         or audit_count is distinct from 1
      then
        raise exception 'created plan or exact audit snapshots are invalid';
      end if;
    end
    $body$
  $test$,
  'plan creation persists exact fields and null-to-row audit snapshots'
);

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'plan-update-before',
  pg_catalog.to_jsonb(plan)
from public.subscription_plans as plan
where plan.id = '00000000-0000-0000-0000-000000000305'::uuid;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_update_plan(
      '00000000-0000-0000-0000-000000000305'::uuid,
      'Contract updated through RPC',
      13000,
      'USD',
      'monthly'::public.billing_interval,
      2::smallint,
      10::smallint,
      true,
      '{"reports":true}'::jsonb,
      'Exercise audited plan update',
      '00000000-0000-0000-0000-000000000430'::uuid
    )
  $call$,
  'an active supervisor can update a plan through the RPC'
);

select lives_ok(
  $test$
    do $body$
    declare
      replayed public.subscription_plans;
    begin
      select *
        into replayed
        from public.supervisor_update_plan(
          '00000000-0000-0000-0000-000000000305'::uuid,
          'Contract updated through RPC',
          13000,
          'USD',
          'monthly'::public.billing_interval,
          2::smallint,
          10::smallint,
          true,
          '{"reports":true}'::jsonb,
          'Exercise audited plan update',
          '00000000-0000-0000-0000-000000000430'::uuid
        );

      if replayed.id is null
         or replayed.id is distinct from
           '00000000-0000-0000-0000-000000000305'::uuid
         or replayed.name <> 'Contract updated through RPC'
         or replayed.price_minor <> 13000
      then
        raise exception 'plan update replay did not return the stored result';
      end if;
    end
    $body$
  $test$,
  'an identical plan update retry returns its non-null original result'
);

select throws_ok(
  $call$
    select public.supervisor_update_plan(
      '00000000-0000-0000-0000-000000000305'::uuid,
      'Contract updated through RPC',
      14000,
      'USD',
      'monthly'::public.billing_interval,
      2::smallint,
      10::smallint,
      true,
      '{"reports":true}'::jsonb,
      'Exercise audited plan update',
      '00000000-0000-0000-0000-000000000430'::uuid
    )
  $call$,
  'PT409',
  'idempotency_conflict',
  'a changed plan update retry is rejected'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      persisted public.subscription_plans;
      audit_count bigint;
    begin
      select *
        into persisted
        from public.subscription_plans
       where id = '00000000-0000-0000-0000-000000000305'::uuid;

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
        join mutation_snapshots as expected
          on expected.snapshot_key = 'plan-update-before'
       where event.action = 'supervisor_update_plan'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.target_table = 'subscription_plans'
         and event.target_id =
           '00000000-0000-0000-0000-000000000305'::uuid
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000430'
         and event.metadata -> 'before' = expected.snapshot
         and event.metadata -> 'after' = pg_catalog.to_jsonb(persisted);

      if persisted.id is null
         or persisted.code <> 'contract-update-target'
         or persisted.name <> 'Contract updated through RPC'
         or persisted.price_minor <> 13000
         or persisted.currency_code <> 'USD'
         or persisted.billing_interval <> 'monthly'
         or persisted.interval_count <> 2
         or persisted.trial_days <> 10
         or not persisted.is_public
         or not persisted.is_active
         or persisted.features <> '{"reports":true}'::jsonb
         or audit_count is distinct from 1
      then
        raise exception 'persisted plan or exact audit snapshots are invalid';
      end if;
    end
    $body$
  $test$,
  'plan update persists exact fields and exact before/after audit snapshots'
);

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'archive-subscription-before',
  pg_catalog.to_jsonb(subscription)
from public.workspace_subscriptions as subscription
join public.workspaces as workspace
  on workspace.id = subscription.workspace_id
where workspace.created_by =
  '00000000-0000-0000-0000-000000000208'::uuid;

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'plan-archive-before',
  pg_catalog.to_jsonb(plan)
from public.subscription_plans as plan
where plan.id = '00000000-0000-0000-0000-000000000304'::uuid;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_archive_plan(
      '00000000-0000-0000-0000-000000000304'::uuid,
      'Archive through the supervisor RPC',
      '00000000-0000-0000-0000-000000000431'::uuid
    )
  $call$,
  'an active supervisor can archive a plan through the RPC'
);

select lives_ok(
  $test$
    do $body$
    declare
      replayed public.subscription_plans;
      persisted_plan public.subscription_plans;
      persisted_subscription public.workspace_subscriptions;
      expected_subscription jsonb;
      valid_link_count bigint;
    begin
      select *
        into replayed
        from public.supervisor_archive_plan(
          '00000000-0000-0000-0000-000000000304'::uuid,
          'Archive through the supervisor RPC',
          '00000000-0000-0000-0000-000000000431'::uuid
        );

      select *
        into persisted_plan
        from public.subscription_plans
       where id = '00000000-0000-0000-0000-000000000304'::uuid;

      select subscription.*
        into persisted_subscription
        from public.workspace_subscriptions as subscription
        join public.workspaces as workspace
          on workspace.id = subscription.workspace_id
       where workspace.created_by =
         '00000000-0000-0000-0000-000000000208'::uuid;

      select snapshot
        into expected_subscription
        from mutation_snapshots
       where snapshot_key = 'archive-subscription-before';

      select pg_catalog.count(*)
        into valid_link_count
        from public.workspace_subscriptions as subscription
        join public.subscription_plans as plan
          on plan.id = subscription.plan_id
        join public.workspaces as workspace
          on workspace.id = subscription.workspace_id
       where workspace.created_by =
         '00000000-0000-0000-0000-000000000208'::uuid
         and subscription.plan_id =
           '00000000-0000-0000-0000-000000000304'::uuid
         and not plan.is_active
         and not plan.is_public;

      if replayed.id is null
         or replayed.id is distinct from
           '00000000-0000-0000-0000-000000000304'::uuid
         or replayed.is_active
         or replayed.is_public
         or persisted_plan.id is null
         or persisted_plan.is_active
         or persisted_plan.is_public
         or persisted_subscription.id is null
         or persisted_subscription.plan_id is distinct from
           '00000000-0000-0000-0000-000000000304'::uuid
         or pg_catalog.to_jsonb(persisted_subscription) <>
           expected_subscription
         or valid_link_count is distinct from 1
      then
        raise exception 'archive changed a linked subscription or invalidated its FK';
      end if;
    end
    $body$
  $test$,
  'an identical archive retry returns its non-null archived result'
);

select throws_ok(
  $call$
    select public.supervisor_archive_plan(
      '00000000-0000-0000-0000-000000000304'::uuid,
      'Changed archive payload',
      '00000000-0000-0000-0000-000000000431'::uuid
    )
  $call$,
  'PT409',
  'idempotency_conflict',
  'a changed archive retry is rejected'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      persisted public.subscription_plans;
      before_plan jsonb;
      audit_count bigint;
    begin
      select *
        into persisted
        from public.subscription_plans
       where id = '00000000-0000-0000-0000-000000000304'::uuid;

      select snapshot
        into before_plan
        from mutation_snapshots
       where snapshot_key = 'plan-archive-before';

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
       where event.action = 'supervisor_archive_plan'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.target_table = 'subscription_plans'
         and event.target_id = persisted.id
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000431'
         and event.metadata -> 'before' = before_plan
         and event.metadata -> 'after' = pg_catalog.to_jsonb(persisted);

      if persisted.id is null
         or persisted.is_active
         or persisted.is_public
         or audit_count is distinct from 1
      then
        raise exception 'archived plan or exact audit snapshots are invalid';
      end if;
    end
    $body$
  $test$,
  'plan archive produces one exact row-to-row audit side effect'
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select throws_ok(
  $call$
    select public.supervisor_update_plan(
      (
        select id
        from public.subscription_plans
        where code = 'trial'
      ),
      '14-day trial',
      0,
      'LYD',
      'none'::public.billing_interval,
      null::smallint,
      13::smallint,
      false,
      '{}'::jsonb,
      'Public signup still requires a 14-day trial',
      '00000000-0000-0000-0000-000000000613'::uuid
    )
  $call$,
  'PT409',
  'last_trial_plan',
  'the signup fallback plan cannot be updated away from fourteen days'
);

select throws_ok(
  $call$
    select public.supervisor_archive_plan(
      (
        select id
        from public.subscription_plans
        where code = 'trial'
      ),
      'Public signup still requires the trial plan',
      '00000000-0000-0000-0000-000000000612'::uuid
    )
  $call$,
  'PT409',
  'last_trial_plan',
  'the final public trial plan cannot be archived'
);

reset role;

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'plan-change-before',
  pg_catalog.to_jsonb(subscription)
from public.workspace_subscriptions as subscription
join public.workspaces as workspace
  on workspace.id = subscription.workspace_id
where workspace.created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_change_subscription_plan(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      '00000000-0000-0000-0000-000000000303'::uuid,
      'Move to the yearly contract plan',
      '00000000-0000-0000-0000-000000000432'::uuid
    )
  $call$,
  'an active supervisor can change a customer plan'
);

select lives_ok(
  $test$
    do $body$
    declare
      replayed public.workspace_subscriptions;
    begin
      select *
        into replayed
        from public.supervisor_change_subscription_plan(
          (
            select id
            from public.workspaces
            where created_by =
              '00000000-0000-0000-0000-000000000204'::uuid
          ),
          '00000000-0000-0000-0000-000000000303'::uuid,
          'Move to the yearly contract plan',
          '00000000-0000-0000-0000-000000000432'::uuid
        );

      if replayed.id is null
         or replayed.plan_id is distinct from
           '00000000-0000-0000-0000-000000000303'::uuid
      then
        raise exception 'plan change replay did not return the stored result';
      end if;
    end
    $body$
  $test$,
  'an identical plan change retry returns its non-null original result'
);

select throws_ok(
  $call$
    select public.supervisor_change_subscription_plan(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      '00000000-0000-0000-0000-000000000301'::uuid,
      'Move to the yearly contract plan',
      '00000000-0000-0000-0000-000000000432'::uuid
    )
  $call$,
  'PT409',
  'idempotency_conflict',
  'a changed plan-change retry is rejected'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      before_subscription jsonb;
      persisted_subscription public.workspace_subscriptions;
      persisted_workspace public.workspaces;
      event_count bigint;
      audit_count bigint;
    begin
      select snapshot
        into before_subscription
        from mutation_snapshots
       where snapshot_key = 'plan-change-before';

      select subscription.*
        into persisted_subscription
        from public.workspace_subscriptions as subscription
        join public.workspaces as workspace
          on workspace.id = subscription.workspace_id
       where workspace.created_by =
         '00000000-0000-0000-0000-000000000204'::uuid;

      select *
        into persisted_workspace
        from public.workspaces
       where created_by =
         '00000000-0000-0000-0000-000000000204'::uuid;

      select pg_catalog.count(*)
        into event_count
        from public.subscription_events as event
       where event.event_type = 'supervisor_change_subscription_plan'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.subscription_id = persisted_subscription.id
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000432';

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
       where event.action = 'supervisor_change_subscription_plan'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.target_table = 'workspace_subscriptions'
         and event.target_id = persisted_subscription.id
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000432'
         and event.metadata -> 'before' ->> 'plan_id' =
           '00000000-0000-0000-0000-000000000301'
         and event.metadata -> 'after' ->> 'plan_id' =
           '00000000-0000-0000-0000-000000000303'
         and event.metadata -> 'before' = before_subscription
         and event.metadata -> 'after' =
           pg_catalog.to_jsonb(persisted_subscription);

      if before_subscription ->> 'plan_id' <>
           '00000000-0000-0000-0000-000000000301'
         or persisted_subscription.plan_id is distinct from
           '00000000-0000-0000-0000-000000000303'::uuid
         or persisted_workspace.status <> 'active'
         or event_count is distinct from 1
         or audit_count is distinct from 1
      then
        raise exception 'plan-change rows or exact audit values are invalid';
      end if;
    end
    $body$
  $test$,
  'plan change records exact old/new plan IDs and row snapshots'
);

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'state-transition-before',
  pg_catalog.to_jsonb(subscription)
from public.workspace_subscriptions as subscription
join public.workspaces as workspace
  on workspace.id = subscription.workspace_id
where workspace.created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'state-workspace-before',
  pg_catalog.to_jsonb(workspace)
from public.workspaces as workspace
where workspace.created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_set_subscription_state(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'grace'::public.subscription_status,
      null,
      pg_catalog.transaction_timestamp() + interval '40 days',
      pg_catalog.transaction_timestamp() + interval '7 days',
      'Move active subscription into grace',
      '00000000-0000-0000-0000-000000000433'::uuid
    )
  $call$,
  'an active supervisor can perform a valid state transition'
);

select lives_ok(
  $test$
    do $body$
    declare
      replayed public.workspace_subscriptions;
    begin
      select *
        into replayed
        from public.supervisor_set_subscription_state(
          (
            select id
            from public.workspaces
            where created_by =
              '00000000-0000-0000-0000-000000000204'::uuid
          ),
          'grace'::public.subscription_status,
          null,
          pg_catalog.transaction_timestamp() + interval '40 days',
          pg_catalog.transaction_timestamp() + interval '7 days',
          'Move active subscription into grace',
          '00000000-0000-0000-0000-000000000433'::uuid
        );

      if replayed.id is null
         or replayed.status <> 'grace'
         or replayed.grace_ends_at is distinct from
           pg_catalog.transaction_timestamp() + interval '7 days'
      then
        raise exception 'state transition replay did not return the stored result';
      end if;
    end
    $body$
  $test$,
  'an identical state-transition retry returns its non-null original result'
);

select throws_ok(
  $call$
    select public.supervisor_set_subscription_state(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'frozen'::public.subscription_status,
      null,
      pg_catalog.transaction_timestamp() + interval '40 days',
      null,
      'Move active subscription into grace',
      '00000000-0000-0000-0000-000000000433'::uuid
    )
  $call$,
  'PT409',
  'idempotency_conflict',
  'a changed state-transition retry is rejected'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      persisted_subscription public.workspace_subscriptions;
      persisted_workspace public.workspaces;
      before_subscription jsonb;
      before_workspace jsonb;
      event_count bigint;
      audit_count bigint;
    begin
      select snapshot
        into before_subscription
        from mutation_snapshots
       where snapshot_key = 'state-transition-before';

      select snapshot
        into before_workspace
        from mutation_snapshots
       where snapshot_key = 'state-workspace-before';

      select subscription.*
        into persisted_subscription
        from public.workspace_subscriptions as subscription
        join public.workspaces as workspace
          on workspace.id = subscription.workspace_id
       where workspace.created_by =
         '00000000-0000-0000-0000-000000000204'::uuid;

      select *
        into persisted_workspace
        from public.workspaces
       where created_by =
         '00000000-0000-0000-0000-000000000204'::uuid;

      select pg_catalog.count(*)
        into event_count
        from public.subscription_events as event
       where event.event_type = 'supervisor_set_subscription_state'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.from_status = 'active'
         and event.to_status = 'grace'
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000433';

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
       where event.action = 'supervisor_set_subscription_state'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000433'
         and event.metadata -> 'before' = before_subscription
         and event.metadata -> 'after' =
           pg_catalog.to_jsonb(persisted_subscription);

      if persisted_subscription.id is null
         or persisted_subscription.status <> 'grace'
         or persisted_subscription.plan_id is distinct from
           '00000000-0000-0000-0000-000000000303'::uuid
         or persisted_subscription.starts_at is distinct from
           (before_subscription ->> 'starts_at')::timestamp with time zone
         or persisted_subscription.trial_ends_at is not null
         or persisted_subscription.current_period_ends_at is distinct from
           pg_catalog.transaction_timestamp() + interval '40 days'
         or persisted_subscription.grace_ends_at is distinct from
           pg_catalog.transaction_timestamp() + interval '7 days'
         or persisted_subscription.frozen_at is not null
         or persisted_subscription.expired_at is not null
         or persisted_subscription.cancelled_at is not null
         or persisted_subscription.scheduled_status is not null
         or persisted_subscription.scheduled_status_at is not null
         or persisted_workspace.status <> 'active'
         or (
           pg_catalog.to_jsonb(persisted_workspace) - 'updated_at'
         ) <> (before_workspace - 'updated_at')
         or event_count is distinct from 1
         or audit_count is distinct from 1
      then
        raise exception 'persisted transition, workspace, event, or audit snapshots are invalid';
      end if;
    end
    $body$
  $test$,
  'valid transition persists exact rows and exact before/after audit snapshots'
);

update public.workspace_subscriptions
set status = 'active',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() + interval '40 days',
    grace_ends_at = null,
    frozen_at = null,
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by =
    '00000000-0000-0000-0000-000000000204'::uuid
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select throws_ok(
  pg_catalog.format(
    $template$
      select public.supervisor_create_plan(
        %L,
        'Invalid boundary plan',
        %s,
        'LYD',
        %L::public.billing_interval,
        %s,
        %s::smallint,
        true,
        %L::jsonb,
        'Reject invalid plan boundary',
        %L::uuid
      )
    $template$,
    invalid.code,
    invalid.price_minor,
    invalid.billing_interval,
    case
      when invalid.interval_count is null then 'null::smallint'
      else pg_catalog.format('%s::smallint', invalid.interval_count)
    end,
    invalid.trial_days,
    invalid.features,
    invalid.client_id
  ),
  '22023',
  invalid.error_message,
  invalid.description
)
from (
  values
    (
      'a',
      1000::bigint,
      'monthly',
      1,
      0,
      '{}'::text,
      '00000000-0000-0000-0000-000000000610',
      'invalid_plan_code',
      'plan code cannot be shorter than two characters'
    ),
    (
      pg_catalog.repeat('a', 41),
      1000::bigint,
      'monthly',
      1,
      0,
      '{}'::text,
      '00000000-0000-0000-0000-000000000611',
      'invalid_plan_code',
      'plan code cannot exceed forty characters'
    ),
    (
      'Bad Code',
      1000::bigint,
      'monthly',
      1,
      0,
      '{}'::text,
      '00000000-0000-0000-0000-000000000601',
      'invalid_plan_code',
      'plan code must satisfy the approved lowercase format'
    ),
    (
      'negative-price',
      (-1)::bigint,
      'monthly',
      1,
      0,
      '{}'::text,
      '00000000-0000-0000-0000-000000000602',
      'invalid_plan_price',
      'plan price cannot be negative'
    ),
    (
      'none-with-count',
      0::bigint,
      'none',
      1,
      0,
      '{}'::text,
      '00000000-0000-0000-0000-000000000603',
      'invalid_plan_interval',
      'none billing rejects an interval count'
    ),
    (
      'monthly-no-count',
      1000::bigint,
      'monthly',
      null::integer,
      0,
      '{}'::text,
      '00000000-0000-0000-0000-000000000604',
      'invalid_plan_interval',
      'recurring billing requires an interval count'
    ),
    (
      'monthly-zero-count',
      1000::bigint,
      'monthly',
      0,
      0,
      '{}'::text,
      '00000000-0000-0000-0000-000000000605',
      'invalid_plan_interval',
      'recurring interval count cannot be zero'
    ),
    (
      'monthly-large-count',
      1000::bigint,
      'monthly',
      37,
      0,
      '{}'::text,
      '00000000-0000-0000-0000-000000000606',
      'invalid_plan_interval',
      'recurring interval count cannot exceed 36'
    ),
    (
      'negative-trial',
      1000::bigint,
      'monthly',
      1,
      (-1),
      '{}'::text,
      '00000000-0000-0000-0000-000000000607',
      'invalid_trial_days',
      'trial days cannot be negative'
    ),
    (
      'large-trial',
      1000::bigint,
      'monthly',
      1,
      366,
      '{}'::text,
      '00000000-0000-0000-0000-000000000608',
      'invalid_trial_days',
      'trial days cannot exceed 365'
    ),
    (
      'array-features',
      1000::bigint,
      'monthly',
      1,
      0,
      '[]'::text,
      '00000000-0000-0000-0000-000000000609',
      'invalid_plan_features',
      'plan features must be a JSON object'
    )
) as invalid(
  code,
  price_minor,
  billing_interval,
  interval_count,
  trial_days,
  features,
  client_id,
  error_message,
  description
);

select throws_ok(
  $call$
    select public.supervisor_set_subscription_state(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'trialing'::public.subscription_status,
      pg_catalog.transaction_timestamp() + interval '14 days',
      pg_catalog.transaction_timestamp() + interval '40 days',
      null,
      'Active subscriptions cannot return to trial',
      '00000000-0000-0000-0000-000000000411'::uuid
    )
  $call$,
  'PT409',
  'invalid_subscription_transition',
  'an invalid subscription transition is rejected'
);

reset role;

create or replace function pg_temp.reset_transition_fixture(
  p_status public.subscription_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  execute $sql$
    update public.workspace_subscriptions
       set status = $1,
           trial_ends_at = case
             when $1 = 'trialing'::public.subscription_status
               then pg_catalog.transaction_timestamp() + interval '20 days'
             else null
           end,
           current_period_ends_at =
             pg_catalog.transaction_timestamp() + interval '40 days',
           grace_ends_at = case
             when $1 = 'grace'::public.subscription_status
               then pg_catalog.transaction_timestamp() + interval '7 days'
             else null
           end,
           frozen_at = case
             when $1 = 'frozen'::public.subscription_status
               then pg_catalog.transaction_timestamp()
             else null
           end,
           expired_at = case
             when $1 = 'expired'::public.subscription_status
               then pg_catalog.transaction_timestamp()
             else null
           end,
           cancelled_at = case
             when $1 = 'cancelled'::public.subscription_status
               then pg_catalog.transaction_timestamp()
             else null
           end,
           scheduled_status = null,
           scheduled_status_at = null
     where workspace_id = (
       select id
       from public.workspaces
       where created_by =
         '00000000-0000-0000-0000-000000000204'::uuid
     )
  $sql$
  using p_status;

  update public.workspaces
     set status = case
       when p_status in (
         'trialing'::public.subscription_status,
         'active'::public.subscription_status,
         'grace'::public.subscription_status
       ) then 'active'::public.workspace_status
       when p_status = 'frozen'::public.subscription_status
         then 'suspended'::public.workspace_status
       else 'archived'::public.workspace_status
     end
   where created_by =
     '00000000-0000-0000-0000-000000000204'::uuid;
end;
$function$;

grant execute on function pg_temp.reset_transition_fixture(
  public.subscription_status
) to authenticated;

create or replace function pg_temp.assert_transition_side_effects(
  p_client_id uuid,
  p_from_status public.subscription_status,
  p_to_status public.subscription_status,
  p_before_subscription jsonb,
  p_after_subscription jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  event_count bigint;
  audit_count bigint;
begin
  select pg_catalog.count(*)
    into event_count
    from public.subscription_events as event
   where event.event_type = 'supervisor_set_subscription_state'
     and event.actor_user_id =
       '00000000-0000-0000-0000-000000000202'::uuid
     and event.from_status = p_from_status
     and event.to_status = p_to_status
     and event.metadata ->> 'client_id' = p_client_id::text;

  select pg_catalog.count(*)
    into audit_count
    from audit.events as event
   where event.action = 'supervisor_set_subscription_state'
     and event.actor_user_id =
       '00000000-0000-0000-0000-000000000202'::uuid
     and event.target_table = 'workspace_subscriptions'
     and event.target_id =
       (p_after_subscription ->> 'id')::uuid
     and event.metadata ->> 'client_id' = p_client_id::text
     and event.metadata -> 'before' = p_before_subscription
     and event.metadata -> 'after' = p_after_subscription;

  if event_count is distinct from 1
     or audit_count is distinct from 1
  then
    raise exception 'transition side-effect count or snapshots are invalid';
  end if;
end;
$function$;

grant execute on function pg_temp.assert_transition_side_effects(
  uuid,
  public.subscription_status,
  public.subscription_status,
  jsonb,
  jsonb
) to authenticated;

create temporary table subscription_transition_matrix (
  ordinal integer generated always as identity primary key,
  from_status public.subscription_status not null,
  to_status public.subscription_status not null,
  is_allowed boolean not null,
  client_id uuid not null default extensions.gen_random_uuid()
);

insert into subscription_transition_matrix (
  from_status,
  to_status,
  is_allowed
)
select
  source.status,
  target.status,
  (
    (source.status = 'trialing' and target.status in (
      'active',
      'grace',
      'frozen',
      'expired',
      'cancelled'
    ))
    or (source.status = 'active' and target.status in (
      'grace',
      'frozen',
      'expired',
      'cancelled'
    ))
    or (source.status = 'grace' and target.status in (
      'active',
      'frozen',
      'expired',
      'cancelled'
    ))
    or (source.status = 'frozen' and target.status in (
      'active',
      'grace',
      'expired',
      'cancelled'
    ))
    or (source.status = 'expired' and target.status = 'active')
    or (source.status = 'cancelled' and target.status = 'active')
  )
from (
  values
    ('trialing'::public.subscription_status),
    ('active'::public.subscription_status),
    ('grace'::public.subscription_status),
    ('frozen'::public.subscription_status),
    ('expired'::public.subscription_status),
    ('cancelled'::public.subscription_status)
) as source(status)
cross join (
  values
    ('trialing'::public.subscription_status),
    ('active'::public.subscription_status),
    ('grace'::public.subscription_status),
    ('frozen'::public.subscription_status),
    ('expired'::public.subscription_status),
    ('cancelled'::public.subscription_status)
) as target(status);

grant select on subscription_transition_matrix to authenticated;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  pg_catalog.format(
    $test$
      do $body$
      declare
        source_status public.subscription_status :=
          %L::public.subscription_status;
        target_status public.subscription_status :=
          %L::public.subscription_status;
        transition_client_id uuid := %L::uuid;
        transitioned public.workspace_subscriptions;
        persisted_subscription public.workspace_subscriptions;
        persisted_workspace public.workspaces;
        before_subscription jsonb;
        before_workspace jsonb;
        called_before timestamp with time zone;
        called_after timestamp with time zone;
        expected_workspace_status public.workspace_status;
      begin
        perform pg_temp.reset_transition_fixture(
          source_status
        );

        select pg_catalog.to_jsonb(subscription)
          into before_subscription
          from public.workspace_subscriptions as subscription
          join public.workspaces as workspace
            on workspace.id = subscription.workspace_id
         where workspace.created_by =
           '00000000-0000-0000-0000-000000000204'::uuid;

        select pg_catalog.to_jsonb(workspace)
          into before_workspace
          from public.workspaces as workspace
         where workspace.created_by =
           '00000000-0000-0000-0000-000000000204'::uuid;

        called_before := pg_catalog.clock_timestamp();

        select *
          into transitioned
          from public.supervisor_set_subscription_state(
            (
              select id
              from public.workspaces
              where created_by =
                '00000000-0000-0000-0000-000000000204'::uuid
            ),
            target_status,
            case
              when target_status = 'trialing'
                then pg_catalog.transaction_timestamp() + interval '20 days'
              else null
            end,
            pg_catalog.transaction_timestamp() + interval '40 days',
            case
              when target_status = 'grace'
                then pg_catalog.transaction_timestamp() + interval '7 days'
              else null
            end,
            'Transition matrix allowed path',
            transition_client_id
          );

        called_after := pg_catalog.clock_timestamp();

        select subscription.*
          into persisted_subscription
          from public.workspace_subscriptions as subscription
          join public.workspaces as workspace
            on workspace.id = subscription.workspace_id
         where workspace.created_by =
           '00000000-0000-0000-0000-000000000204'::uuid;

        select *
          into persisted_workspace
          from public.workspaces
         where created_by =
           '00000000-0000-0000-0000-000000000204'::uuid;

        expected_workspace_status := case
          when target_status in ('active', 'grace')
            then 'active'::public.workspace_status
          when target_status = 'frozen'
            then 'suspended'::public.workspace_status
          else 'archived'::public.workspace_status
        end;

        if transitioned.id is null
           or persisted_subscription.id is null
           or persisted_subscription.id is distinct from transitioned.id
           or persisted_subscription.status <> target_status
           or persisted_subscription.workspace_id is distinct from
             (before_subscription ->> 'workspace_id')::uuid
           or persisted_subscription.plan_id is distinct from
             (before_subscription ->> 'plan_id')::uuid
           or persisted_subscription.starts_at is distinct from
             (before_subscription ->> 'starts_at')::timestamp with time zone
           or persisted_subscription.trial_ends_at is not null
           or persisted_subscription.current_period_ends_at is distinct from
             pg_catalog.transaction_timestamp() + interval '40 days'
           or persisted_subscription.grace_ends_at is distinct from case
             when target_status = 'grace'
               then pg_catalog.transaction_timestamp() + interval '7 days'
             else null
           end
           or (
             target_status = 'frozen'
             and (
               persisted_subscription.frozen_at is null
               or persisted_subscription.frozen_at < called_before
               or persisted_subscription.frozen_at > called_after
             )
           )
           or (
             target_status <> 'frozen'
             and persisted_subscription.frozen_at is not null
           )
           or (
             target_status = 'expired'
             and (
               persisted_subscription.expired_at is null
               or persisted_subscription.expired_at < called_before
               or persisted_subscription.expired_at > called_after
             )
           )
           or (
             target_status <> 'expired'
             and persisted_subscription.expired_at is not null
           )
           or (
             target_status = 'cancelled'
             and (
               persisted_subscription.cancelled_at is null
               or persisted_subscription.cancelled_at < called_before
               or persisted_subscription.cancelled_at > called_after
             )
           )
           or (
             target_status <> 'cancelled'
             and persisted_subscription.cancelled_at is not null
           )
           or persisted_subscription.scheduled_status is not null
           or persisted_subscription.scheduled_status_at is not null
           or persisted_workspace.status is distinct from
             expected_workspace_status
           or (
             pg_catalog.to_jsonb(persisted_workspace)
               - array['status', 'updated_at']::text[]
           ) <> (
             before_workspace - array['status', 'updated_at']::text[]
           )
        then
          raise exception 'allowed transition persisted invalid subscription/workspace state';
        end if;

        perform pg_temp.assert_transition_side_effects(
          transition_client_id,
          source_status,
          target_status,
          before_subscription,
          pg_catalog.to_jsonb(persisted_subscription)
        );
      end
      $body$
    $test$,
    matrix.from_status,
    matrix.to_status,
    matrix.client_id
  ),
  pg_catalog.format(
    'transition matrix allows %s -> %s',
    matrix.from_status,
    matrix.to_status
  )
)
from subscription_transition_matrix as matrix
where matrix.is_allowed
order by matrix.ordinal;

select throws_ok(
  pg_catalog.format(
    $test$
      do $body$
      begin
        perform pg_temp.reset_transition_fixture(
          %L::public.subscription_status
        );

        perform public.supervisor_set_subscription_state(
          (
            select id
            from public.workspaces
            where created_by =
              '00000000-0000-0000-0000-000000000204'::uuid
          ),
          %L::public.subscription_status,
          case
            when %L = 'trialing'
              then pg_catalog.transaction_timestamp() + interval '20 days'
            else null
          end,
          pg_catalog.transaction_timestamp() + interval '40 days',
          case
            when %L = 'grace'
              then pg_catalog.transaction_timestamp() + interval '7 days'
            else null
          end,
          'Transition matrix denied path',
          %L::uuid
        );
      end
      $body$
    $test$,
    matrix.from_status,
    matrix.to_status,
    matrix.to_status,
    matrix.to_status,
    matrix.client_id
  ),
  'PT409',
  'invalid_subscription_transition',
  pg_catalog.format(
    'transition matrix rejects %s -> %s',
    matrix.from_status,
    matrix.to_status
  )
)
from subscription_transition_matrix as matrix
where not matrix.is_allowed
order by matrix.ordinal;

reset role;

update public.workspace_subscriptions
set status = 'active',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() + interval '40 days',
    grace_ends_at = null,
    frozen_at = null,
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by =
    '00000000-0000-0000-0000-000000000204'::uuid
);

update public.workspaces
set status = 'active'
where created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'schedule-before',
  pg_catalog.to_jsonb(subscription)
from public.workspace_subscriptions as subscription
join public.workspaces as workspace
  on workspace.id = subscription.workspace_id
where workspace.created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select throws_ok(
  $call$
    select public.supervisor_change_subscription_plan(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      '00000000-0000-0000-0000-000000000302'::uuid,
      'Archived plans cannot be selected',
      '00000000-0000-0000-0000-000000000412'::uuid
    )
  $call$,
  'PT409',
  'inactive_plan',
  'a plan change cannot select an archived plan'
);

select throws_ok(
  $call$
    select public.supervisor_renew_subscription(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000205'::uuid
      ),
      1::smallint,
      'Archived plans cannot be renewed',
      '00000000-0000-0000-0000-000000000413'::uuid
    )
  $call$,
  'PT409',
  'inactive_plan',
  'a subscription on an archived plan cannot be renewed'
);

select throws_ok(
  $call$
    select public.supervisor_schedule_subscription_state(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'active'::public.subscription_status,
      pg_catalog.transaction_timestamp() + interval '10 days',
      'Only terminal states can be scheduled',
      '00000000-0000-0000-0000-000000000434'::uuid
    )
  $call$,
  '22023',
  'invalid_scheduled_subscription_state',
  'scheduling rejects a non-terminal target state'
);

select throws_ok(
  $call$
    select public.supervisor_schedule_subscription_state(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'cancelled'::public.subscription_status,
      pg_catalog.transaction_timestamp() - interval '1 second',
      'Scheduled state must be in the future',
      '00000000-0000-0000-0000-000000000435'::uuid
    )
  $call$,
  '22023',
  'invalid_scheduled_subscription_time',
  'scheduling rejects a timestamp in the past'
);

select throws_ok(
  $call$
    select public.supervisor_schedule_subscription_state(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'expired'::public.subscription_status,
      pg_catalog.transaction_timestamp() + interval '41 days',
      'Scheduled state cannot exceed the active period',
      '00000000-0000-0000-0000-000000000436'::uuid
    )
  $call$,
  '22023',
  'invalid_scheduled_subscription_time',
  'scheduling rejects a timestamp after the active period end'
);

select lives_ok(
  $call$
    select public.supervisor_schedule_subscription_state(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'cancelled'::public.subscription_status,
      pg_catalog.transaction_timestamp() + interval '10 days',
      'Cancel at the end of the approved window',
      '00000000-0000-0000-0000-000000000414'::uuid
    )
  $call$,
  'an active subscription can schedule a future cancellation'
);

select lives_ok(
  $test$
    do $body$
    declare
      subscription public.workspace_subscriptions;
    begin
      select *
        into subscription
        from public.workspace_subscriptions
       where workspace_id = (
         select id
         from public.workspaces
         where created_by =
           '00000000-0000-0000-0000-000000000204'::uuid
       );

      if subscription.status <> 'active'
         or subscription.scheduled_status <> 'cancelled'
         or subscription.scheduled_status_at is distinct from
           pg_catalog.transaction_timestamp() + interval '10 days'
      then
        raise exception 'scheduled cancellation state was not stored';
      end if;
    end
    $body$
  $test$,
  'scheduling preserves active status and stores the terminal state and time'
);

select lives_ok(
  $test$
    do $body$
    declare
      replayed public.workspace_subscriptions;
    begin
      select *
        into replayed
        from public.supervisor_schedule_subscription_state(
          (
            select id
            from public.workspaces
            where created_by =
              '00000000-0000-0000-0000-000000000204'::uuid
          ),
          'cancelled'::public.subscription_status,
          pg_catalog.transaction_timestamp() + interval '10 days',
          'Cancel at the end of the approved window',
          '00000000-0000-0000-0000-000000000414'::uuid
        );

      if replayed.id is null
         or replayed.scheduled_status <> 'cancelled'
         or replayed.scheduled_status_at is distinct from
           pg_catalog.transaction_timestamp() + interval '10 days'
      then
        raise exception 'schedule replay did not return the stored result';
      end if;
    end
    $body$
  $test$,
  'an identical schedule retry returns its non-null original result'
);

select throws_ok(
  $call$
    select public.supervisor_schedule_subscription_state(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'cancelled'::public.subscription_status,
      pg_catalog.transaction_timestamp() + interval '11 days',
      'Cancel at the end of the approved window',
      '00000000-0000-0000-0000-000000000414'::uuid
    )
  $call$,
  'PT409',
  'idempotency_conflict',
  'a changed schedule retry is rejected'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      before_subscription jsonb;
      persisted public.workspace_subscriptions;
      event_count bigint;
      audit_count bigint;
    begin
      select snapshot
        into before_subscription
        from mutation_snapshots
       where snapshot_key = 'schedule-before';

      select subscription.*
        into persisted
        from public.workspace_subscriptions as subscription
        join public.workspaces as workspace
          on workspace.id = subscription.workspace_id
       where workspace.created_by =
         '00000000-0000-0000-0000-000000000204'::uuid;

      select pg_catalog.count(*)
        into event_count
        from public.subscription_events as event
       where event.event_type = 'supervisor_schedule_subscription_state'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.subscription_id = persisted.id
         and event.from_status = 'active'
         and event.to_status = 'cancelled'
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000414';

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
       where event.action = 'supervisor_schedule_subscription_state'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.target_table = 'workspace_subscriptions'
         and event.target_id = persisted.id
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000414'
         and event.metadata -> 'before' = before_subscription
         and event.metadata -> 'after' = pg_catalog.to_jsonb(persisted);

      if persisted.status <> 'active'
         or persisted.scheduled_status <> 'cancelled'
         or persisted.scheduled_status_at is distinct from
           pg_catalog.transaction_timestamp() + interval '10 days'
         or audit_count is distinct from 1
         or event_count is distinct from 1
      then
        raise exception 'scheduled state or exact audit values are invalid';
      end if;
    end
    $body$
  $test$,
  'schedule records exact target/time and row audit snapshots'
);

create or replace function pg_temp.customer_read_keys()
returns text[]
language sql
immutable
set search_path = ''
as $function$
  select array[
    'user_id',
    'email',
    'display_name',
    'account_status',
    'last_sign_in_at',
    'workspace_id',
    'workspace_name',
    'default_currency_code',
    'workspace_status',
    'subscription_id',
    'subscription_status',
    'starts_at',
    'trial_ends_at',
    'current_period_ends_at',
    'grace_ends_at',
    'frozen_at',
    'expired_at',
    'cancelled_at',
    'scheduled_status',
    'scheduled_status_at',
    'effective_subscription_status',
    'plan_id',
    'plan_name',
    'pending_payments'
  ]::text[]
$function$;

create or replace function pg_temp.assert_json_page(
  p_result jsonb,
  p_total integer,
  p_id_key text,
  p_ordered_ids text[]
)
returns void
language plpgsql
set search_path = ''
as $function$
declare
  actual_ids text[];
begin
  if pg_catalog.jsonb_typeof(p_result) <> 'object'
     or not (p_result ?& array['rows', 'total']::text[])
     or (
       select pg_catalog.count(*)
       from pg_catalog.jsonb_object_keys(p_result)
     ) <> 2
     or (p_result ->> 'total')::integer is distinct from p_total
  then
    raise exception 'invalid JSON page envelope: %', p_result;
  end if;

  select coalesce(
    pg_catalog.array_agg(item.value ->> p_id_key order by item.ordinality),
    array[]::text[]
  )
    into actual_ids
    from pg_catalog.jsonb_array_elements(p_result -> 'rows')
      with ordinality as item(value, ordinality);

  if actual_ids is distinct from p_ordered_ids then
    raise exception 'unexpected ordered ids: %, expected %',
      actual_ids,
      p_ordered_ids;
  end if;
end;
$function$;

grant execute on function pg_temp.customer_read_keys() to authenticated;
grant execute on function pg_temp.assert_json_page(
  jsonb,
  integer,
  text,
  text[]
) to authenticated;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

-- Restricted read models: exact allow-listed fields, no auth internals, and
-- totals computed before pagination.
select lives_ok(
  $test$
    do $body$
    declare
      first_page jsonb;
      second_page jsonb;
      first_row jsonb;
      second_row jsonb;
      allowed_keys text[] := pg_temp.customer_read_keys();
    begin
      first_page := public.supervisor_list_customers(
        'Read Model Contract',
        'active'::public.account_status,
        null,
        null,
        1,
        0
      );
      second_page := public.supervisor_list_customers(
        'Read Model Contract',
        'active'::public.account_status,
        null,
        null,
        1,
        1
      );

      perform pg_temp.assert_json_page(
        first_page,
        2,
        'user_id',
        array['00000000-0000-0000-0000-000000000205']::text[]
      );
      perform pg_temp.assert_json_page(
        second_page,
        2,
        'user_id',
        array['00000000-0000-0000-0000-000000000204']::text[]
      );

      first_row := first_page -> 'rows' -> 0;
      second_row := second_page -> 'rows' -> 0;

      if not (first_row ?& allowed_keys)
         or (
           select pg_catalog.count(*)
           from pg_catalog.jsonb_object_keys(first_row)
         ) <> pg_catalog.cardinality(allowed_keys)
         or not (second_row ?& allowed_keys)
         or (
           select pg_catalog.count(*)
           from pg_catalog.jsonb_object_keys(second_row)
         ) <> pg_catalog.cardinality(allowed_keys)
         or second_row ->> 'scheduled_status' <> 'cancelled'
         or second_row ->> 'effective_subscription_status' <> 'active'
         or first_row ?| array[
           'encrypted_password',
           'confirmation_token',
           'recovery_token',
           'raw_app_meta_data',
           'raw_user_meta_data'
         ]::text[]
         or second_row ?| array[
           'encrypted_password',
           'confirmation_token',
           'recovery_token',
           'raw_app_meta_data',
           'raw_user_meta_data'
         ]::text[]
      then
        raise exception 'customer rows are not the approved allow-list: %, %',
          first_row,
          second_row;
      end if;
    end
    $body$
  $test$,
  'customer list returns only explicit fields and the pre-pagination total'
);

select lives_ok(
  $test$
    do $body$
    declare
      result jsonb;
      allowed_keys text[] := pg_temp.customer_read_keys();
    begin
      result := public.supervisor_get_customer(
        '00000000-0000-0000-0000-000000000204'::uuid
      );

      if pg_catalog.jsonb_typeof(result) <> 'object'
         or not (result ?& allowed_keys)
         or (
           select pg_catalog.count(*)
           from pg_catalog.jsonb_object_keys(result)
         ) <> pg_catalog.cardinality(allowed_keys)
         or result ->> 'user_id' <>
           '00000000-0000-0000-0000-000000000204'
         or result ?| array[
           'encrypted_password',
           'confirmation_token',
           'recovery_token',
           'raw_app_meta_data',
           'raw_user_meta_data'
         ]::text[]
      then
        raise exception 'customer detail fields are not the approved allow-list: %',
          result;
      end if;
    end
    $body$
  $test$,
  'customer detail returns only its explicit control-plane fields'
);

select lives_ok(
  $test$
    do $body$
    declare
      result jsonb;
    begin
      result := public.supervisor_list_customers(
        null::text,
        null::public.account_status,
        'expired'::public.subscription_status,
        null::uuid,
        100,
        0
      );

      perform pg_temp.assert_json_page(
        result,
        1,
        'user_id',
        array['00000000-0000-0000-0000-000000000205']::text[]
      );
    end
    $body$
  $test$,
  'customer subscription-status filter independently excludes decoys'
);

select lives_ok(
  $test$
    do $body$
    declare
      result jsonb;
    begin
      result := public.supervisor_list_customers(
        null::text,
        null::public.account_status,
        null::public.subscription_status,
        '00000000-0000-0000-0000-000000000304'::uuid,
        100,
        0
      );

      perform pg_temp.assert_json_page(
        result,
        1,
        'user_id',
        array['00000000-0000-0000-0000-000000000208']::text[]
      );
    end
    $body$
  $test$,
  'customer plan filter independently selects the archived-plan decoy'
);

select lives_ok(
  $test$
    do $body$
    declare
      result jsonb;
      active_only jsonb;
      plan_row jsonb;
      allowed_keys text[] := array[
        'plan_id',
        'code',
        'name',
        'price_minor',
        'currency_code',
        'billing_interval',
        'interval_count',
        'trial_days',
        'is_public',
        'is_active',
        'features',
        'created_at',
        'updated_at',
        'subscription_counts'
      ]::text[];
      status_keys text[] := array[
        'trialing',
        'active',
        'grace',
        'frozen',
        'expired',
        'cancelled'
      ]::text[];
    begin
      result := public.supervisor_list_plans(true);
      active_only := public.supervisor_list_plans(false);

      perform pg_temp.assert_json_page(
        result,
        7,
        'code',
        array[
          'contract-archive-target',
          'contract-archived',
          'contract-monthly-base',
          'contract-update-target',
          'contract-yearly-target',
          'supervisor-contract-created',
          'trial'
        ]::text[]
      );
      perform pg_temp.assert_json_page(
        active_only,
        5,
        'code',
        array[
          'contract-monthly-base',
          'contract-update-target',
          'contract-yearly-target',
          'supervisor-contract-created',
          'trial'
        ]::text[]
      );

      select item.value
        into plan_row
        from pg_catalog.jsonb_array_elements(result -> 'rows') as item(value)
       where item.value ->> 'code' = 'contract-monthly-base';

      if plan_row is null
         or not (plan_row ?& allowed_keys)
         or (
           select pg_catalog.count(*)
           from pg_catalog.jsonb_object_keys(plan_row)
         ) <> pg_catalog.cardinality(allowed_keys)
         or not (plan_row -> 'subscription_counts' ?& status_keys)
         or (
           select pg_catalog.count(*)
           from pg_catalog.jsonb_object_keys(
             plan_row -> 'subscription_counts'
           )
         ) <> pg_catalog.cardinality(status_keys)
         or (plan_row -> 'subscription_counts' ->> 'trialing')::integer <> 0
         or (plan_row -> 'subscription_counts' ->> 'active')::integer <> 0
         or (plan_row -> 'subscription_counts' ->> 'grace')::integer <> 0
         or (plan_row -> 'subscription_counts' ->> 'frozen')::integer <> 0
         or (plan_row -> 'subscription_counts' ->> 'expired')::integer <> 0
         or (plan_row -> 'subscription_counts' ->> 'cancelled')::integer <> 0
      then
        raise exception 'plan row fields or status counts are invalid: %',
          plan_row;
      end if;

      select item.value
        into plan_row
        from pg_catalog.jsonb_array_elements(result -> 'rows') as item(value)
       where item.value ->> 'code' = 'contract-yearly-target';

      if (plan_row -> 'subscription_counts' ->> 'active')::integer <> 1
         or (
           select pg_catalog.sum((count_value.value)::integer)
           from pg_catalog.jsonb_each_text(
             plan_row -> 'subscription_counts'
           ) as count_value(key, value)
         ) <> 1
      then
        raise exception 'yearly target plan counts are invalid: %', plan_row;
      end if;

      select item.value
        into plan_row
        from pg_catalog.jsonb_array_elements(result -> 'rows') as item(value)
       where item.value ->> 'code' = 'contract-archived';

      if plan_row is null
         or (plan_row ->> 'is_active')::boolean
         or (plan_row ->> 'is_public')::boolean
         or (plan_row -> 'subscription_counts' ->> 'expired')::integer <> 1
      then
        raise exception 'pre-archived plan inclusion/count is invalid: %',
          plan_row;
      end if;

      select item.value
        into plan_row
        from pg_catalog.jsonb_array_elements(result -> 'rows') as item(value)
       where item.value ->> 'code' = 'contract-archive-target';

      if plan_row is null
         or (plan_row ->> 'is_active')::boolean
         or (plan_row ->> 'is_public')::boolean
         or (plan_row -> 'subscription_counts' ->> 'frozen')::integer <> 1
         or (
           select pg_catalog.sum((count_value.value)::integer)
           from pg_catalog.jsonb_each_text(
             plan_row -> 'subscription_counts'
           ) as count_value(key, value)
         ) <> 1
      then
        raise exception 'RPC-archived plan was not included as archived: %',
          plan_row;
      end if;

      select item.value
        into plan_row
        from pg_catalog.jsonb_array_elements(result -> 'rows') as item(value)
       where item.value ->> 'code' = 'trial';

      if (plan_row -> 'subscription_counts' ->> 'trialing')::integer <> 3
         or (
           select pg_catalog.sum((count_value.value)::integer)
           from pg_catalog.jsonb_each_text(
             plan_row -> 'subscription_counts'
           ) as count_value(key, value)
         ) <> 3
      then
        raise exception 'trial plan counts are invalid: %', plan_row;
      end if;
    end
    $body$
  $test$,
  'plan list exposes only plan fields and per-state subscription counts'
);

select lives_ok(
  $test$
    do $body$
    declare
      returned public.subscription_plans;
      persisted public.subscription_plans;
    begin
      select *
        into returned
        from public.supervisor_create_plan(
          'boundary_plan_36',
          'Inclusive recurring boundaries',
          0,
          'LYD',
          'monthly'::public.billing_interval,
          36::smallint,
          365::smallint,
          true,
          '{"boundary":true}'::jsonb,
          'Accept inclusive recurring boundaries',
          '00000000-0000-0000-0000-000000000620'::uuid
        );

      select *
        into persisted
        from public.subscription_plans
       where code = 'boundary_plan_36';

      if returned.id is null
         or persisted.id is distinct from returned.id
         or persisted.code <> 'boundary_plan_36'
         or persisted.price_minor <> 0
         or persisted.billing_interval <> 'monthly'
         or persisted.interval_count <> 36
         or persisted.trial_days <> 365
         or persisted.features <> '{"boundary":true}'::jsonb
      then
        raise exception 'inclusive recurring plan boundaries were not persisted';
      end if;
    end
    $body$
  $test$,
  'plan accepts underscore code, zero price, interval 36, and trial 365'
);

select lives_ok(
  $test$
    do $body$
    declare
      returned public.subscription_plans;
      persisted public.subscription_plans;
    begin
      select *
        into returned
        from public.supervisor_create_plan(
          'boundary_none_plan',
          'Inclusive non-recurring boundary',
          0,
          'LYD',
          'none'::public.billing_interval,
          null::smallint,
          0::smallint,
          false,
          '{}'::jsonb,
          'Accept null interval for non-recurring plan',
          '00000000-0000-0000-0000-000000000621'::uuid
        );

      select *
        into persisted
        from public.subscription_plans
       where code = 'boundary_none_plan';

      if returned.id is null
         or persisted.id is distinct from returned.id
         or persisted.price_minor <> 0
         or persisted.billing_interval <> 'none'
         or persisted.interval_count is not null
         or persisted.trial_days <> 0
      then
        raise exception 'non-recurring null interval boundary was not persisted';
      end if;
    end
    $body$
  $test$,
  'plan accepts billing_interval none with a null interval count'
);

select lives_ok(
  $test$
    do $body$
    declare
      result jsonb;
      payment_row jsonb;
      allowed_keys text[] := array[
        'payment_request_id',
        'status',
        'amount_minor',
        'currency_code',
        'period_count',
        'proof_object_path',
        'requester_note',
        'review_note',
        'reviewed_at',
        'created_at',
        'workspace_id',
        'workspace_name',
        'user_id',
        'email',
        'display_name',
        'plan_id',
        'plan_name',
        'reviewed_by',
        'reviewer_display_name'
      ]::text[];
    begin
      result := public.supervisor_list_payments(
        'pending'::public.payment_request_status,
        'Read Model Contract Alpha',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'LYD',
        pg_catalog.transaction_timestamp() - interval '1 day',
        pg_catalog.transaction_timestamp() + interval '1 day',
        1,
        0
      );

      if pg_catalog.jsonb_typeof(result) <> 'object'
         or not (result ?& array['rows', 'total']::text[])
         or (
           select pg_catalog.count(*)
           from pg_catalog.jsonb_object_keys(result)
         ) <> 2
         or (result ->> 'total')::integer <> 1
         or pg_catalog.jsonb_array_length(result -> 'rows') <> 1
      then
        raise exception 'payment pagination envelope is invalid: %', result;
      end if;

      payment_row := result -> 'rows' -> 0;

      if not (payment_row ?& allowed_keys)
         or (
           select pg_catalog.count(*)
           from pg_catalog.jsonb_object_keys(payment_row)
         ) <> pg_catalog.cardinality(allowed_keys)
         or payment_row ->> 'payment_request_id' <>
           '00000000-0000-0000-0000-000000000501'
         or payment_row ?| array[
           'encrypted_password',
           'raw_app_meta_data',
           'raw_user_meta_data'
         ]::text[]
      then
        raise exception 'payment row fields are not the approved allow-list: %',
          payment_row;
      end if;
    end
    $body$
  $test$,
  'payment list returns explicit enriched fields and the filtered total'
);

select lives_ok(
  pg_catalog.format(
    $test$
      do $body$
      declare
        result jsonb;
      begin
        result := %s;
        perform pg_temp.assert_json_page(
          result,
          %s,
          'payment_request_id',
          %L::text[]
        );
      end
      $body$
    $test$,
    filter_case.expression,
    filter_case.expected_total,
    filter_case.expected_ids
  ),
  filter_case.description
)
from (
  values
    (
      $expression$
        public.supervisor_list_payments(
          'pending'::public.payment_request_status,
          null::text,
          null::uuid,
          null::text,
          null::timestamp with time zone,
          null::timestamp with time zone,
          100,
          0
        )
      $expression$,
      2,
      array[
        '00000000-0000-0000-0000-000000000502',
        '00000000-0000-0000-0000-000000000501'
      ]::text[],
      'payment status filter is independent and deterministically ordered'
    ),
    (
      $expression$
        public.supervisor_list_payments(
          null::public.payment_request_status,
          'Read Model Contract Alpha',
          null::uuid,
          null::text,
          null::timestamp with time zone,
          null::timestamp with time zone,
          100,
          0
        )
      $expression$,
      3,
      array[
        '00000000-0000-0000-0000-000000000504',
        '00000000-0000-0000-0000-000000000502',
        '00000000-0000-0000-0000-000000000501'
      ]::text[],
      'payment customer query filter is independent'
    ),
    (
      $expression$
        public.supervisor_list_payments(
          null::public.payment_request_status,
          null::text,
          '00000000-0000-0000-0000-000000000301'::uuid,
          null::text,
          null::timestamp with time zone,
          null::timestamp with time zone,
          100,
          0
        )
      $expression$,
      2,
      array[
        '00000000-0000-0000-0000-000000000504',
        '00000000-0000-0000-0000-000000000501'
      ]::text[],
      'payment plan filter is independent'
    ),
    (
      $expression$
        public.supervisor_list_payments(
          null::public.payment_request_status,
          null::text,
          null::uuid,
          'LYD',
          null::timestamp with time zone,
          null::timestamp with time zone,
          100,
          0
        )
      $expression$,
      2,
      array[
        '00000000-0000-0000-0000-000000000504',
        '00000000-0000-0000-0000-000000000501'
      ]::text[],
      'payment currency filter is independent'
    ),
    (
      $expression$
        public.supervisor_list_payments(
          null::public.payment_request_status,
          null::text,
          null::uuid,
          null::text,
          pg_catalog.transaction_timestamp() - interval '1 day',
          pg_catalog.transaction_timestamp() + interval '1 minute',
          100,
          0
        )
      $expression$,
      3,
      array[
        '00000000-0000-0000-0000-000000000504',
        '00000000-0000-0000-0000-000000000502',
        '00000000-0000-0000-0000-000000000501'
      ]::text[],
      'payment date filter is independent'
    ),
    (
      $expression$
        public.supervisor_list_payments(
          null::public.payment_request_status,
          null::text,
          null::uuid,
          null::text,
          null::timestamp with time zone,
          null::timestamp with time zone,
          2,
          1
        )
      $expression$,
      4,
      array[
        '00000000-0000-0000-0000-000000000502',
        '00000000-0000-0000-0000-000000000501'
      ]::text[],
      'payment pagination uses created_at descending then id descending'
    )
) as filter_case(
  expression,
  expected_total,
  expected_ids,
  description
);

reset role;

update public.workspace_subscriptions
set plan_id = '00000000-0000-0000-0000-000000000301'::uuid,
    status = 'active',
    trial_ends_at = null,
    current_period_ends_at =
      pg_catalog.transaction_timestamp() + interval '30 days',
    grace_ends_at = null,
    frozen_at = null,
    expired_at = null,
    cancelled_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by =
    '00000000-0000-0000-0000-000000000205'::uuid
);

update public.workspaces
set status = 'active'
where created_by =
  '00000000-0000-0000-0000-000000000205'::uuid;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $test$
    do $body$
    declare
      returned public.workspace_subscriptions;
      persisted public.workspace_subscriptions;
    begin
      select *
        into returned
        from public.supervisor_schedule_subscription_state(
          (
            select id
            from public.workspaces
            where created_by =
              '00000000-0000-0000-0000-000000000205'::uuid
          ),
          'expired'::public.subscription_status,
          pg_catalog.transaction_timestamp() + interval '5 days',
          'Exercise inclusive scheduled-expiry target',
          '00000000-0000-0000-0000-000000000622'::uuid
        );

      select subscription.*
        into persisted
        from public.workspace_subscriptions as subscription
        join public.workspaces as workspace
          on workspace.id = subscription.workspace_id
       where workspace.created_by =
         '00000000-0000-0000-0000-000000000205'::uuid;

      if returned.id is null
         or persisted.id is distinct from returned.id
         or persisted.status <> 'active'
         or persisted.scheduled_status <> 'expired'
         or persisted.scheduled_status_at is distinct from
           pg_catalog.transaction_timestamp() + interval '5 days'
         or persisted.current_period_ends_at is distinct from
           pg_catalog.transaction_timestamp() + interval '30 days'
      then
        raise exception 'scheduled expired boundary was not persisted';
      end if;
    end
    $body$
  $test$,
  'active subscription accepts a future scheduled expired state'
);

reset role;

select lives_ok(
  $statement$
    update public.workspace_subscriptions
       set status = 'frozen',
           trial_ends_at =
             pg_catalog.transaction_timestamp() - interval '20 days',
           grace_ends_at =
             pg_catalog.transaction_timestamp() - interval '15 days',
           frozen_at =
             pg_catalog.transaction_timestamp() - interval '10 days',
           expired_at =
             pg_catalog.transaction_timestamp() - interval '5 days',
           cancelled_at =
             pg_catalog.transaction_timestamp() - interval '1 day',
           scheduled_status = 'cancelled',
           scheduled_status_at =
             pg_catalog.transaction_timestamp() + interval '10 days'
     where workspace_id = (
       select id
       from public.workspaces
       where created_by =
         '00000000-0000-0000-0000-000000000204'::uuid
     )
  $statement$,
  'renewal fixture contains every stale state marker'
);

update public.workspaces
set status = 'suspended'
where created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'renewal-before',
  pg_catalog.to_jsonb(subscription)
from public.workspace_subscriptions as subscription
join public.workspaces as workspace
  on workspace.id = subscription.workspace_id
where workspace.created_by =
  '00000000-0000-0000-0000-000000000204'::uuid;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_renew_subscription(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      1::smallint,
      'Renew from the existing future period end',
      '00000000-0000-0000-0000-000000000415'::uuid
    )
  $call$,
  'an active supervisor can renew an active subscription'
);

select is(
  (
    select subscription.current_period_ends_at
    from public.workspace_subscriptions as subscription
    join public.workspaces as workspace
      on workspace.id = subscription.workspace_id
    where workspace.created_by =
      '00000000-0000-0000-0000-000000000204'::uuid
  ),
  (
    pg_catalog.transaction_timestamp()
      + interval '40 days'
      + interval '1 year'
  ),
  'renewal extends a future period from its existing end'
);

select lives_ok(
  $test$
    do $body$
    declare
      subscription public.workspace_subscriptions;
    begin
      select *
        into subscription
        from public.workspace_subscriptions
       where workspace_id = (
         select id
         from public.workspaces
         where created_by =
           '00000000-0000-0000-0000-000000000204'::uuid
       );

      if subscription.status <> 'active'
         or subscription.trial_ends_at is not null
         or subscription.grace_ends_at is not null
         or subscription.frozen_at is not null
         or subscription.expired_at is not null
         or subscription.cancelled_at is not null
         or subscription.scheduled_status is not null
         or subscription.scheduled_status_at is not null
         or (
           select workspace.status
           from public.workspaces as workspace
           where workspace.id = subscription.workspace_id
         ) <> 'active'
      then
        raise exception 'renewal did not clear scheduled subscription state';
      end if;
    end
    $body$
  $test$,
  'renewal activates the subscription and clears scheduled state'
);

select lives_ok(
  $test$
    do $body$
    declare
      replayed public.workspace_subscriptions;
    begin
      select *
        into replayed
        from public.supervisor_renew_subscription(
          (
            select id
            from public.workspaces
            where created_by =
              '00000000-0000-0000-0000-000000000204'::uuid
          ),
          1::smallint,
          'Renew from the existing future period end',
          '00000000-0000-0000-0000-000000000415'::uuid
        );

      if replayed.id is null
         or replayed.current_period_ends_at is distinct from (
           pg_catalog.transaction_timestamp()
             + interval '40 days'
             + interval '1 year'
         )
      then
        raise exception 'renewal replay did not return the stored result';
      end if;
    end
    $body$
  $test$,
  'an identical renewal retry returns its non-null original result'
);

select is(
  (
    select subscription.current_period_ends_at
    from public.workspace_subscriptions as subscription
    join public.workspaces as workspace
      on workspace.id = subscription.workspace_id
    where workspace.created_by =
      '00000000-0000-0000-0000-000000000204'::uuid
  ),
  (
    pg_catalog.transaction_timestamp()
      + interval '40 days'
      + interval '1 year'
  ),
  'an identical renewal retry does not extend the period twice'
);

select throws_ok(
  $call$
    select public.supervisor_renew_subscription(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      2::smallint,
      'Renew from the existing future period end',
      '00000000-0000-0000-0000-000000000415'::uuid
    )
  $call$,
  'PT409',
  'idempotency_conflict',
  'a changed renewal retry is rejected'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      before_subscription jsonb;
      persisted public.workspace_subscriptions;
      workspace_status public.workspace_status;
      event_count bigint;
      audit_count bigint;
    begin
      select snapshot
        into before_subscription
        from mutation_snapshots
       where snapshot_key = 'renewal-before';

      select subscription.*
        into persisted
        from public.workspace_subscriptions as subscription
        join public.workspaces as workspace
          on workspace.id = subscription.workspace_id
       where workspace.created_by =
         '00000000-0000-0000-0000-000000000204'::uuid;

      select workspace.status
        into workspace_status
        from public.workspaces as workspace
       where workspace.created_by =
         '00000000-0000-0000-0000-000000000204'::uuid;

      select pg_catalog.count(*)
        into event_count
        from public.subscription_events as event
       where event.subscription_id = persisted.id
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.event_type = 'supervisor_renew_subscription'
         and event.from_status = 'frozen'
         and event.to_status = 'active'
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000415';

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
       where event.actor_user_id =
         '00000000-0000-0000-0000-000000000202'::uuid
         and event.action = 'supervisor_renew_subscription'
         and event.target_table = 'workspace_subscriptions'
         and event.target_id = persisted.id
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000415'
         and event.metadata -> 'before' = before_subscription
         and event.metadata -> 'after' = pg_catalog.to_jsonb(persisted);

      if before_subscription ->> 'status' <> 'frozen'
         or persisted.status <> 'active'
         or persisted.current_period_ends_at is distinct from (
           pg_catalog.transaction_timestamp()
             + interval '40 days'
             + interval '1 year'
         )
         or persisted.trial_ends_at is not null
         or persisted.grace_ends_at is not null
         or persisted.frozen_at is not null
         or persisted.expired_at is not null
         or persisted.cancelled_at is not null
         or persisted.scheduled_status is not null
         or persisted.scheduled_status_at is not null
         or workspace_status <> 'active'
         or event_count is distinct from 1
         or audit_count is distinct from 1
      then
        raise exception 'renewal state/date or exact audit values are invalid';
      end if;
    end
    $body$
  $test$,
  'renewal records exact state/date and row audit snapshots'
);

update public.workspace_subscriptions
set plan_id = '00000000-0000-0000-0000-000000000301'::uuid,
    status = 'expired',
    current_period_ends_at =
      pg_catalog.transaction_timestamp() - interval '10 days',
    expired_at = pg_catalog.transaction_timestamp() - interval '10 days',
    frozen_at = null,
    cancelled_at = null,
    grace_ends_at = null
where workspace_id = (
  select id
  from public.workspaces
  where created_by =
    '00000000-0000-0000-0000-000000000205'::uuid
);

update public.workspaces
set status = 'archived'
where created_by =
  '00000000-0000-0000-0000-000000000205'::uuid;

create temporary table renewal_clock_bounds (
  bound_name text primary key,
  measured_at timestamp with time zone not null
);

insert into renewal_clock_bounds (bound_name, measured_at)
values ('before', pg_catalog.clock_timestamp());

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_renew_subscription(
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000205'::uuid
      ),
      1::smallint,
      'Renew from the current clock after expiry',
      '00000000-0000-0000-0000-000000000416'::uuid
    )
  $call$,
  'an expired subscription on an active plan can be renewed'
);

reset role;
insert into renewal_clock_bounds (bound_name, measured_at)
values ('after', pg_catalog.clock_timestamp());

select ok(
  (
    select
      subscription.current_period_ends_at >=
        before_bound.measured_at + interval '1 month'
      and subscription.current_period_ends_at <=
        after_bound.measured_at + interval '1 month'
      and workspace.status = 'active'
    from public.workspace_subscriptions as subscription
    join public.workspaces as workspace
      on workspace.id = subscription.workspace_id
    cross join renewal_clock_bounds as before_bound
    cross join renewal_clock_bounds as after_bound
    where workspace.created_by =
      '00000000-0000-0000-0000-000000000205'::uuid
      and before_bound.bound_name = 'before'
      and after_bound.bound_name = 'after'
  ),
  'renewal of a past period extends from the current clock'
);

insert into mutation_snapshots (snapshot_key, snapshot)
select
  'notification-create-before',
  pg_catalog.jsonb_build_object(
    'existing_count',
    pg_catalog.count(*)
  )
from public.notifications as notification
where notification.metadata ->> 'client_id' =
  '00000000-0000-0000-0000-000000000417';

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_send_notification(
      '00000000-0000-0000-0000-000000000204'::uuid,
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'billing',
      'Contract renewal notice',
      'Your workspace subscription was renewed by a supervisor.',
      '{"contract_marker":"notification-actor"}'::jsonb,
      'Notification contract coverage',
      '00000000-0000-0000-0000-000000000417'::uuid
    )
  $call$,
  'an active supervisor can send an in-app notification'
);

select lives_ok(
  $test$
    do $body$
    declare
      replayed public.notifications;
    begin
      select *
        into replayed
        from public.supervisor_send_notification(
          '00000000-0000-0000-0000-000000000204'::uuid,
          (
            select id
            from public.workspaces
            where created_by =
              '00000000-0000-0000-0000-000000000204'::uuid
          ),
          'billing',
          'Contract renewal notice',
          'Your workspace subscription was renewed by a supervisor.',
          '{"contract_marker":"notification-actor"}'::jsonb,
          'Notification contract coverage',
          '00000000-0000-0000-0000-000000000417'::uuid
        );

      if replayed.id is null
         or replayed.user_id is distinct from
           '00000000-0000-0000-0000-000000000204'::uuid
      then
        raise exception 'notification replay did not return the original result';
      end if;
    end
    $body$
  $test$,
  'an identical notification retry returns its non-null original result'
);

select throws_ok(
  $call$
    select public.supervisor_send_notification(
      '00000000-0000-0000-0000-000000000204'::uuid,
      (
        select id
        from public.workspaces
        where created_by =
          '00000000-0000-0000-0000-000000000204'::uuid
      ),
      'billing',
      'Contract renewal notice',
      'Changed notification body.',
      '{"contract_marker":"notification-actor"}'::jsonb,
      'Notification contract coverage',
      '00000000-0000-0000-0000-000000000417'::uuid
    )
  $call$,
  'PT409',
  'idempotency_conflict',
  'a changed notification retry is rejected'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      before_count bigint;
      persisted public.notifications;
      stored_count bigint;
      audit_count bigint;
    begin
      select (snapshot ->> 'existing_count')::bigint
        into before_count
        from mutation_snapshots
       where snapshot_key = 'notification-create-before';

      select notification.*
        into persisted
        from public.notifications as notification
       where notification.metadata ->> 'client_id' =
         '00000000-0000-0000-0000-000000000417';

      select pg_catalog.count(*)
        into stored_count
        from public.notifications as notification
       where notification.metadata ->> 'client_id' =
         '00000000-0000-0000-0000-000000000417';

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
       where event.action = 'supervisor_send_notification'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.target_table = 'notifications'
         and event.target_id = persisted.id
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000417'
         and event.metadata -> 'before' = 'null'::jsonb
         and event.metadata -> 'after' = pg_catalog.to_jsonb(persisted);

      if before_count is distinct from 0
         or stored_count is distinct from 1
         or persisted.id is null
         or persisted.user_id is distinct from
           '00000000-0000-0000-0000-000000000204'::uuid
         or persisted.workspace_id is distinct from (
           select workspace.id
           from public.workspaces as workspace
           where workspace.created_by =
             '00000000-0000-0000-0000-000000000204'::uuid
         )
         or persisted.kind <> 'billing'
         or persisted.title <> 'Contract renewal notice'
         or persisted.body <>
           'Your workspace subscription was renewed by a supervisor.'
         or persisted.metadata ->> 'contract_marker' <>
           'notification-actor'
         or persisted.metadata ->> 'actor_user_id' <>
           '00000000-0000-0000-0000-000000000202'
         or persisted.metadata ->> 'client_id' <>
           '00000000-0000-0000-0000-000000000417'
         or audit_count is distinct from 1
      then
        raise exception 'notification row or exact audit values are invalid';
      end if;
    end
    $body$
  $test$,
  'notification stores exact content and null-to-row audit snapshots'
);

create or replace function pg_temp.capture_onboarding_intent_count(
  p_snapshot_key text,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  execute $sql$
    insert into pg_temp.mutation_snapshots (snapshot_key, snapshot)
    select
      $1,
      pg_catalog.jsonb_build_object(
        'existing_count',
        pg_catalog.count(*)
      )
    from private.customer_onboarding_intents as intent
    where intent.email = $2
  $sql$
  using p_snapshot_key, p_email;
end;
$function$;

create or replace function pg_temp.capture_onboarding_intent_snapshot(
  p_snapshot_key text,
  p_intent_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  captured_count bigint;
begin
  execute $sql$
    insert into pg_temp.mutation_snapshots (snapshot_key, snapshot)
    select $1, pg_catalog.to_jsonb(intent)
    from private.customer_onboarding_intents as intent
    where intent.id = $2
  $sql$
  using p_snapshot_key, p_intent_id;

  get diagnostics captured_count = row_count;

  if captured_count is distinct from 1 then
    raise exception 'onboarding intent snapshot was not unique';
  end if;
end;
$function$;

create or replace function pg_temp.expire_onboarding_intent(
  p_intent_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  affected_count bigint;
begin
  execute $sql$
    update private.customer_onboarding_intents
       set created_at = pg_catalog.clock_timestamp() - interval '2 minutes',
           expires_at = pg_catalog.clock_timestamp() - interval '1 minute'
     where id = $1
  $sql$
  using p_intent_id;

  get diagnostics affected_count = row_count;

  if affected_count is distinct from 1 then
    raise exception 'onboarding intent id did not locate an intent';
  end if;
end;
$function$;

create or replace function pg_temp.assert_onboarding_capability_not_leaked(
  p_capability uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  capability_leaked boolean;
  capability_hash_hex text;
begin
  capability_hash_hex := pg_catalog.encode(
    extensions.digest(p_capability::text, 'sha256'),
    'hex'
  );

  execute $sql$
    select
      exists (
        select 1
        from audit.events as event
        where event.metadata::text like '%' || $1::text || '%'
           or event.metadata::text like '%' || $3 || '%'
      )
      or exists (
        select 1
        from private.supervisor_operation_idempotency as stored
        where stored.payload::text like '%' || $1::text || '%'
           or stored.result::text like '%' || $1::text || '%'
           or stored.payload::text like '%' || $3 || '%'
           or stored.result::text like '%' || $3 || '%'
      )
      or exists (
        select 1
        from public.notifications as notification
        where notification.metadata::text like '%' || $1::text || '%'
           or notification.metadata::text like '%' || $3 || '%'
      )
      or exists (
        select 1
        from public.subscription_events as event
        where event.metadata::text like '%' || $1::text || '%'
           or event.metadata::text like '%' || $3 || '%'
      )
      or exists (
        select 1
        from auth.users as auth_user
        where auth_user.id = $2
          and (
            auth_user.raw_app_meta_data
              ? 'mizan_onboarding_capability'
            or auth_user.raw_app_meta_data
              ? 'mizan_onboarding_capability_hash'
            or auth_user.raw_user_meta_data
              ? 'mizan_onboarding_capability'
            or auth_user.raw_user_meta_data
              ? 'mizan_onboarding_capability_hash'
          )
      )
  $sql$
  into capability_leaked
  using p_capability, p_user_id, capability_hash_hex;

  if capability_leaked then
    raise exception 'onboarding capability or digest leaked outside private intent state';
  end if;
end;
$function$;

grant execute on function pg_temp.capture_onboarding_intent_count(text, text)
  to authenticated;
grant execute on function pg_temp.capture_onboarding_intent_snapshot(text, uuid)
  to authenticated;
grant execute on function pg_temp.expire_onboarding_intent(uuid)
  to authenticated;
grant execute on function pg_temp.assert_onboarding_capability_not_leaked(
  uuid,
  uuid
) to authenticated;

create or replace function pg_temp.insert_onboarding_auth_fixture(
  p_user_id uuid,
  p_capability_location text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  intent_id uuid;
  capability uuid;
  previous_sub text :=
    pg_catalog.current_setting('request.jwt.claim.sub', true);
  previous_claims text :=
    pg_catalog.current_setting('request.jwt.claims', true);
  app_metadata jsonb :=
    '{"provider":"email","providers":["email"]}'::jsonb;
  user_metadata jsonb :=
    '{"display_name":"Untrusted Auth Metadata Name"}'::jsonb;
begin
  execute $sql$
    select public.supervisor_prepare_customer_onboarding(
      'consume.intent@example.test',
      'Consumed Intent Customer',
      'Onboarded Contract Workspace',
      'USD',
      '00000000-0000-0000-0000-000000000301'::uuid,
      'trialing'::public.subscription_status,
      pg_catalog.transaction_timestamp(),
      pg_catalog.transaction_timestamp() + interval '14 days',
      pg_catalog.transaction_timestamp() + interval '1 month',
      true,
      'temporary_password',
      'Consume exactly once inside auth bootstrap',
      '00000000-0000-0000-0000-000000000423'::uuid
    )
  $sql$
  into intent_id;

  execute $sql$
    select public.supervisor_issue_customer_onboarding_capability(
      $1,
      'Issue once for the auth bootstrap fixture'
    )
  $sql$
  into capability
  using intent_id;

  if p_capability_location = 'app' then
    app_metadata := app_metadata
      || pg_catalog.jsonb_build_object(
        'mizan_onboarding_capability',
        capability::text,
        'mizan_onboarding_capability_hash',
        'caller-supplied-hash-must-be-discarded'
      );
  elsif p_capability_location = 'user' then
    user_metadata := user_metadata
      || pg_catalog.jsonb_build_object(
        'mizan_onboarding_capability',
        capability::text,
        'mizan_onboarding_capability_hash',
        pg_catalog.encode(
          extensions.digest(capability::text, 'sha256'),
          'hex'
        )
      );
  else
    raise exception 'invalid capability fixture location';
  end if;

  if p_capability_location = 'app' then
    perform pg_temp.capture_onboarding_intent_snapshot(
      'consume-onboarding-intent',
      intent_id
    );
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

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
    p_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'consume.intent@example.test',
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    app_metadata,
    user_metadata,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  );

  perform pg_temp.assert_onboarding_capability_not_leaked(
    capability,
    p_user_id
  );

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    coalesce(previous_sub, ''),
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    coalesce(previous_claims, '{}'),
    true
  );
exception
  when others then
    perform pg_catalog.set_config(
      'request.jwt.claim.sub',
      coalesce(previous_sub, ''),
      true
    );
    perform pg_catalog.set_config(
      'request.jwt.claims',
      coalesce(previous_claims, '{}'),
      true
    );
    raise;
end;
$function$;

-- pgTAP's internal counters are transactional. A temporary sequence carries
-- only the pass marker across ROLLBACK TO while all signup rows are discarded.
create temporary sequence ordinary_signup_isolation_marker
  minvalue 0
  start with 0;

create or replace function pg_temp.capture_ordinary_signup_isolation()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  isolated_count bigint;
begin
  begin
    perform pg_temp.insert_onboarding_auth_fixture(
      '00000000-0000-0000-0000-000000000209'::uuid,
      'user'
    );

    select pg_catalog.count(*)
      into isolated_count
      from private.customer_onboarding_intents as intent
      join public.profiles as profile
        on profile.id =
          '00000000-0000-0000-0000-000000000209'::uuid
      join public.workspaces as workspace
        on workspace.created_by = profile.id
      join public.workspace_subscriptions as subscription
        on subscription.workspace_id = workspace.id
      join public.subscription_plans as plan
        on plan.id = subscription.plan_id
      join auth.users as auth_user
        on auth_user.id = profile.id
     where intent.email = 'consume.intent@example.test'
       and intent.consumed_at is null
       and intent.consumed_user_id is null
       and profile.display_name = 'Untrusted Auth Metadata Name'
       and not profile.must_change_password
       and workspace.name = 'Untrusted Auth Metadata Name'
       and workspace.default_currency_code = 'LYD'
       and subscription.status = 'trialing'
       and subscription.trial_ends_at =
         subscription.starts_at + interval '14 days'
       and subscription.current_period_ends_at =
         subscription.trial_ends_at
       and plan.code = 'trial'
       and not (
         auth_user.raw_app_meta_data
           ? 'mizan_onboarding_capability'
       )
       and not (
         auth_user.raw_app_meta_data
           ? 'mizan_onboarding_capability_hash'
       )
       and not (
         auth_user.raw_user_meta_data
           ? 'mizan_onboarding_capability'
       )
       and not (
         auth_user.raw_user_meta_data
           ? 'mizan_onboarding_capability_hash'
       );

    if isolated_count is distinct from 1 then
      return;
    end if;

    perform pg_catalog.nextval(
      'pg_temp.ordinary_signup_isolation_marker'::regclass
    );
  exception
    when others then
      return;
  end;
end;
$function$;

create or replace function pg_temp.assert_revoked_creator_rejected()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  intent_id uuid;
  capability uuid;
  caught_message text;
  rejected boolean := false;
  previous_sub text :=
    pg_catalog.current_setting('request.jwt.claim.sub', true);
  previous_claims text :=
    pg_catalog.current_setting('request.jwt.claims', true);
begin
  execute $sql$
    select public.supervisor_prepare_customer_onboarding(
      'revoked.creator.intent@example.test',
      'Revoked Creator Customer',
      'Revoked Creator Workspace',
      'USD',
      '00000000-0000-0000-0000-000000000301'::uuid,
      'active'::public.subscription_status,
      pg_catalog.transaction_timestamp(),
      null,
      pg_catalog.transaction_timestamp() + interval '1 month',
      true,
      'password_setup_email',
      'Reject bootstrap after the creating supervisor is revoked',
      '00000000-0000-0000-0000-000000000425'::uuid
    )
  $sql$
  into intent_id;

  execute $sql$
    select public.supervisor_issue_customer_onboarding_capability(
      $1,
      'Issue before revoking the creating supervisor'
    )
  $sql$
  into capability
  using intent_id;

  update public.profiles
     set account_status = 'disabled'
   where id = '00000000-0000-0000-0000-000000000202'::uuid;

  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

  begin
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
      '00000000-0000-0000-0000-000000000210'::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      'revoked.creator.intent@example.test',
      extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
      pg_catalog.clock_timestamp(),
      pg_catalog.jsonb_build_object(
        'provider',
        'email',
        'providers',
        pg_catalog.jsonb_build_array('email'),
        'mizan_onboarding_capability',
        capability::text
      ),
      '{}'::jsonb,
      pg_catalog.clock_timestamp(),
      pg_catalog.clock_timestamp()
    );
  exception
    when sqlstate 'PT409' then
      get stacked diagnostics caught_message = message_text;
      rejected := true;
  end;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    coalesce(previous_sub, ''),
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    coalesce(previous_claims, '{}'),
    true
  );

  update public.profiles
     set account_status = 'active'
   where id = '00000000-0000-0000-0000-000000000202'::uuid;

  if not rejected
     or caught_message <> 'onboarding_creator_inactive'
     or exists (
       select 1
       from auth.users
       where id = '00000000-0000-0000-0000-000000000210'::uuid
     )
     or exists (
       select 1
       from private.customer_onboarding_intents as intent
       where intent.id = intent_id
         and (
           intent.consumed_at is not null
           or intent.consumed_user_id is not null
         )
     )
  then
    raise exception 'revoked creator did not roll back onboarding: %, %',
      caught_message,
      rejected;
  end if;
exception
  when others then
    perform pg_catalog.set_config(
      'request.jwt.claim.sub',
      coalesce(previous_sub, ''),
      true
    );
    perform pg_catalog.set_config(
      'request.jwt.claims',
      coalesce(previous_claims, '{}'),
      true
    );
    update public.profiles
       set account_status = 'active'
     where id = '00000000-0000-0000-0000-000000000202'::uuid;
    raise;
end;
$function$;

create or replace function pg_temp.insert_auth_user_with_capability(
  p_user_id uuid,
  p_email text,
  p_app_capability text,
  p_user_capability text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  previous_sub text :=
    pg_catalog.current_setting('request.jwt.claim.sub', true);
  previous_claims text :=
    pg_catalog.current_setting('request.jwt.claims', true);
  app_metadata jsonb :=
    '{"provider":"email","providers":["email"]}'::jsonb;
  user_metadata jsonb :=
    '{"display_name":"Fail Closed Fixture"}'::jsonb;
begin
  if p_app_capability like 'hash:%' then
    app_metadata := app_metadata || pg_catalog.jsonb_build_object(
      'mizan_onboarding_capability_hash',
      pg_catalog.substr(p_app_capability, 6)
    );
  elsif p_app_capability is not null then
    app_metadata := app_metadata || pg_catalog.jsonb_build_object(
      'mizan_onboarding_capability',
      p_app_capability
    );
  end if;

  if p_user_capability is not null then
    user_metadata := user_metadata || pg_catalog.jsonb_build_object(
      'mizan_onboarding_capability',
      p_user_capability,
      'mizan_onboarding_capability_hash',
      pg_catalog.encode(
        extensions.digest(p_user_capability, 'sha256'),
        'hex'
      )
    );
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

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
    p_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
    pg_catalog.clock_timestamp(),
    app_metadata,
    user_metadata,
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp()
  );

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    coalesce(previous_sub, ''),
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claims',
    coalesce(previous_claims, '{}'),
    true
  );
exception
  when others then
    perform pg_catalog.set_config(
      'request.jwt.claim.sub',
      coalesce(previous_sub, ''),
      true
    );
    perform pg_catalog.set_config(
      'request.jwt.claims',
      coalesce(previous_claims, '{}'),
      true
    );
    raise;
end;
$function$;

create or replace function pg_temp.assert_fail_closed_capability(
  p_scenario text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  intent_id uuid;
  capability uuid;
  capability_text text;
  target_email text;
  attempted_email text;
  client_id uuid;
  attempted_user_id uuid;
  expected_state text;
  expected_message text;
  caught_state text;
  caught_message text;
  rejected boolean := false;
begin
  case p_scenario
    when 'malformed' then
      target_email := 'malformed.capability@example.test';
      attempted_email := target_email;
      attempted_user_id :=
        '00000000-0000-0000-0000-000000000211'::uuid;
      capability_text := 'not-a-uuid';
      expected_state := '22023';
      expected_message := 'invalid_onboarding_capability';
    when 'unknown' then
      target_email := 'unknown.capability@example.test';
      attempted_email := target_email;
      attempted_user_id :=
        '00000000-0000-0000-0000-000000000212'::uuid;
      capability :=
        '00000000-0000-4000-a000-000000000461'::uuid;
      capability_text := capability::text;
      expected_state := 'PT409';
      expected_message := 'onboarding_capability_unknown';
    when 'malformed_hash' then
      target_email := 'malformed.hash@example.test';
      attempted_email := target_email;
      attempted_user_id :=
        '00000000-0000-0000-0000-000000000219'::uuid;
      capability_text := 'hash:not-a-sha256-hex-digest';
      expected_state := '22023';
      expected_message := 'onboarding_capability_hash_not_accepted';
    when 'pass_the_hash' then
      target_email := 'pass.the.hash@example.test';
      attempted_email := target_email;
      attempted_user_id :=
        '00000000-0000-0000-0000-000000000220'::uuid;
      client_id := '00000000-0000-0000-0000-000000000466'::uuid;
      expected_state := '22023';
      expected_message := 'onboarding_capability_hash_not_accepted';
    when 'expired' then
      target_email := 'expired.capability@example.test';
      attempted_email := target_email;
      attempted_user_id :=
        '00000000-0000-0000-0000-000000000213'::uuid;
      client_id := '00000000-0000-0000-0000-000000000462'::uuid;
      expected_state := 'PT409';
      expected_message := 'onboarding_intent_expired';
    when 'cancelled' then
      target_email := 'cancelled.capability@example.test';
      attempted_email := target_email;
      attempted_user_id :=
        '00000000-0000-0000-0000-000000000214'::uuid;
      client_id := '00000000-0000-0000-0000-000000000463'::uuid;
      expected_state := 'PT409';
      expected_message := 'onboarding_intent_cancelled';
    when 'wrong_email' then
      target_email := 'bound.capability@example.test';
      attempted_email := 'wrong.capability@example.test';
      attempted_user_id :=
        '00000000-0000-0000-0000-000000000215'::uuid;
      client_id := '00000000-0000-0000-0000-000000000464'::uuid;
      expected_state := 'PT409';
      expected_message := 'onboarding_intent_email_mismatch';
    when 'consumed' then
      target_email := 'consumed.capability@example.test';
      attempted_email := 'reused.capability@example.test';
      attempted_user_id :=
        '00000000-0000-0000-0000-000000000218'::uuid;
      client_id := '00000000-0000-0000-0000-000000000465'::uuid;
      expected_state := 'PT409';
      expected_message := 'onboarding_intent_consumed';
    else
      raise exception 'unknown fail-closed scenario: %', p_scenario;
  end case;

  if client_id is not null then
    execute $sql$
      select public.supervisor_prepare_customer_onboarding(
        $1,
        'Fail Closed Customer',
        'Fail Closed Workspace',
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        null,
        pg_catalog.transaction_timestamp() + interval '1 month',
        true,
        'invite',
        'Exercise a trusted capability failure path',
        $2
      )
    $sql$
    into intent_id
    using target_email, client_id;

    execute $sql$
      select public.supervisor_issue_customer_onboarding_capability(
        $1,
        'Issue for fail-closed bootstrap coverage'
      )
    $sql$
    into capability
    using intent_id;

    if p_scenario = 'pass_the_hash' then
      select
        'hash:' || pg_catalog.encode(intent.capability_hash, 'hex')
        into capability_text
        from private.customer_onboarding_intents as intent
       where intent.id = intent_id;
    else
      capability_text := capability::text;
    end if;

    if p_scenario = 'expired' then
      perform pg_temp.expire_onboarding_intent(intent_id);
    elsif p_scenario = 'cancelled' then
      execute $sql$
        select public.supervisor_cancel_customer_onboarding(
          $1,
          'Cancel before the capability is presented'
        )
      $sql$
      using intent_id;
    elsif p_scenario = 'consumed' then
      perform pg_temp.insert_auth_user_with_capability(
        '00000000-0000-0000-0000-000000000217'::uuid,
        target_email,
        capability_text
      );
      perform pg_temp.assert_onboarding_capability_not_leaked(
        capability,
        '00000000-0000-0000-0000-000000000217'::uuid
      );
    end if;
  end if;

  begin
    perform pg_temp.insert_auth_user_with_capability(
      attempted_user_id,
      attempted_email,
      capability_text
    );
  exception
    when others then
      get stacked diagnostics
        caught_state = returned_sqlstate,
        caught_message = message_text;
      rejected := true;
  end;

  if not rejected
     or caught_state <> expected_state
     or caught_message <> expected_message
     or exists (
       select 1
       from auth.users
       where id = attempted_user_id
     )
     or exists (
       select 1
       from public.profiles
       where id = attempted_user_id
     )
     or (
       intent_id is not null
       and p_scenario <> 'consumed'
       and exists (
         select 1
         from private.customer_onboarding_intents as intent
         where intent.id = intent_id
           and (
             intent.consumed_at is not null
             or intent.consumed_user_id is not null
           )
       )
     )
  then
    raise exception 'fail-closed scenario % failed: %, %, %',
      p_scenario,
      rejected,
      caught_state,
      caught_message;
  end if;

  if capability is not null then
    perform pg_temp.assert_onboarding_capability_not_leaked(
      capability,
      attempted_user_id
    );
  end if;
end;
$function$;

grant execute on function pg_temp.insert_onboarding_auth_fixture(uuid, text)
  to authenticated;
grant execute on function pg_temp.insert_auth_user_with_capability(
  uuid,
  text,
  text,
  text
) to authenticated;
grant execute on function pg_temp.assert_fail_closed_capability(text)
  to authenticated;
grant execute on function pg_temp.capture_ordinary_signup_isolation()
  to authenticated;
grant execute on function pg_temp.assert_revoked_creator_rejected()
  to authenticated;

-- Onboarding intents normalize email, preserve lifecycle tombstones, reject a
-- live competitor, fail closed for trusted capability errors, and consume once.
set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $test$
    do $body$
    declare
      intent_id uuid;
      replayed_intent_id uuid;
    begin
      perform pg_temp.capture_onboarding_intent_count(
        'onboarding-prepare-before',
        'normalize.intent@example.test'
      );

      intent_id := public.supervisor_prepare_customer_onboarding(
        '  Normalize.Intent@Example.Test  ',
        'Normalized Intent Customer',
        'Normalized Intent Workspace',
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        null,
        pg_catalog.transaction_timestamp() + interval '1 month',
        true,
        'temporary_password',
        'Normalize and protect onboarding intent',
        '00000000-0000-0000-0000-000000000418'::uuid
      );

      replayed_intent_id := public.supervisor_prepare_customer_onboarding(
        'normalize.intent@example.test',
        'Normalized Intent Customer',
        'Normalized Intent Workspace',
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        null,
        pg_catalog.transaction_timestamp() + interval '1 month',
        true,
        'temporary_password',
        'Normalize and protect onboarding intent',
        '00000000-0000-0000-0000-000000000418'::uuid
      );

      if intent_id is null
         or replayed_intent_id is distinct from intent_id
      then
        raise exception 'onboarding internal id replay changed';
      end if;

      perform pg_temp.capture_onboarding_intent_snapshot(
        'onboarding-prepare-intent',
        intent_id
      );
    end
    $body$
  $test$,
  'prepare returns one exact replayable internal onboarding intent id'
);

select lives_ok(
  $test$
    do $body$
    declare
      replayed_intent_id uuid;
      intent_snapshot jsonb;
    begin
      replayed_intent_id := public.supervisor_prepare_customer_onboarding(
        'normalize.intent@example.test',
        'Normalized Intent Customer',
        'Normalized Intent Workspace',
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        null,
        pg_catalog.transaction_timestamp() + interval '1 month',
        true,
        'temporary_password',
        'Normalize and protect onboarding intent',
        '00000000-0000-0000-0000-000000000418'::uuid
      );

      select snapshot
        into intent_snapshot
        from pg_temp.mutation_snapshots
       where snapshot_key = 'onboarding-prepare-intent';

      if replayed_intent_id is null
         or intent_snapshot is null
         or (intent_snapshot ->> 'id')::uuid is distinct from
           replayed_intent_id
         or intent_snapshot -> 'capability_hash' is distinct from
           'null'::jsonb
      then
        raise exception 'onboarding replay did not return the stored internal id';
      end if;
    end
    $body$
  $test$,
  'an identical retry returns the exact private row id without issuing a capability'
);

select throws_ok(
  $call$
    select public.supervisor_prepare_customer_onboarding(
      'normalize.intent@example.test',
      'Changed Idempotent Customer',
      'Normalized Intent Workspace',
      'USD',
      '00000000-0000-0000-0000-000000000301'::uuid,
      'active'::public.subscription_status,
      pg_catalog.transaction_timestamp(),
      null,
      pg_catalog.transaction_timestamp() + interval '1 month',
      true,
      'temporary_password',
      'Normalize and protect onboarding intent',
      '00000000-0000-0000-0000-000000000418'::uuid
    )
  $call$,
  'PT409',
  'idempotency_conflict',
  'a changed onboarding retry is rejected'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      intent jsonb;
      before_count bigint;
      duplicate_count bigint;
      audit_count bigint;
    begin
      select (snapshot ->> 'existing_count')::bigint
        into before_count
        from mutation_snapshots
       where snapshot_key = 'onboarding-prepare-before';

      select snapshot
        into intent
        from mutation_snapshots
       where snapshot_key = 'onboarding-prepare-intent';

      select pg_catalog.count(*)
        into duplicate_count
        from private.customer_onboarding_intents as duplicate
       where duplicate.email = intent ->> 'email';

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
       where event.action = 'supervisor_prepare_customer_onboarding'
         and event.target_table = 'customer_onboarding_intents'
         and event.target_id = (intent ->> 'id')::uuid
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.metadata ->> 'client_id' =
           '00000000-0000-0000-0000-000000000418'
         and event.metadata -> 'before' = 'null'::jsonb
         and event.metadata -> 'after' = intent - 'capability_hash';

      if before_count is distinct from 0
         or intent ->> 'id' is null
         or intent -> 'capability_hash' is distinct from 'null'::jsonb
         or intent ->> 'email' <> 'normalize.intent@example.test'
         or intent ->> 'display_name' <> 'Normalized Intent Customer'
         or intent ->> 'workspace_name' <> 'Normalized Intent Workspace'
         or intent ->> 'currency_code' <> 'USD'
         or (intent ->> 'plan_id')::uuid is distinct from
           '00000000-0000-0000-0000-000000000301'::uuid
         or intent ->> 'subscription_status' <> 'active'
         or (intent ->> 'starts_at')::timestamptz is distinct from
           pg_catalog.transaction_timestamp()
         or intent ->> 'trial_ends_at' is not null
         or (intent ->> 'current_period_ends_at')::timestamptz is distinct from
           pg_catalog.transaction_timestamp() + interval '1 month'
         or not (intent ->> 'must_change_password')::boolean
         or intent ->> 'delivery_mode' <> 'temporary_password'
         or intent ->> 'note' <> 'Normalize and protect onboarding intent'
         or (intent ->> 'created_by')::uuid is distinct from
           '00000000-0000-0000-0000-000000000202'::uuid
         or (intent ->> 'expires_at')::timestamptz <=
           (intent ->> 'created_at')::timestamptz
         or (intent ->> 'expires_at')::timestamptz >
           (intent ->> 'created_at')::timestamptz + interval '15 minutes'
         or duplicate_count is distinct from 1
         or audit_count is distinct from 1
      then
        raise exception 'onboarding intent or exact audit values are invalid';
      end if;
    end
    $body$
  $test$,
  'onboarding prepare stores exact intent fields and null-to-row audit snapshots'
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
reset role;

select lives_ok(
  $test$
    do $body$
    declare
      intent_id uuid;
      first_capability uuid;
      second_capability uuid;
      stored_hash bytea;
      issue_audit_count bigint;
    begin
      select (snapshot ->> 'id')::uuid
        into intent_id
        from pg_temp.mutation_snapshots
       where snapshot_key = 'onboarding-prepare-intent';

      first_capability :=
        public.supervisor_issue_customer_onboarding_capability(
          intent_id,
          'Issue the first ephemeral capability'
        );
      second_capability :=
        public.supervisor_issue_customer_onboarding_capability(
          intent_id,
          'Rotate the first ephemeral capability'
        );

      select intent.capability_hash
        into stored_hash
        from private.customer_onboarding_intents as intent
       where intent.id = intent_id;

      select pg_catalog.count(*)
        into issue_audit_count
        from audit.events as event
       where event.action =
           'supervisor_issue_customer_onboarding_capability'
         and event.target_id = intent_id
         and not (event.metadata ? 'capability_hash')
         and event.metadata::text not like
           '%' || first_capability::text || '%'
         and event.metadata::text not like
           '%' || second_capability::text || '%'
         and event.metadata::text not like
           '%' || pg_catalog.encode(
             extensions.digest(first_capability::text, 'sha256'),
             'hex'
           ) || '%'
         and event.metadata::text not like
           '%' || pg_catalog.encode(
             extensions.digest(second_capability::text, 'sha256'),
             'hex'
           ) || '%';

      perform pg_temp.assert_onboarding_capability_not_leaked(
        first_capability,
        null
      );
      perform pg_temp.assert_onboarding_capability_not_leaked(
        second_capability,
        null
      );

      if first_capability is null
         or second_capability is null
         or first_capability = second_capability
         or first_capability = intent_id
         or second_capability = intent_id
         or stored_hash is distinct from
           extensions.digest(second_capability::text, 'sha256')
         or issue_audit_count is distinct from 2
      then
        raise exception 'capability issuance did not rotate safely';
      end if;
    end
    $body$
  $test$,
  'capability issuance returns plaintext once, rotates its hash, and audits no secret'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      audit_before bigint;
    begin
      select pg_catalog.count(*)
        into audit_before
        from audit.events;

      insert into private.supervisor_operation_idempotency (
        actor_user_id,
        client_id,
        operation,
        payload,
        result,
        created_at,
        updated_at
      )
      values (
        '00000000-0000-0000-0000-000000000202'::uuid,
        '00000000-0000-0000-0000-000000000499'::uuid,
        'cleanup_fixture',
        '{}'::jsonb,
        '{}'::jsonb,
        pg_catalog.statement_timestamp() - interval '91 days',
        pg_catalog.statement_timestamp() - interval '91 days'
      );

      insert into private.customer_onboarding_intents (
        capability_hash,
        email,
        display_name,
        workspace_name,
        currency_code,
        plan_id,
        subscription_status,
        starts_at,
        trial_ends_at,
        current_period_ends_at,
        must_change_password,
        delivery_mode,
        created_by,
        note,
        expires_at,
        created_at
      )
      values (
        extensions.digest(
          '00000000-0000-0000-0000-000000000498',
          'sha256'
        ),
        'cleanup.stale.intent@example.test',
        'Cleanup Stale Customer',
        'Cleanup Stale Workspace',
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.statement_timestamp() - interval '40 days',
        null,
        pg_catalog.statement_timestamp() + interval '1 day',
        false,
        'invite',
        '00000000-0000-0000-0000-000000000202'::uuid,
        'Bounded cleanup fixture',
        pg_catalog.statement_timestamp() - interval '32 days'
          + interval '15 minutes',
        pg_catalog.statement_timestamp() - interval '32 days'
      );

      insert into private.customer_onboarding_intents (
        capability_hash,
        email,
        display_name,
        workspace_name,
        currency_code,
        plan_id,
        subscription_status,
        starts_at,
        trial_ends_at,
        current_period_ends_at,
        must_change_password,
        delivery_mode,
        created_by,
        note,
        expires_at,
        consumed_at,
        consumed_user_id,
        created_at
      )
      values (
        extensions.digest(
          '00000000-0000-0000-0000-000000000497',
          'sha256'
        ),
        'cleanup.consumed.intent@example.test',
        'Cleanup Consumed Customer',
        'Cleanup Consumed Workspace',
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.statement_timestamp() - interval '100 days',
        null,
        pg_catalog.statement_timestamp() - interval '20 days',
        false,
        'invite',
        '00000000-0000-0000-0000-000000000202'::uuid,
        'Consumed retention fixture',
        pg_catalog.statement_timestamp() - interval '92 days'
          + interval '15 minutes',
        pg_catalog.statement_timestamp() - interval '91 days',
        '00000000-0000-0000-0000-000000000204'::uuid,
        pg_catalog.statement_timestamp() - interval '92 days'
      );

      perform private.cleanup_supervisor_control_plane();

      if exists (
           select 1
           from private.supervisor_operation_idempotency
           where operation = 'cleanup_fixture'
         )
         or exists (
           select 1
           from private.customer_onboarding_intents
           where email in (
             'cleanup.stale.intent@example.test',
             'cleanup.consumed.intent@example.test'
           )
         )
         or not exists (
           select 1
           from private.customer_onboarding_intents
           where email = 'normalize.intent@example.test'
             and consumed_at is null
             and expires_at > pg_catalog.statement_timestamp()
         )
         or (
           select pg_catalog.count(*)
           from audit.events
         ) is distinct from audit_before
      then
        raise exception 'bounded cleanup retention contract failed';
      end if;
    end
    $body$
  $test$,
  'bounded cleanup enforces 30/90-day retention without touching valid intents or audit'
);

create temporary table invalid_onboarding_calls (
  ordinal integer primary key,
  statement text not null,
  expected_message text not null,
  description text not null
);

insert into invalid_onboarding_calls (
  ordinal,
  statement,
  expected_message,
  description
)
select
  invalid_case.ordinal,
  pg_catalog.format(
    $call$
      select public.supervisor_prepare_customer_onboarding(
        %L,
        %L,
        %L,
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        %L::public.subscription_status,
        %L::timestamptz,
        %L::timestamptz,
        %L::timestamptz,
        true,
        'temporary_password',
        %L,
        %L::uuid
      )
    $call$,
    invalid_case.email,
    invalid_case.display_name,
    invalid_case.workspace_name,
    invalid_case.subscription_status,
    invalid_case.starts_at,
    invalid_case.trial_ends_at,
    invalid_case.current_period_ends_at,
    invalid_case.note,
    invalid_case.client_id
  ),
  invalid_case.expected_message,
  invalid_case.description
from (
  values
    (
      1,
      'future-start.intent@example.test',
      'Future Start Customer',
      'Future Start Workspace',
      'active',
      pg_catalog.statement_timestamp() + interval '1 day',
      null::timestamptz,
      pg_catalog.statement_timestamp() + interval '2 days',
      'Reject a future subscription start',
      '00000000-0000-0000-0000-000000000450'::uuid,
      'invalid_subscription_dates',
      'onboarding rejects a future initial subscription start'
    ),
    (
      2,
      'past-active.intent@example.test',
      'Past Active Customer',
      'Past Active Workspace',
      'active',
      pg_catalog.statement_timestamp() - interval '2 days',
      null::timestamptz,
      pg_catalog.statement_timestamp() - interval '1 day',
      'Reject an already ended active period',
      '00000000-0000-0000-0000-000000000451'::uuid,
      'invalid_subscription_dates',
      'onboarding rejects an active period that already ended'
    ),
    (
      3,
      'past-trial.intent@example.test',
      'Past Trial Customer',
      'Past Trial Workspace',
      'trialing',
      pg_catalog.statement_timestamp() - interval '2 days',
      pg_catalog.statement_timestamp() - interval '1 day',
      pg_catalog.statement_timestamp() + interval '1 day',
      'Reject an already ended trial',
      '00000000-0000-0000-0000-000000000452'::uuid,
      'invalid_subscription_dates',
      'onboarding rejects a trial that already ended'
    ),
    (
      4,
      'blank-note.intent@example.test',
      'Blank Note Customer',
      'Blank Note Workspace',
      'active',
      pg_catalog.statement_timestamp(),
      null::timestamptz,
      pg_catalog.statement_timestamp() + interval '1 month',
      '   ',
      '00000000-0000-0000-0000-000000000453'::uuid,
      'invalid_note',
      'onboarding prepare requires a nonblank administrative note'
    ),
    (
      5,
      'short-note.intent@example.test',
      'Short Note Customer',
      'Short Note Workspace',
      'active',
      pg_catalog.statement_timestamp(),
      null::timestamptz,
      pg_catalog.statement_timestamp() + interval '1 month',
      'ab',
      '00000000-0000-0000-0000-000000000454'::uuid,
      'invalid_note',
      'onboarding prepare rejects a note shorter than three characters'
    ),
    (
      6,
      'long-note.intent@example.test',
      'Long Note Customer',
      'Long Note Workspace',
      'active',
      pg_catalog.statement_timestamp(),
      null::timestamptz,
      pg_catalog.statement_timestamp() + interval '1 month',
      pg_catalog.repeat('n', 501),
      '00000000-0000-0000-0000-000000000455'::uuid,
      'invalid_note',
      'onboarding prepare rejects a note longer than 500 characters'
    ),
    (
      7,
      'control-note.intent@example.test',
      'Control Note Customer',
      'Control Note Workspace',
      'active',
      pg_catalog.statement_timestamp(),
      null::timestamptz,
      pg_catalog.statement_timestamp() + interval '1 month',
      E'Invalid\nnote',
      '00000000-0000-0000-0000-000000000456'::uuid,
      'invalid_note',
      'onboarding prepare rejects control characters in notes'
    ),
    (
      8,
      'control-display.intent@example.test',
      E'Invalid\nDisplay',
      'Control Display Workspace',
      'active',
      pg_catalog.statement_timestamp(),
      null::timestamptz,
      pg_catalog.statement_timestamp() + interval '1 month',
      'Reject the control-character display name',
      '00000000-0000-0000-0000-000000000457'::uuid,
      'invalid_display_name',
      'onboarding prepare rejects control characters in display names'
    ),
    (
      9,
      'control-workspace.intent@example.test',
      'Control Workspace Customer',
      E'Invalid\tWorkspace',
      'active',
      pg_catalog.statement_timestamp(),
      null::timestamptz,
      pg_catalog.statement_timestamp() + interval '1 month',
      'Reject the control-character workspace name',
      '00000000-0000-0000-0000-000000000458'::uuid,
      'invalid_workspace_name',
      'onboarding prepare rejects control characters in workspace names'
    )
) as invalid_case(
  ordinal,
  email,
  display_name,
  workspace_name,
  subscription_status,
  starts_at,
  trial_ends_at,
  current_period_ends_at,
  note,
  client_id,
  expected_message,
  description
);

insert into invalid_onboarding_calls (
  ordinal,
  statement,
  expected_message,
  description
)
values
  (
    10,
    $call$
      select public.supervisor_cancel_customer_onboarding(
        '00000000-0000-0000-0000-000000000459'::uuid,
        '   '
      )
    $call$,
    'invalid_note',
    'onboarding cancel requires a nonblank administrative note'
  ),
  (
    11,
    $call$
      select public.supervisor_cancel_customer_onboarding(
        '00000000-0000-0000-0000-000000000460'::uuid,
        E'Invalid\ncancel note'
      )
    $call$,
    'invalid_note',
    'onboarding cancel rejects control characters in notes'
  ),
  (
    12,
    $call$
      select public.supervisor_issue_customer_onboarding_capability(
        '00000000-0000-0000-0000-000000000460'::uuid,
        '  '
      )
    $call$,
    'invalid_note',
    'onboarding capability issuance requires an administrative note'
  );

grant select on invalid_onboarding_calls to authenticated;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select throws_ok(
  invalid_call.statement,
  '22023',
  invalid_call.expected_message,
  invalid_call.description
)
from invalid_onboarding_calls as invalid_call
order by invalid_call.ordinal;

select throws_ok(
  $call$
    select public.supervisor_prepare_customer_onboarding(
      'normalize.intent@example.test',
      'Competing Intent Customer',
      'Competing Intent Workspace',
      'USD',
      '00000000-0000-0000-0000-000000000301'::uuid,
      'active'::public.subscription_status,
      pg_catalog.transaction_timestamp(),
      null,
      pg_catalog.transaction_timestamp() + interval '1 month',
      true,
      'invite',
      'A live intent must win the race',
      '00000000-0000-0000-0000-000000000419'::uuid
    )
  $call$,
  'PT409',
  'onboarding_intent_conflict',
  'a live onboarding intent rejects a competing duplicate'
);

select lives_ok(
  $test$
    do $body$
    declare
      intent_id uuid;
      replayed_intent_id uuid;
      replacement_intent_id uuid;
      capability uuid;
    begin
      intent_id := public.supervisor_prepare_customer_onboarding(
        'cancel.intent@example.test',
        'Cancelled Intent Customer',
        'Cancelled Intent Workspace',
        'LYD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        null,
        pg_catalog.transaction_timestamp() + interval '1 month',
        false,
        'invite',
        'Prepare for cancellation',
        '00000000-0000-0000-0000-000000000424'::uuid
      );

      capability :=
        public.supervisor_issue_customer_onboarding_capability(
          intent_id,
          'Issue before cancelling the intent'
        );

      if intent_id is null or capability is null then
        raise exception 'cancel fixture returned null state';
      end if;

      perform pg_temp.capture_onboarding_intent_snapshot(
        'onboarding-cancel-before',
        intent_id
      );

      perform public.supervisor_cancel_customer_onboarding(
        intent_id,
        'Cancel through the audited supervisor path'
      );

      replacement_intent_id :=
        public.supervisor_prepare_customer_onboarding(
          'cancel.intent@example.test',
          'Replacement After Cancellation',
          'Replacement After Cancellation Workspace',
          'LYD',
          '00000000-0000-0000-0000-000000000301'::uuid,
          'active'::public.subscription_status,
          pg_catalog.transaction_timestamp(),
          null,
          pg_catalog.transaction_timestamp() + interval '1 month',
          false,
          'invite',
          'Create a new intent after cancellation',
          '00000000-0000-0000-0000-000000000426'::uuid
        );

      replayed_intent_id :=
        public.supervisor_prepare_customer_onboarding(
          'cancel.intent@example.test',
          'Cancelled Intent Customer',
          'Cancelled Intent Workspace',
          'LYD',
          '00000000-0000-0000-0000-000000000301'::uuid,
          'active'::public.subscription_status,
          pg_catalog.transaction_timestamp(),
          null,
          pg_catalog.transaction_timestamp() + interval '1 month',
          false,
          'invite',
          'Prepare for cancellation',
          '00000000-0000-0000-0000-000000000424'::uuid
        );

      perform pg_temp.assert_onboarding_capability_not_leaked(
        capability,
        null
      );

      if replayed_intent_id is distinct from intent_id
         or replacement_intent_id is null
         or replacement_intent_id = intent_id
      then
        raise exception 'cancelled intent replay or replacement changed identity';
      end if;
    end
    $body$
  $test$,
  'cancellation tombstones the internal id, permits replacement, and preserves exact replay'
);

select throws_ok(
  $call$
    select public.supervisor_issue_customer_onboarding_capability(
      (
        select (snapshot ->> 'id')::uuid
        from pg_temp.mutation_snapshots
        where snapshot_key = 'onboarding-cancel-before'
      ),
      'Cancelled intents cannot receive another capability'
    )
  $call$,
  'PT409',
  'onboarding_intent_cancelled',
  'capability issuance rejects a cancelled intent tombstone'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      before_intent jsonb;
      remaining_count bigint;
      audit_count bigint;
      cancelled_intent private.customer_onboarding_intents%rowtype;
    begin
      select snapshot
        into before_intent
        from mutation_snapshots
       where snapshot_key = 'onboarding-cancel-before';

      select pg_catalog.count(*)
        into remaining_count
        from private.customer_onboarding_intents as intent
       where intent.email = 'cancel.intent@example.test';

      select intent.*
        into cancelled_intent
        from private.customer_onboarding_intents as intent
       where intent.id = (before_intent ->> 'id')::uuid;

      select pg_catalog.count(*)
        into audit_count
        from audit.events as event
       where event.action = 'supervisor_cancel_customer_onboarding'
         and event.actor_user_id =
           '00000000-0000-0000-0000-000000000202'::uuid
         and event.target_table = 'customer_onboarding_intents'
         and event.target_id = (before_intent ->> 'id')::uuid
         and event.metadata -> 'before' =
           before_intent - 'capability_hash'
         and event.metadata -> 'after' =
           pg_catalog.to_jsonb(cancelled_intent) - 'capability_hash';

      if before_intent ->> 'email' <>
           'cancel.intent@example.test'
         or before_intent ->> 'display_name' <>
           'Cancelled Intent Customer'
         or before_intent ->> 'workspace_name' <>
           'Cancelled Intent Workspace'
         or before_intent ->> 'plan_id' <>
           '00000000-0000-0000-0000-000000000301'
         or before_intent ->> 'subscription_status' <> 'active'
         or cancelled_intent.cancelled_at is null
         or cancelled_intent.cancelled_by is distinct from
           '00000000-0000-0000-0000-000000000202'::uuid
         or cancelled_intent.cancel_reason <>
           'Cancel through the audited supervisor path'
         or cancelled_intent.consumed_at is not null
         or cancelled_intent.capability_hash is null
         or remaining_count is distinct from 2
         or audit_count is distinct from 1
      then
        raise exception 'cancelled intent or exact audit values are invalid';
      end if;
    end
    $body$
  $test$,
  'onboarding cancellation retains a constrained row-to-row tombstone audit'
);

select lives_ok(
  $test$
    do $body$
    declare
      original_intent_id uuid;
      replayed_intent_id uuid;
      audit_before bigint;
      retention_now timestamptz := pg_catalog.clock_timestamp();
    begin
      select (snapshot ->> 'id')::uuid
        into original_intent_id
        from mutation_snapshots
       where snapshot_key = 'onboarding-cancel-before';

      update private.customer_onboarding_intents as intent
         set created_at = retention_now - interval '40 days',
             expires_at =
               retention_now - interval '40 days'
                 + interval '15 minutes',
             cancelled_at = retention_now - interval '31 days'
       where intent.id = original_intent_id;

      update private.supervisor_operation_idempotency as stored
         set created_at = retention_now - interval '89 days',
             updated_at = retention_now - interval '89 days'
       where stored.actor_user_id =
               '00000000-0000-0000-0000-000000000202'::uuid
         and stored.client_id =
               '00000000-0000-0000-0000-000000000424'::uuid
         and stored.operation =
               'supervisor_prepare_customer_onboarding';

      select pg_catalog.count(*)
        into audit_before
        from audit.events;

      perform private.cleanup_supervisor_control_plane();

      replayed_intent_id :=
        public.supervisor_prepare_customer_onboarding(
          'cancel.intent@example.test',
          'Cancelled Intent Customer',
          'Cancelled Intent Workspace',
          'LYD',
          '00000000-0000-0000-0000-000000000301'::uuid,
          'active'::public.subscription_status,
          pg_catalog.transaction_timestamp(),
          null,
          pg_catalog.transaction_timestamp() + interval '1 month',
          false,
          'invite',
          'Prepare for cancellation',
          '00000000-0000-0000-0000-000000000424'::uuid
        );

      if replayed_intent_id is distinct from original_intent_id
         or not exists (
           select 1
           from private.customer_onboarding_intents as intent
           where intent.id = original_intent_id
             and intent.cancelled_at is not null
         )
         or (
           select pg_catalog.count(*)
           from audit.events
         ) is distinct from audit_before
      then
        raise exception 'retention cleanup broke a valid prepare replay';
      end if;
    end
    $body$
  $test$,
  'an 89-day prepare replay protects its tombstone from 30-day cleanup'
);

select lives_ok(
  $test$
    do $body$
    declare
      original_intent_id uuid;
      replacement_intent_id uuid;
      retention_now timestamptz := pg_catalog.clock_timestamp();
      retained_audit_count bigint;
    begin
      original_intent_id :=
        public.supervisor_prepare_customer_onboarding(
          'retention.boundary@example.test',
          'Retention Boundary Customer',
          'Retention Boundary Workspace',
          'LYD',
          '00000000-0000-0000-0000-000000000301'::uuid,
          'active'::public.subscription_status,
          pg_catalog.transaction_timestamp(),
          null,
          pg_catalog.transaction_timestamp() + interval '1 month',
          false,
          'invite',
          'Exercise the documented replay retention boundary',
          '00000000-0000-0000-0000-000000000467'::uuid
        );

      perform public.supervisor_cancel_customer_onboarding(
        original_intent_id,
        'Cancel before aging beyond replay retention'
      );

      update private.customer_onboarding_intents as intent
         set created_at = retention_now - interval '100 days',
             expires_at =
               retention_now - interval '100 days' + interval '15 minutes',
             cancelled_at = retention_now - interval '91 days'
       where intent.id = original_intent_id;

      update private.supervisor_operation_idempotency as stored
         set created_at = retention_now - interval '91 days',
             updated_at = retention_now - interval '91 days'
       where stored.actor_user_id =
               '00000000-0000-0000-0000-000000000202'::uuid
         and stored.client_id =
               '00000000-0000-0000-0000-000000000467'::uuid
         and stored.operation =
               'supervisor_prepare_customer_onboarding';

      replacement_intent_id :=
        public.supervisor_prepare_customer_onboarding(
          'retention.boundary@example.test',
          'Retention Boundary Customer',
          'Retention Boundary Workspace',
          'LYD',
          '00000000-0000-0000-0000-000000000301'::uuid,
          'active'::public.subscription_status,
          pg_catalog.transaction_timestamp(),
          null,
          pg_catalog.transaction_timestamp() + interval '1 month',
          false,
          'invite',
          'Exercise the documented replay retention boundary',
          '00000000-0000-0000-0000-000000000467'::uuid
        );

      select pg_catalog.count(*)
        into retained_audit_count
        from audit.events as event
       where event.target_table = 'customer_onboarding_intents'
         and event.target_id = original_intent_id;

      if replacement_intent_id is null
         or replacement_intent_id = original_intent_id
         or exists (
           select 1
           from private.customer_onboarding_intents as intent
           where intent.id = original_intent_id
         )
         or not exists (
           select 1
           from private.customer_onboarding_intents as intent
           where intent.id = replacement_intent_id
             and intent.cancelled_at is null
             and intent.consumed_at is null
         )
         or not exists (
           select 1
           from private.supervisor_operation_idempotency as stored
           where stored.actor_user_id =
                   '00000000-0000-0000-0000-000000000202'::uuid
             and stored.client_id =
                   '00000000-0000-0000-0000-000000000467'::uuid
             and stored.operation =
                   'supervisor_prepare_customer_onboarding'
             and stored.result ->> 'intent_id' =
                   replacement_intent_id::text
         )
         or retained_audit_count is distinct from 2
      then
        raise exception 'post-retention prepare did not create a clean replacement';
      end if;
    end
    $body$
  $test$,
  'after 90-day replay retention cleanup may create a new intent while audit remains'
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_prepare_customer_onboarding(
      'expired.intent@example.test',
      'Expired Intended Customer',
      'Expired Intended Workspace',
      'USD',
      '00000000-0000-0000-0000-000000000301'::uuid,
      'active'::public.subscription_status,
      pg_catalog.transaction_timestamp(),
      null,
      pg_catalog.transaction_timestamp() + interval '1 month',
      true,
      'temporary_password',
      'This intent will expire before auth bootstrap',
      '00000000-0000-0000-0000-000000000420'::uuid
    )
  $call$,
  'a separate onboarding intent can be prepared for expiry coverage'
);

reset role;
set local role authenticated;

select lives_ok(
  $test$
    do $body$
    declare
      original_intent_id uuid;
    begin
      original_intent_id := public.supervisor_prepare_customer_onboarding(
        'expired.intent@example.test',
        'Expired Intended Customer',
        'Expired Intended Workspace',
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        null,
        pg_catalog.transaction_timestamp() + interval '1 month',
        true,
        'temporary_password',
        'This intent will expire before auth bootstrap',
        '00000000-0000-0000-0000-000000000420'::uuid
      );

      perform pg_temp.capture_onboarding_intent_snapshot(
        'expired-auth-intent',
        original_intent_id
      );
      perform pg_temp.expire_onboarding_intent(original_intent_id);
    end
    $body$
  $test$,
  'the expiry fixture can make the onboarding intent stale'
);

select throws_ok(
  $call$
    select public.supervisor_issue_customer_onboarding_capability(
      (
        select (snapshot ->> 'id')::uuid
        from pg_temp.mutation_snapshots
        where snapshot_key = 'expired-auth-intent'
      ),
      'Expired intents cannot receive another capability'
    )
  $call$,
  'PT409',
  'onboarding_intent_expired',
  'capability issuance rejects an expired intent tombstone'
);

reset role;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';
select is(
  auth.uid(),
  null::uuid,
  'expired-intent auth bootstrap runs without a JWT subject'
);

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
  '00000000-0000-0000-0000-000000000206'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'expired.intent@example.test',
  extensions.crypt('not-a-real-password', extensions.gen_salt('bf')),
  pg_catalog.clock_timestamp(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Public Signup Fallback"}'::jsonb,
  pg_catalog.clock_timestamp(),
  pg_catalog.clock_timestamp()
);

select lives_ok(
  $test$
    do $body$
    declare
      valid_default boolean;
    begin
      select
        intent.consumed_at is null
        and intent.consumed_user_id is null
        and not profile.must_change_password
        and plan.code = 'trial'
        and subscription.status = 'trialing'
        and workspace.default_currency_code = 'LYD'
        into valid_default
        from private.customer_onboarding_intents as intent
        join public.profiles as profile
          on profile.id =
            '00000000-0000-0000-0000-000000000206'::uuid
        join public.workspaces as workspace
          on workspace.created_by = profile.id
        join public.workspace_subscriptions as subscription
          on subscription.workspace_id = workspace.id
        join public.subscription_plans as plan
          on plan.id = subscription.plan_id
       where intent.email = 'expired.intent@example.test';

      if not coalesce(valid_default, false) then
        raise exception 'expired intent was consumed or changed public signup defaults';
      end if;
    end
    $body$
  $test$,
  'an expired intent is not consumed and public signup keeps safe defaults'
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_prepare_customer_onboarding(
      'replace.intent@example.test',
      'First Replace Intent',
      'First Replace Workspace',
      'LYD',
      '00000000-0000-0000-0000-000000000301'::uuid,
      'active'::public.subscription_status,
      pg_catalog.transaction_timestamp(),
      null,
      pg_catalog.transaction_timestamp() + interval '1 month',
      false,
      'invite',
      'First replaceable intent',
      '00000000-0000-0000-0000-000000000421'::uuid
    )
  $call$,
  'an onboarding intent can be prepared for replacement coverage'
);

reset role;
set local role authenticated;

select lives_ok(
  $test$
    do $body$
    declare
      original_intent_id uuid;
    begin
      original_intent_id := public.supervisor_prepare_customer_onboarding(
        'replace.intent@example.test',
        'First Replace Intent',
        'First Replace Workspace',
        'LYD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'active'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        null,
        pg_catalog.transaction_timestamp() + interval '1 month',
        false,
        'invite',
        'First replaceable intent',
        '00000000-0000-0000-0000-000000000421'::uuid
      );

      perform pg_temp.capture_onboarding_intent_snapshot(
        'replace-original-intent',
        original_intent_id
      );
      perform pg_temp.expire_onboarding_intent(original_intent_id);
    end
    $body$
  $test$,
  'the replaceable onboarding intent can be made stale'
);

reset role;
set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_prepare_customer_onboarding(
      ' REPLACE.INTENT@EXAMPLE.TEST ',
      'Replacement Intent',
      'Replacement Workspace',
      'USD',
      '00000000-0000-0000-0000-000000000301'::uuid,
      'active'::public.subscription_status,
      pg_catalog.transaction_timestamp(),
      null,
      pg_catalog.transaction_timestamp() + interval '2 months',
      true,
      'password_setup_email',
      'Replace the expired intent atomically',
      '00000000-0000-0000-0000-000000000422'::uuid
    )
  $call$,
  'an expired unconsumed intent can be atomically replaced'
);

reset role;

select lives_ok(
  $test$
    do $body$
    declare
      matching_count bigint;
      original_intent_id uuid;
      replayed_intent_id uuid;
      original_intent record;
      replacement record;
    begin
      select (snapshot ->> 'id')::uuid
        into original_intent_id
        from mutation_snapshots
       where snapshot_key = 'replace-original-intent';

      select pg_catalog.count(*)
        into matching_count
        from private.customer_onboarding_intents
       where email = 'replace.intent@example.test';

      select *
        into replacement
        from private.customer_onboarding_intents
       where email = 'replace.intent@example.test'
         and id <> original_intent_id;

      select *
        into original_intent
        from private.customer_onboarding_intents
       where id = original_intent_id;

      replayed_intent_id :=
        public.supervisor_prepare_customer_onboarding(
          'replace.intent@example.test',
          'First Replace Intent',
          'First Replace Workspace',
          'LYD',
          '00000000-0000-0000-0000-000000000301'::uuid,
          'active'::public.subscription_status,
          pg_catalog.transaction_timestamp(),
          null,
          pg_catalog.transaction_timestamp() + interval '1 month',
          false,
          'invite',
          'First replaceable intent',
          '00000000-0000-0000-0000-000000000421'::uuid
        );

      if matching_count is distinct from 2
         or replayed_intent_id is distinct from original_intent_id
         or original_intent.expires_at > pg_catalog.clock_timestamp()
         or original_intent.display_name <> 'First Replace Intent'
         or replacement.id = original_intent_id
         or replacement.display_name <> 'Replacement Intent'
         or replacement.workspace_name <> 'Replacement Workspace'
         or replacement.currency_code <> 'USD'
         or replacement.expires_at <= pg_catalog.clock_timestamp()
      then
        raise exception 'expired intent replacement was not atomic';
      end if;
    end
    $body$
  $test$,
  'expired replacement preserves the tombstone and exact original prepare replay'
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select public.supervisor_prepare_customer_onboarding(
      ' Consume.Intent@Example.Test ',
      'Consumed Intent Customer',
      'Onboarded Contract Workspace',
      'USD',
      '00000000-0000-0000-0000-000000000301'::uuid,
      'trialing'::public.subscription_status,
      pg_catalog.transaction_timestamp(),
      pg_catalog.transaction_timestamp() + interval '14 days',
      pg_catalog.transaction_timestamp() + interval '1 month',
      true,
      'temporary_password',
      'Consume exactly once inside auth bootstrap',
      '00000000-0000-0000-0000-000000000423'::uuid
    )
  $call$,
  'a consumable onboarding intent can be prepared'
);

select lives_ok(
  $call$select pg_temp.assert_revoked_creator_rejected()$call$,
  'bootstrap rejects a capability whose creating supervisor was revoked'
);

reset role;

create temporary table trusted_capability_failures (
  ordinal integer primary key,
  scenario text not null,
  description text not null
);

insert into trusted_capability_failures (
  ordinal,
  scenario,
  description
)
values
  (
    1,
    'malformed',
    'malformed trusted app capability fails before Auth storage'
  ),
  (
    2,
    'unknown',
    'unknown trusted app capability fails closed'
  ),
  (
    3,
    'expired',
    'expired trusted app capability fails closed'
  ),
  (
    4,
    'cancelled',
    'cancelled trusted app capability fails closed'
  ),
  (
    5,
    'consumed',
    'consumed trusted app capability cannot be replayed'
  ),
  (
    6,
    'wrong_email',
    'a valid capability bound to another email fails closed'
  ),
  (
    7,
    'malformed_hash',
    'malformed trusted app capability hash fails before Auth storage'
  ),
  (
    8,
    'pass_the_hash',
    'the exact stored capability digest cannot authorize Auth bootstrap'
  );

grant select on trusted_capability_failures to authenticated;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  pg_catalog.format(
    'select pg_temp.assert_fail_closed_capability(%L)',
    failure.scenario
  ),
  failure.description
)
from trusted_capability_failures as failure
order by failure.ordinal;

reset role;

select throws_ok(
  $statement$
    update auth.users as auth_user
       set raw_app_meta_data =
         coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
           || pg_catalog.jsonb_build_object(
             'mizan_onboarding_capability',
             '00000000-0000-4000-a000-000000000468'
           )
     where auth_user.id =
       '00000000-0000-0000-0000-000000000206'::uuid
  $statement$,
  '22023',
  'onboarding_capability_metadata_not_accepted_on_update',
  'auth metadata sanitizer rejects update-time plaintext capabilities'
);

select lives_ok(
  $statement$
    update auth.users as auth_user
       set updated_at = auth_user.updated_at
     where auth_user.id =
       '00000000-0000-0000-0000-000000000206'::uuid
  $statement$,
  'ordinary auth updates without onboarding keys remain allowed'
);

savepoint ordinary_signup_isolation;

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

do $body$
begin
  perform pg_temp.capture_ordinary_signup_isolation();
end
$body$;

reset role;

rollback to savepoint ordinary_signup_isolation;
release savepoint ordinary_signup_isolation;

select is(
  (
    select marker.is_called
    from pg_temp.ordinary_signup_isolation_marker as marker
  ),
  true,
  'app-key-absent signup strips raw-user capability injection and keeps LYD trial defaults'
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select lives_ok(
  $call$
    select pg_temp.insert_onboarding_auth_fixture(
      '00000000-0000-0000-0000-000000000207'::uuid,
      'app'
    )
  $call$,
  'a service-role app-metadata capability can run auth bootstrap'
);

reset role;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';
select is(
  auth.uid(),
  null::uuid,
  'capability-bound auth bootstrap runs without a JWT subject'
);

select lives_ok(
  $test$
    do $body$
    declare
      bootstrap_count bigint;
    begin
      select pg_catalog.count(*)
        into bootstrap_count
        from private.customer_onboarding_intents as intent
        join public.profiles as profile
          on profile.id = intent.consumed_user_id
        join public.workspaces as workspace
          on workspace.created_by = profile.id
        join public.workspace_subscriptions as subscription
          on subscription.workspace_id = workspace.id
        join public.subscription_plans as plan
          on plan.id = subscription.plan_id
        join pg_temp.mutation_snapshots as intent_snapshot
          on intent_snapshot.snapshot_key = 'consume-onboarding-intent'
        join auth.users as auth_user
          on auth_user.id = profile.id
       where intent.capability_hash = pg_catalog.decode(
           pg_catalog.replace(
             intent_snapshot.snapshot ->> 'capability_hash',
             '\x',
             ''
           ),
           'hex'
         )
         and intent.email = 'consume.intent@example.test'
         and intent.consumed_at is not null
         and intent.consumed_user_id =
           '00000000-0000-0000-0000-000000000207'::uuid
         and profile.display_name = 'Consumed Intent Customer'
         and profile.must_change_password
         and workspace.name = 'Onboarded Contract Workspace'
         and workspace.default_currency_code = 'USD'
         and subscription.status = 'trialing'
         and subscription.starts_at is not distinct from
           pg_catalog.transaction_timestamp()
         and subscription.trial_ends_at is not distinct from
           pg_catalog.transaction_timestamp() + interval '14 days'
         and subscription.current_period_ends_at is not distinct from
           pg_catalog.transaction_timestamp() + interval '1 month'
         and plan.id =
           '00000000-0000-0000-0000-000000000301'::uuid
         and not (
           auth_user.raw_app_meta_data
             ? 'mizan_onboarding_capability'
         )
         and not (
           auth_user.raw_app_meta_data
             ? 'mizan_onboarding_capability_hash'
         )
         and not (
           auth_user.raw_user_meta_data
             ? 'mizan_onboarding_capability'
         )
         and not (
           auth_user.raw_user_meta_data
             ? 'mizan_onboarding_capability_hash'
         )
         and exists (
           select 1
           from public.workspace_members as membership
           where membership.workspace_id = workspace.id
             and membership.user_id = profile.id
             and membership.role = 'owner'
             and membership.status = 'active'
         )
         and (
           select pg_catalog.count(*)
           from public.categories as category
           where category.workspace_id = workspace.id
             and category.is_system
             and (
               (category.name = 'General income' and category.kind = 'income')
               or
               (category.name = 'General expense' and category.kind = 'expense')
             )
         ) = 2
         and (
           select pg_catalog.count(*)
           from public.ledger_accounts as account
           where account.workspace_id = workspace.id
             and account.currency_code = 'USD'
         ) = 4
         and (
           select pg_catalog.count(*)
           from public.ledger_accounts as account
           where account.workspace_id = workspace.id
             and account.system_key in (
               'income',
               'expense',
               'opening_equity'
             )
         ) = 3
         and exists (
           select 1
           from public.wallets as wallet
           join public.ledger_accounts as cash_account
             on cash_account.id = wallet.ledger_account_id
           where wallet.workspace_id = workspace.id
             and wallet.currency_code = 'USD'
             and wallet.name = 'Cash'
             and wallet.status = 'active'
             and cash_account.workspace_id = workspace.id
             and cash_account.name = 'Cash'
             and cash_account.account_type = 'asset'
         )
         and (
           select pg_catalog.count(*)
           from public.notifications as notification
           where notification.user_id = profile.id
             and notification.workspace_id = workspace.id
             and notification.kind = 'billing'
             and notification.metadata ->> 'actor_user_id' =
               '00000000-0000-0000-0000-000000000202'
             and notification.metadata ->> 'intent_id' = intent.id::text
         ) = 1
         and (
           select pg_catalog.count(*)
           from public.subscription_events as event
           where event.workspace_id = workspace.id
             and event.subscription_id = subscription.id
             and event.actor_user_id =
               '00000000-0000-0000-0000-000000000202'::uuid
             and event.event_type = 'trial_started'
             and event.from_status is null
             and event.to_status = 'trialing'
             and event.metadata ->> 'intent_id' = intent.id::text
         ) = 1
         and exists (
           select 1
           from audit.events as event
           where event.workspace_id = workspace.id
             and event.actor_user_id =
               '00000000-0000-0000-0000-000000000202'::uuid
             and event.action = 'workspace.bootstrapped'
             and event.metadata ->> 'intent_id' = intent.id::text
         );

      if bootstrap_count is distinct from 1 then
        raise exception 'onboarding intent was not consumed exactly once';
      end if;
    end
    $body$
  $test$,
  'valid capability bootstraps once and leaves neither metadata document with onboarding keys'
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000202';
set local role authenticated;

select throws_ok(
  $call$
    select public.supervisor_issue_customer_onboarding_capability(
      public.supervisor_prepare_customer_onboarding(
        'consume.intent@example.test',
        'Consumed Intent Customer',
        'Onboarded Contract Workspace',
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'trialing'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        pg_catalog.transaction_timestamp() + interval '14 days',
        pg_catalog.transaction_timestamp() + interval '1 month',
        true,
        'temporary_password',
        'Consume exactly once inside auth bootstrap',
        '00000000-0000-0000-0000-000000000423'::uuid
      ),
      'Consumed intents cannot receive another capability'
    )
  $call$,
  'PT409',
  'onboarding_intent_consumed',
  'capability issuance rejects a consumed intent tombstone'
);

select throws_ok(
  $call$
    select public.supervisor_cancel_customer_onboarding(
      public.supervisor_prepare_customer_onboarding(
        'consume.intent@example.test',
        'Consumed Intent Customer',
        'Onboarded Contract Workspace',
        'USD',
        '00000000-0000-0000-0000-000000000301'::uuid,
        'trialing'::public.subscription_status,
        pg_catalog.transaction_timestamp(),
        pg_catalog.transaction_timestamp() + interval '14 days',
        pg_catalog.transaction_timestamp() + interval '1 month',
        true,
        'temporary_password',
        'Consume exactly once inside auth bootstrap',
        '00000000-0000-0000-0000-000000000423'::uuid
      ),
      'Consumed intents are immutable'
    )
  $call$,
  'PT409',
  'onboarding_intent_consumed',
  'a consumed onboarding intent cannot be cancelled'
);

reset role;

select lives_ok(
  $statement$
    update public.profiles
       set must_change_password = true
     where id =
       '00000000-0000-0000-0000-000000000201'::uuid
  $statement$,
  'a second user can retain an independent password-change marker'
);

set local "request.jwt.claim.sub" =
  '00000000-0000-0000-0000-000000000207';
set local role authenticated;

select lives_ok(
  $call$select public.complete_required_password_change()$call$,
  'the affected user can complete the required password-change marker'
);

reset role;

select lives_ok(
  $test$
    do $body$
    begin
      if (
        select profile.must_change_password
        from public.profiles as profile
        where profile.id =
          '00000000-0000-0000-0000-000000000207'::uuid
      ) is distinct from false then
        raise exception 'required password-change marker was not cleared';
      end if;

      if (
        select profile.must_change_password
        from public.profiles as profile
        where profile.id =
          '00000000-0000-0000-0000-000000000201'::uuid
      ) is distinct from true then
        raise exception 'another user password-change marker was modified';
      end if;
    end
    $body$
  $test$,
  'completing the required password change clears only the persisted marker'
);

reset role;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';
select is(
  auth.uid(),
  null::uuid,
  'the contract suite restores role and JWT state before rollback'
);

select * from finish();
rollback;
