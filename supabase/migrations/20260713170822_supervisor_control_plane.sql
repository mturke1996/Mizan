-- Secure supervisor onboarding intents and auth bootstrap integration.

create extension if not exists pg_cron with schema pg_catalog;

alter table public.profiles
  add column must_change_password boolean not null default false;

alter table public.workspace_subscriptions
  add column scheduled_status public.subscription_status,
  add column scheduled_status_at timestamptz,
  add constraint workspace_subscriptions_scheduled_state_shape check (
    (scheduled_status is null and scheduled_status_at is null)
    or (
      scheduled_status is not null
      and scheduled_status_at is not null
      and scheduled_status in ('cancelled', 'expired')
    )
  );

alter table public.subscription_plans
  drop constraint subscription_plans_code_format,
  drop constraint subscription_plans_interval_shape,
  drop constraint subscription_plans_trial_days_range,
  add constraint subscription_plans_code_format
    check (code ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  add constraint subscription_plans_interval_shape
    check (
      (billing_interval = 'none' and interval_count is null)
      or (
        billing_interval in ('monthly', 'yearly')
        and interval_count is not null
        and interval_count between 1 and 36
      )
    ),
  add constraint subscription_plans_trial_days_range
    check (trial_days between 0 and 365);

create or replace function private.has_current_entitlement(
  p_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      private.is_workspace_member(p_workspace_id)
      or private.is_supervisor()
    )
    and exists (
      select 1
        from public.workspace_subscriptions as subscription
       where subscription.workspace_id = p_workspace_id
         and subscription.starts_at <= pg_catalog.statement_timestamp()
         and (
           (
             subscription.status = 'trialing'
             and subscription.trial_ends_at >
               pg_catalog.statement_timestamp()
           )
           or
           (
             subscription.status = 'active'
             and subscription.current_period_ends_at >
               pg_catalog.statement_timestamp()
           )
           or
           (
             subscription.status = 'grace'
             and subscription.grace_ends_at >
               pg_catalog.statement_timestamp()
           )
         )
    )
$$;

create table private.supervisor_operation_idempotency (
  actor_user_id uuid not null,
  client_id uuid not null,
  operation text not null,
  payload jsonb not null,
  result jsonb,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint supervisor_operation_idempotency_pkey
    primary key (actor_user_id, client_id, operation),
  constraint supervisor_operation_idempotency_actor_fk
    foreign key (actor_user_id)
    references public.profiles (id),
  constraint supervisor_operation_idempotency_operation_shape
    check (
      operation = pg_catalog.btrim(operation)
      and pg_catalog.char_length(operation) between 1 and 120
    ),
  constraint supervisor_operation_idempotency_payload_object
    check (pg_catalog.jsonb_typeof(payload) = 'object'),
  constraint supervisor_operation_idempotency_result_object
    check (
      result is null
      or pg_catalog.jsonb_typeof(result) = 'object'
    )
);

create index supervisor_operation_idempotency_updated_at_idx
  on private.supervisor_operation_idempotency (
    updated_at,
    actor_user_id,
    client_id,
    operation
  );

create index supervisor_operation_idempotency_intent_result_idx
  on private.supervisor_operation_idempotency ((result ->> 'intent_id'))
  where operation = 'supervisor_prepare_customer_onboarding'
    and result ? 'intent_id';

alter table private.supervisor_operation_idempotency
  enable row level security;

revoke all on table private.supervisor_operation_idempotency
  from public, anon, authenticated;

create table private.customer_onboarding_intents (
  id uuid not null default extensions.gen_random_uuid(),
  capability_hash bytea,
  email text not null,
  display_name text not null,
  workspace_name text not null,
  currency_code text not null,
  plan_id uuid not null,
  subscription_status public.subscription_status not null,
  starts_at timestamptz not null,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  must_change_password boolean not null,
  delivery_mode text not null,
  created_by uuid not null,
  note text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_user_id uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint customer_onboarding_intents_pkey primary key (id),
  constraint customer_onboarding_intents_capability_hash_key
    unique (capability_hash),
  constraint customer_onboarding_intents_capability_hash_length
    check (
      capability_hash is null
      or pg_catalog.octet_length(capability_hash) = 32
    ),
  constraint customer_onboarding_intents_currency_fk
    foreign key (currency_code)
    references public.currencies (code),
  constraint customer_onboarding_intents_plan_fk
    foreign key (plan_id)
    references public.subscription_plans (id),
  constraint customer_onboarding_intents_creator_fk
    foreign key (created_by)
    references public.profiles (id),
  constraint customer_onboarding_intents_consumed_user_fk
    foreign key (consumed_user_id)
    references public.profiles (id),
  constraint customer_onboarding_intents_cancelled_by_fk
    foreign key (cancelled_by)
    references public.profiles (id),
  constraint customer_onboarding_intents_email_normalized
    check (email = pg_catalog.lower(pg_catalog.btrim(email))),
  constraint customer_onboarding_intents_email_shape
    check (
      pg_catalog.char_length(email) between 3 and 320
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint customer_onboarding_intents_display_name_shape
    check (
      display_name = pg_catalog.btrim(display_name)
      and pg_catalog.char_length(display_name) between 1 and 120
      and display_name !~ '[[:cntrl:]]'
    ),
  constraint customer_onboarding_intents_workspace_name_shape
    check (
      workspace_name = pg_catalog.btrim(workspace_name)
      and pg_catalog.char_length(workspace_name) between 1 and 120
      and workspace_name !~ '[[:cntrl:]]'
    ),
  constraint customer_onboarding_intents_currency_normalized
    check (
      currency_code = pg_catalog.upper(pg_catalog.btrim(currency_code))
      and pg_catalog.char_length(currency_code) = 3
    ),
  constraint customer_onboarding_intents_initial_status
    check (subscription_status in ('trialing', 'active')),
  constraint customer_onboarding_intents_subscription_dates
    check (
      (
        subscription_status = 'trialing'
        and trial_ends_at is not null
        and trial_ends_at > starts_at
        and current_period_ends_at is not null
        and current_period_ends_at >= trial_ends_at
      )
      or (
        subscription_status = 'active'
        and trial_ends_at is null
        and current_period_ends_at is not null
        and current_period_ends_at > starts_at
      )
    ),
  constraint customer_onboarding_intents_delivery_mode
    check (
      delivery_mode in (
        'invite',
        'temporary_password',
        'password_setup_email'
      )
    ),
  constraint customer_onboarding_intents_note_length
    check (
      note = pg_catalog.btrim(note)
      and pg_catalog.char_length(note) between 3 and 500
      and note !~ '[[:cntrl:]]'
    ),
  constraint customer_onboarding_intents_expiry_cap
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '15 minutes'
    ),
  constraint customer_onboarding_intents_consumption_shape
    check (
      (consumed_at is null and consumed_user_id is null)
      or (
        consumed_at is not null
        and consumed_user_id is not null
        and consumed_at >= created_at
      )
    ),
  constraint customer_onboarding_intents_cancellation_shape
    check (
      (
        cancelled_at is null
        and cancelled_by is null
        and cancel_reason is null
      )
      or (
        cancelled_at is not null
        and cancelled_by is not null
        and cancel_reason is not null
        and cancelled_at >= created_at
        and cancel_reason = pg_catalog.btrim(cancel_reason)
        and pg_catalog.char_length(cancel_reason) between 3 and 500
        and cancel_reason !~ '[[:cntrl:]]'
      )
    ),
  constraint customer_onboarding_intents_terminal_state_exclusive
    check (
      not (
        consumed_at is not null
        and cancelled_at is not null
      )
    )
);

create index customer_onboarding_intents_lifecycle_email_idx
  on private.customer_onboarding_intents (
    email,
    created_at desc,
    id
  )
  where consumed_at is null
    and cancelled_at is null;

create index customer_onboarding_intents_expiry_idx
  on private.customer_onboarding_intents (expires_at, email, id)
  where consumed_at is null
    and cancelled_at is null;

create index customer_onboarding_intents_consumed_at_idx
  on private.customer_onboarding_intents (consumed_at, id)
  where consumed_at is not null;

create index customer_onboarding_intents_cancelled_at_idx
  on private.customer_onboarding_intents (cancelled_at, id)
  where cancelled_at is not null;

alter table private.customer_onboarding_intents
  enable row level security;

revoke all on table private.customer_onboarding_intents
  from public, anon, authenticated;

comment on table private.customer_onboarding_intents is
  'Short-lived onboarding configuration retained as lifecycle tombstones. Only SHA-256 capability hashes are stored; plaintext capabilities, passwords, and other secrets are never persisted or audited.';

create function private.lock_customer_onboarding_email(p_email text)
returns void
language sql
volatile
strict
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'customer_onboarding_intent:' || p_email,
      0
    )
  )
$$;

create function private.cleanup_supervisor_control_plane()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_batch_limit constant integer := 1000;
begin
  -- Delete idempotency first, then protect every intent still referenced by a
  -- retained prepare replay. This ordering guarantees an intent tombstone is
  -- never removed before the replay record that returns its internal ID. Each
  -- daily or opportunistic call deletes at most 1,000 rows per class, keeping
  -- the transaction bounded while allowing meaningful backlog reduction.
  with stale_idempotency as (
    select
      stored.actor_user_id,
      stored.client_id,
      stored.operation
      from private.supervisor_operation_idempotency as stored
     where stored.updated_at < v_now - interval '90 days'
     order by stored.updated_at,
       stored.actor_user_id,
       stored.client_id,
       stored.operation
     for update skip locked
     limit v_batch_limit
  )
  delete from private.supervisor_operation_idempotency as stored
   using stale_idempotency
   where stored.actor_user_id = stale_idempotency.actor_user_id
     and stored.client_id = stale_idempotency.client_id
     and stored.operation = stale_idempotency.operation;

  with stale_intents as (
    select intent.id
      from private.customer_onboarding_intents as intent
     where (
       (
         intent.consumed_at is not null
         and intent.consumed_at < v_now - interval '90 days'
       )
       or (
         intent.consumed_at is null
         and intent.cancelled_at is not null
         and intent.cancelled_at < v_now - interval '30 days'
       )
       or (
         intent.consumed_at is null
         and intent.cancelled_at is null
         and intent.expires_at < v_now - interval '30 days'
       )
     )
       and not exists (
         select 1
           from private.supervisor_operation_idempotency as retained
          where retained.operation =
              'supervisor_prepare_customer_onboarding'
            and retained.result ->> 'intent_id' = intent.id::text
       )
     order by
       coalesce(intent.consumed_at, intent.cancelled_at, intent.expires_at),
       intent.id
     for update skip locked
     limit v_batch_limit
  )
  delete from private.customer_onboarding_intents as intent
   using stale_intents
   where intent.id = stale_intents.id;
end;
$$;

comment on function private.cleanup_supervisor_control_plane() is
  'Bounded cleanup: at most 1,000 idempotency rows older than 90d, then 1,000 unreferenced cancelled/expired intents older than 30d or consumed intents older than 90d. Prepare idempotency is guaranteed for 90 days; retained replays protect intent tombstones and audit events remain immutable.';

select cron.schedule(
  'mizan-supervisor-control-plane-cleanup',
  '17 3 * * *',
  'select private.cleanup_supervisor_control_plane()'
);

create function private.begin_supervisor_operation(
  p_actor_user_id uuid,
  p_client_id uuid,
  p_operation text,
  p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_stored_payload jsonb;
  v_result jsonb;
begin
  if p_actor_user_id is null
     or p_actor_user_id is distinct from auth.uid()
     or not private.is_supervisor()
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_client_id is null then
    raise exception 'client_id is required' using errcode = '22023';
  end if;

  if p_operation is null
     or p_operation <> pg_catalog.btrim(p_operation)
     or pg_catalog.char_length(p_operation) not between 1 and 120
  then
    raise exception 'invalid idempotency operation' using errcode = '22023';
  end if;

  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
  then
    raise exception 'idempotency payload must be an object'
      using errcode = '22023';
  end if;

  insert into private.supervisor_operation_idempotency (
    actor_user_id,
    client_id,
    operation,
    payload
  )
  values (
    p_actor_user_id,
    p_client_id,
    p_operation,
    p_payload
  )
  on conflict (actor_user_id, client_id, operation) do nothing;

  select stored.payload, stored.result
    into v_stored_payload, v_result
    from private.supervisor_operation_idempotency as stored
   where stored.actor_user_id = p_actor_user_id
     and stored.client_id = p_client_id
     and stored.operation = p_operation
   for update;

  if not found then
    raise exception 'idempotency_state_missing' using errcode = 'XX000';
  end if;

  if v_stored_payload is distinct from p_payload then
    raise exception 'idempotency_conflict' using errcode = 'PT409';
  end if;

  return v_result;
end;
$$;

create function private.finish_supervisor_operation(
  p_actor_user_id uuid,
  p_client_id uuid,
  p_operation text,
  p_result jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_actor_user_id is null
     or p_actor_user_id is distinct from auth.uid()
     or not private.is_supervisor()
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_result is null
     or pg_catalog.jsonb_typeof(p_result) <> 'object'
  then
    raise exception 'idempotency result must be an object'
      using errcode = '22023';
  end if;

  update private.supervisor_operation_idempotency as stored
     set result = p_result,
         updated_at = pg_catalog.clock_timestamp()
   where stored.actor_user_id = p_actor_user_id
     and stored.client_id = p_client_id
     and stored.operation = p_operation
     and stored.result is null;

  if not found then
    raise exception 'idempotency_state_missing' using errcode = 'XX000';
  end if;
end;
$$;

create function public.supervisor_prepare_customer_onboarding(
  p_email text,
  p_display_name text,
  p_workspace_name text,
  p_currency_code text,
  p_plan_id uuid,
  p_subscription_status public.subscription_status,
  p_starts_at timestamptz,
  p_trial_ends_at timestamptz,
  p_current_period_ends_at timestamptz,
  p_must_change_password boolean,
  p_delivery_mode text,
  p_note text,
  p_client_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_email text;
  v_display_name text;
  v_workspace_name text;
  v_currency_code text;
  v_delivery_mode text;
  v_note text;
  v_payload jsonb;
  v_replay jsonb;
  v_intent_id uuid;
  v_server_now timestamptz;
  v_replaced boolean := false;
  v_previous_intent private.customer_onboarding_intents%rowtype;
  v_intent private.customer_onboarding_intents%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_email := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_display_name := nullif(
    pg_catalog.btrim(p_display_name),
    ''
  );
  v_workspace_name := nullif(
    pg_catalog.btrim(p_workspace_name),
    ''
  );
  v_currency_code := pg_catalog.upper(pg_catalog.btrim(p_currency_code));
  v_delivery_mode := pg_catalog.lower(pg_catalog.btrim(p_delivery_mode));
  v_note := nullif(pg_catalog.btrim(p_note), '');

  v_payload := pg_catalog.jsonb_build_object(
    'email', v_email,
    'display_name', v_display_name,
    'workspace_name', v_workspace_name,
    'currency_code', v_currency_code,
    'plan_id', p_plan_id,
    'subscription_status', p_subscription_status,
    'starts_at', p_starts_at,
    'trial_ends_at', p_trial_ends_at,
    'current_period_ends_at', p_current_period_ends_at,
    'must_change_password', p_must_change_password,
    'delivery_mode', v_delivery_mode,
    'note', v_note,
    'client_id', p_client_id
  );

  -- Cleanup must precede the idempotency lookup. Replays are guaranteed for
  -- 90 days; once that retention expires, cleanup may remove both the replay
  -- row and its tombstone so this request can create a new intent.
  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_prepare_customer_onboarding',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) <> 'object'
       or not (v_replay ? 'intent_id')
       or v_replay ->> 'intent_id' is null
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    v_intent_id := (v_replay ->> 'intent_id')::uuid;
    return v_intent_id;
  end if;

  if v_email is null
     or pg_catalog.char_length(v_email) not between 3 and 320
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  if v_display_name is null
     or pg_catalog.char_length(v_display_name) > 120
     or v_display_name ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  if v_workspace_name is null
     or pg_catalog.char_length(v_workspace_name) > 120
     or v_workspace_name ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_workspace_name' using errcode = '22023';
  end if;

  if v_currency_code is null
     or v_currency_code !~ '^[A-Z]{3}$'
  then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  if p_plan_id is null then
    raise exception 'inactive_plan' using errcode = 'PT409';
  end if;

  if p_subscription_status is null
     or p_subscription_status not in ('trialing', 'active')
  then
    raise exception 'invalid_initial_subscription_status'
      using errcode = '22023';
  end if;

  if p_must_change_password is null then
    raise exception 'invalid_must_change_password' using errcode = '22023';
  end if;

  if v_delivery_mode is null
     or v_delivery_mode not in (
       'invite',
       'temporary_password',
       'password_setup_email'
     )
  then
    raise exception 'invalid_delivery_mode' using errcode = '22023';
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  perform private.lock_customer_onboarding_email(v_email);

  if exists (
    select 1
      from auth.users as auth_user
     where auth_user.email = v_email
  ) then
    raise exception 'onboarding_user_exists' using errcode = 'PT409';
  end if;

  perform 1
    from public.currencies as currency
   where currency.code = v_currency_code
     and currency.is_active
   for share;

  if not found then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  perform 1
    from public.subscription_plans as plan
   where plan.id = p_plan_id
     and plan.is_active
   for share;

  if not found then
    raise exception 'inactive_plan' using errcode = 'PT409';
  end if;

  select existing.*
    into v_previous_intent
    from private.customer_onboarding_intents as existing
   where existing.email = v_email
     and existing.consumed_at is null
     and existing.cancelled_at is null
   order by existing.created_at desc, existing.id desc
   limit 1
   for update;

  v_replaced := found;
  v_server_now := pg_catalog.clock_timestamp();

  if p_starts_at is null
     or p_starts_at > v_server_now
     or p_current_period_ends_at is null
     or p_current_period_ends_at <= p_starts_at
     or (
       p_subscription_status = 'trialing'
       and (
         p_trial_ends_at is null
         or p_trial_ends_at <= p_starts_at
         or p_trial_ends_at <= v_server_now
         or p_trial_ends_at > p_current_period_ends_at
       )
     )
     or (
       p_subscription_status = 'active'
       and (
         p_trial_ends_at is not null
         or p_current_period_ends_at <= v_server_now
       )
     )
  then
    raise exception 'invalid_subscription_dates' using errcode = '22023';
  end if;

  if v_replaced and v_previous_intent.expires_at > v_server_now then
    raise exception 'onboarding_intent_conflict' using errcode = 'PT409';
  end if;

  insert into private.customer_onboarding_intents (
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
    v_email,
    v_display_name,
    v_workspace_name,
    v_currency_code,
    p_plan_id,
    p_subscription_status,
    p_starts_at,
    p_trial_ends_at,
    p_current_period_ends_at,
    p_must_change_password,
    v_delivery_mode,
    v_supervisor_id,
    v_note,
    v_server_now + interval '15 minutes',
    v_server_now
  )
  returning * into v_intent;

  perform private.write_audit(
    null::uuid,
    v_supervisor_id,
    'supervisor_prepare_customer_onboarding',
    'customer_onboarding_intents',
    v_intent.id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'before', case
        when v_replaced
          then pg_catalog.to_jsonb(v_previous_intent) - 'capability_hash'
        else 'null'::jsonb
      end,
      'after', pg_catalog.to_jsonb(v_intent) - 'capability_hash'
    )
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_prepare_customer_onboarding',
    pg_catalog.jsonb_build_object('intent_id', v_intent.id)
  );

  perform private.cleanup_supervisor_control_plane();
  return v_intent.id;
end;
$$;

create function public.supervisor_issue_customer_onboarding_capability(
  p_intent_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_email text;
  v_note text;
  v_creator_active boolean;
  v_server_now timestamptz;
  v_capability uuid;
  v_capability_hash bytea;
  v_intent private.customer_onboarding_intents%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_note := nullif(pg_catalog.btrim(p_note), '');

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  select intent.email
    into v_email
    from private.customer_onboarding_intents as intent
   where intent.id = p_intent_id;

  if not found then
    raise exception 'onboarding_intent_not_found' using errcode = 'P0002';
  end if;

  perform private.lock_customer_onboarding_email(v_email);

  select intent.*
    into v_intent
    from private.customer_onboarding_intents as intent
   where intent.id = p_intent_id
   for update;

  if not found then
    raise exception 'onboarding_intent_not_found' using errcode = 'P0002';
  end if;

  select
    creator.system_role = 'supervisor'
      and creator.account_status = 'active'
    into v_creator_active
    from public.profiles as creator
   where creator.id = v_intent.created_by
   for share;

  v_creator_active := coalesce(v_creator_active, false);

  -- Revalidate only after the email advisory lock, intent row lock, and
  -- creator row lock have all been acquired.
  v_server_now := pg_catalog.clock_timestamp();

  if v_intent.consumed_at is not null then
    raise exception 'onboarding_intent_consumed' using errcode = 'PT409';
  end if;

  if v_intent.cancelled_at is not null then
    raise exception 'onboarding_intent_cancelled' using errcode = 'PT409';
  end if;

  if v_intent.expires_at <= v_server_now then
    raise exception 'onboarding_intent_expired' using errcode = 'PT409';
  end if;

  if not v_creator_active then
    raise exception 'onboarding_creator_inactive' using errcode = 'PT409';
  end if;

  if v_intent.starts_at > v_server_now
     or (
       v_intent.subscription_status = 'trialing'
       and v_intent.trial_ends_at <= v_server_now
     )
     or (
       v_intent.subscription_status = 'active'
       and v_intent.current_period_ends_at <= v_server_now
     )
  then
    raise exception 'onboarding_subscription_dates_expired'
      using errcode = 'PT409';
  end if;

  v_capability := extensions.gen_random_uuid();
  v_capability_hash := extensions.digest(v_capability::text, 'sha256');

  update private.customer_onboarding_intents as intent
     set capability_hash = v_capability_hash
   where intent.id = v_intent.id;

  perform private.write_audit(
    null::uuid,
    v_supervisor_id,
    'supervisor_issue_customer_onboarding_capability',
    'customer_onboarding_intents',
    v_intent.id,
    pg_catalog.jsonb_build_object(
      'note', v_note,
      'rotated', v_intent.capability_hash is not null,
      'before', pg_catalog.jsonb_build_object(
        'capability_issued', v_intent.capability_hash is not null
      ),
      'after', pg_catalog.jsonb_build_object(
        'capability_issued', true
      )
    )
  );

  perform private.cleanup_supervisor_control_plane();
  return v_capability;
end;
$$;

create function public.supervisor_cancel_customer_onboarding(
  p_intent_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_email text;
  v_note text;
  v_server_now timestamptz;
  v_intent private.customer_onboarding_intents%rowtype;
  v_before jsonb;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_note := nullif(pg_catalog.btrim(p_note), '');

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  select intent.email
    into v_email
    from private.customer_onboarding_intents as intent
   where intent.id = p_intent_id;

  if not found then
    raise exception 'onboarding_intent_not_found' using errcode = 'P0002';
  end if;

  perform private.lock_customer_onboarding_email(v_email);

  select intent.*
    into v_intent
    from private.customer_onboarding_intents as intent
   where intent.id = p_intent_id
   for update;

  if not found then
    raise exception 'onboarding_intent_not_found' using errcode = 'P0002';
  end if;

  -- Revalidate lifecycle time only after the advisory and row locks.
  v_server_now := pg_catalog.clock_timestamp();

  if v_intent.consumed_at is not null then
    raise exception 'onboarding_intent_consumed' using errcode = 'PT409';
  end if;

  if v_intent.cancelled_at is not null then
    raise exception 'onboarding_intent_cancelled' using errcode = 'PT409';
  end if;

  if v_intent.expires_at <= v_server_now then
    raise exception 'onboarding_intent_expired' using errcode = 'PT409';
  end if;

  if v_intent.starts_at > v_server_now
     or (
       v_intent.subscription_status = 'trialing'
       and v_intent.trial_ends_at <= v_server_now
     )
     or (
       v_intent.subscription_status = 'active'
       and v_intent.current_period_ends_at <= v_server_now
     )
  then
    raise exception 'onboarding_subscription_dates_expired'
      using errcode = 'PT409';
  end if;

  v_before := pg_catalog.to_jsonb(v_intent) - 'capability_hash';

  update private.customer_onboarding_intents as intent
     set cancelled_at = v_server_now,
         cancelled_by = v_supervisor_id,
         cancel_reason = v_note
   where intent.id = v_intent.id
   returning * into v_intent;

  perform private.write_audit(
    null::uuid,
    v_supervisor_id,
    'supervisor_cancel_customer_onboarding',
    'customer_onboarding_intents',
    v_intent.id,
    pg_catalog.jsonb_build_object(
      'note', v_note,
      'before', v_before,
      'after', pg_catalog.to_jsonb(v_intent) - 'capability_hash'
    )
  );

  perform private.cleanup_supervisor_control_plane();
end;
$$;

create function private.sanitize_onboarding_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capability_text text;
  v_capability uuid;
  v_capability_hash_hex text;
begin
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  new.raw_user_meta_data :=
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
      - 'mizan_onboarding_capability'
      - 'mizan_onboarding_capability_hash';

  if tg_op = 'UPDATE'
     and (
       new.raw_app_meta_data ? 'mizan_onboarding_capability'
       or new.raw_app_meta_data ? 'mizan_onboarding_capability_hash'
     )
  then
    raise exception 'onboarding_capability_metadata_not_accepted_on_update'
      using errcode = '22023';
  end if;

  if new.raw_app_meta_data ? 'mizan_onboarding_capability' then
    -- A caller-supplied digest is never a credential. Remove it before reading
    -- and validating the only accepted input: the plaintext random UUID.
    new.raw_app_meta_data :=
      new.raw_app_meta_data - 'mizan_onboarding_capability_hash';

    v_capability_text := nullif(
      pg_catalog.btrim(
        new.raw_app_meta_data ->> 'mizan_onboarding_capability'
      ),
      ''
    );

    begin
      v_capability := v_capability_text::uuid;
    exception
      when invalid_text_representation then
        raise exception 'invalid_onboarding_capability'
          using errcode = '22023';
    end;

    if v_capability is null then
      raise exception 'invalid_onboarding_capability'
        using errcode = '22023';
    end if;

    v_capability_hash_hex := pg_catalog.encode(
      extensions.digest(v_capability::text, 'sha256'),
      'hex'
    );

    new.raw_app_meta_data :=
      (
        new.raw_app_meta_data
          - 'mizan_onboarding_capability'
      )
      || pg_catalog.jsonb_build_object(
        'mizan_onboarding_capability_hash',
        v_capability_hash_hex
      );
  elsif new.raw_app_meta_data ? 'mizan_onboarding_capability_hash' then
    raise exception 'onboarding_capability_hash_not_accepted'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_sanitize_onboarding_metadata
  on auth.users;
create trigger on_auth_user_sanitize_onboarding_metadata
before insert or update on auth.users
for each row execute function private.sanitize_onboarding_auth_metadata();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_normalized_email text;
  v_capability_hash_hex text;
  v_capability_hash bytea;
  v_display_name text;
  v_workspace_name text;
  v_currency_code text;
  v_workspace_id uuid;
  v_subscription_id uuid;
  v_plan_id uuid;
  v_subscription_status public.subscription_status;
  v_actor_user_id uuid;
  v_asset_account_id uuid;
  v_wallet_id uuid;
  v_started_at timestamptz;
  v_trial_ends_at timestamptz;
  v_current_period_ends_at timestamptz;
  v_must_change_password boolean := false;
  v_has_intent boolean := false;
  v_has_trusted_capability boolean := false;
  v_creator_active boolean := false;
  v_currency_active boolean := false;
  v_plan_active boolean := false;
  v_server_now timestamptz;
  v_intent private.customer_onboarding_intents%rowtype;
begin
  v_normalized_email := pg_catalog.lower(pg_catalog.btrim(new.email));
  -- The BEFORE trigger converts trusted app plaintext to a digest and strips
  -- both onboarding keys from user-controlled metadata.
  v_has_trusted_capability := coalesce(
    new.raw_app_meta_data ? 'mizan_onboarding_capability_hash',
    false
  );

  if v_normalized_email is not null then
    perform private.lock_customer_onboarding_email(v_normalized_email);
  end if;

  if v_has_trusted_capability then
    v_capability_hash_hex :=
      new.raw_app_meta_data ->> 'mizan_onboarding_capability_hash';

    if v_capability_hash_hex is null
       or v_capability_hash_hex !~ '^[0-9a-f]{64}$'
    then
      raise exception 'invalid_onboarding_capability_hash'
        using errcode = '22023';
    end if;

    v_capability_hash := pg_catalog.decode(v_capability_hash_hex, 'hex');

    select intent.*
      into v_intent
      from private.customer_onboarding_intents as intent
     where intent.capability_hash = v_capability_hash
     for update;

    if not found then
      raise exception 'onboarding_capability_unknown' using errcode = 'PT409';
    end if;

    select
      creator.system_role = 'supervisor'
        and creator.account_status = 'active'
      into v_creator_active
      from public.profiles as creator
     where creator.id = v_intent.created_by
     for share;

    v_creator_active := coalesce(v_creator_active, false);

    select currency.is_active
      into v_currency_active
      from public.currencies as currency
     where currency.code = v_intent.currency_code
     for share;

    v_currency_active := coalesce(v_currency_active, false);

    select plan.is_active
      into v_plan_active
      from public.subscription_plans as plan
     where plan.id = v_intent.plan_id
     for share;

    v_plan_active := coalesce(v_plan_active, false);

    -- Revalidate only after all advisory and row locks that can block this
    -- consumption path have been acquired.
    v_server_now := pg_catalog.clock_timestamp();

    if v_intent.consumed_at is not null then
      raise exception 'onboarding_intent_consumed' using errcode = 'PT409';
    end if;

    if v_intent.cancelled_at is not null then
      raise exception 'onboarding_intent_cancelled' using errcode = 'PT409';
    end if;

    if v_intent.expires_at <= v_server_now then
      raise exception 'onboarding_intent_expired' using errcode = 'PT409';
    end if;

    if v_normalized_email is null
       or v_intent.email <> v_normalized_email
    then
      raise exception 'onboarding_intent_email_mismatch'
        using errcode = 'PT409';
    end if;

    if not v_creator_active then
      raise exception 'onboarding_creator_inactive' using errcode = 'PT409';
    end if;

    if v_intent.starts_at > v_server_now
       or (
         v_intent.subscription_status = 'trialing'
         and v_intent.trial_ends_at <= v_server_now
       )
       or (
         v_intent.subscription_status = 'active'
         and v_intent.current_period_ends_at <= v_server_now
       )
    then
      raise exception 'onboarding_subscription_dates_expired'
        using errcode = 'PT409';
    end if;

    if not v_currency_active then
      raise exception 'invalid_currency' using errcode = '22023';
    end if;

    if not v_plan_active then
      raise exception 'inactive_plan' using errcode = 'PT409';
    end if;

    v_has_intent := true;
    v_display_name := v_intent.display_name;
    v_workspace_name := v_intent.workspace_name;
    v_currency_code := v_intent.currency_code;
    v_plan_id := v_intent.plan_id;
    v_subscription_status := v_intent.subscription_status;
    v_started_at := v_intent.starts_at;
    v_trial_ends_at := v_intent.trial_ends_at;
    v_current_period_ends_at := v_intent.current_period_ends_at;
    v_must_change_password := v_intent.must_change_password;
    v_actor_user_id := v_intent.created_by;
  else
    -- Public signup metadata remains presentation-only and is never trusted for
    -- authorization or role assignment.
    v_display_name := nullif(
      pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'),
      ''
    );

    if v_display_name is not null
       and pg_catalog.char_length(v_display_name) > 120
    then
      raise exception using
        errcode = '22023',
        message = 'display_name cannot exceed 120 characters';
    end if;

    v_workspace_name := coalesce(v_display_name, 'My workspace');
    v_currency_code := 'LYD';
    v_subscription_status := 'trialing';
    v_actor_user_id := new.id;

    select plan.id
      into v_plan_id
      from public.subscription_plans as plan
     where plan.code = 'trial'
       and plan.trial_days = 14
       and plan.is_active
     for share;

    if v_plan_id is null then
      raise exception using
        errcode = '55000',
        message = '14-day trial plan is unavailable';
    end if;

    -- Refresh after the email advisory lock and trial-plan row lock so lock
    -- wait time never shortens an ordinary signup's full 14-day trial.
    v_started_at := pg_catalog.clock_timestamp();
    v_trial_ends_at := v_started_at + interval '14 days';
    v_current_period_ends_at := v_trial_ends_at;
  end if;

  insert into public.profiles (
    id,
    system_role,
    account_status,
    display_name,
    must_change_password
  )
  values (
    new.id,
    'user',
    'active',
    v_display_name,
    v_must_change_password
  );

  insert into public.workspaces (
    name,
    default_currency_code,
    status,
    created_by
  )
  values (
    v_workspace_name,
    v_currency_code,
    'active',
    new.id
  )
  returning id into v_workspace_id;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    status
  )
  values (
    v_workspace_id,
    new.id,
    'owner',
    'active'
  );

  insert into public.workspace_subscriptions (
    workspace_id,
    plan_id,
    status,
    starts_at,
    trial_ends_at,
    current_period_ends_at
  )
  values (
    v_workspace_id,
    v_plan_id,
    v_subscription_status,
    v_started_at,
    v_trial_ends_at,
    v_current_period_ends_at
  )
  returning id into v_subscription_id;

  if v_has_intent then
    insert into public.subscription_events (
      workspace_id,
      subscription_id,
      actor_user_id,
      event_type,
      from_status,
      to_status,
      metadata
    )
    values (
      v_workspace_id,
      v_subscription_id,
      v_actor_user_id,
      case
        when v_subscription_status = 'trialing' then 'trial_started'
        else 'subscription_started'
      end,
      null,
      v_subscription_status,
      pg_catalog.jsonb_build_object(
        'intent_id', v_intent.id,
        'plan_id', v_plan_id,
        'trial_ends_at', v_trial_ends_at,
        'current_period_ends_at', v_current_period_ends_at
      )
    );
  else
    insert into public.subscription_events (
      workspace_id,
      subscription_id,
      actor_user_id,
      event_type,
      from_status,
      to_status,
      metadata
    )
    values (
      v_workspace_id,
      v_subscription_id,
      new.id,
      'trial_started',
      null,
      'trialing',
      pg_catalog.jsonb_build_object(
        'trial_ends_at', v_trial_ends_at
      )
    );
  end if;

  insert into public.categories (
    workspace_id,
    name,
    kind,
    is_system,
    created_by
  )
  values
    (
      v_workspace_id,
      'General income',
      'income',
      true,
      new.id
    ),
    (
      v_workspace_id,
      'General expense',
      'expense',
      true,
      new.id
    );

  perform private.ensure_system_accounts(
    v_workspace_id,
    v_currency_code,
    new.id
  );

  insert into public.ledger_accounts (
    workspace_id,
    currency_code,
    account_type,
    name,
    created_by
  )
  values (
    v_workspace_id,
    v_currency_code,
    'asset',
    'Cash',
    new.id
  )
  returning id into v_asset_account_id;

  insert into public.wallets (
    workspace_id,
    ledger_account_id,
    currency_code,
    name,
    status,
    created_by
  )
  values (
    v_workspace_id,
    v_asset_account_id,
    v_currency_code,
    'Cash',
    'active',
    new.id
  )
  returning id into v_wallet_id;

  if v_has_intent then
    insert into public.notifications (
      user_id,
      workspace_id,
      kind,
      title,
      body,
      metadata
    )
    values (
      new.id,
      v_workspace_id,
      'billing',
      case
        when v_subscription_status = 'trialing' then 'Trial started'
        else 'Workspace ready'
      end,
      case
        when v_subscription_status = 'trialing'
          then 'Your workspace trial is active.'
        else 'Your workspace subscription is active.'
      end,
      pg_catalog.jsonb_build_object(
        'actor_user_id', v_actor_user_id,
        'intent_id', v_intent.id,
        'subscription_status', v_subscription_status,
        'trial_ends_at', v_trial_ends_at,
        'current_period_ends_at', v_current_period_ends_at
      )
    );
  else
    insert into public.notifications (
      user_id,
      workspace_id,
      kind,
      title,
      body,
      metadata
    )
    values (
      new.id,
      v_workspace_id,
      'billing',
      'Trial started',
      'Your 14-day workspace trial is active.',
      pg_catalog.jsonb_build_object(
        'trial_ends_at', v_trial_ends_at
      )
    );
  end if;

  perform private.write_audit(
    v_workspace_id,
    v_actor_user_id,
    'workspace.bootstrapped',
    'workspaces',
    v_workspace_id,
    case
      when v_has_intent then pg_catalog.jsonb_build_object(
        'intent_id', v_intent.id,
        'subscription_id', v_subscription_id,
        'wallet_id', v_wallet_id
      )
      else pg_catalog.jsonb_build_object(
        'subscription_id', v_subscription_id,
        'wallet_id', v_wallet_id
      )
    end
  );

  if v_has_intent then
    update private.customer_onboarding_intents as intent
       set consumed_at = v_server_now,
           consumed_user_id = new.id
     where intent.id = v_intent.id
       and intent.capability_hash = v_capability_hash
       and intent.consumed_at is null
       and intent.cancelled_at is null
       and intent.expires_at > v_server_now;

    if not found then
      raise exception 'onboarding_intent_consumption_conflict'
        using errcode = 'PT409';
    end if;
  end if;

  if v_has_trusted_capability then
    -- Build NEW without either key before the BEFORE UPDATE sanitizer runs;
    -- otherwise the internal hash would correctly be rejected as caller input.
    update auth.users as auth_user
       set raw_app_meta_data =
             coalesce(auth_user.raw_app_meta_data, '{}'::jsonb)
               - 'mizan_onboarding_capability'
               - 'mizan_onboarding_capability_hash',
           raw_user_meta_data =
             coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
               - 'mizan_onboarding_capability'
               - 'mizan_onboarding_capability_hash'
     where auth_user.id = new.id;
  end if;

  return new;
end;
$$;

drop policy if exists workspaces_update_admin_or_supervisor
  on public.workspaces;
drop policy if exists workspaces_update_admin
  on public.workspaces;

create policy workspaces_update_admin
on public.workspaces
for update
to authenticated
using (
  private.has_workspace_role(
    id,
    array['owner', 'admin']::public.workspace_role[]
  )
  and private.can_write_workspace(id)
)
with check (
  private.has_workspace_role(
    id,
    array['owner', 'admin']::public.workspace_role[]
  )
  and private.can_write_workspace(id)
);

create function public.supervisor_create_plan(
  p_code text,
  p_name text,
  p_price_minor bigint,
  p_currency_code text,
  p_billing_interval public.billing_interval,
  p_interval_count smallint,
  p_trial_days smallint,
  p_is_public boolean,
  p_features jsonb,
  p_note text,
  p_client_id uuid
)
returns public.subscription_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_code text;
  v_name text;
  v_currency_code text;
  v_note text;
  v_payload jsonb;
  v_replay jsonb;
  v_plan public.subscription_plans%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_code := p_code;
  v_name := nullif(pg_catalog.btrim(p_name), '');
  v_currency_code := pg_catalog.upper(pg_catalog.btrim(p_currency_code));
  v_note := nullif(pg_catalog.btrim(p_note), '');

  v_payload := pg_catalog.jsonb_build_object(
    'code', v_code,
    'name', v_name,
    'price_minor', p_price_minor,
    'currency_code', v_currency_code,
    'billing_interval', p_billing_interval,
    'interval_count', p_interval_count,
    'trial_days', p_trial_days,
    'is_public', p_is_public,
    'features', p_features,
    'note', v_note,
    'client_id', p_client_id
  );

  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_create_plan',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) is distinct from 'object'
       or not (v_replay ? 'plan')
       or pg_catalog.jsonb_typeof(v_replay -> 'plan')
            is distinct from 'object'
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    select decoded.*
      into v_plan
      from pg_catalog.jsonb_populate_record(
        null::public.subscription_plans,
        v_replay -> 'plan'
      ) as decoded;

    if v_plan.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_plan;
  end if;

  if v_code is null
     or v_code !~ '^[a-z0-9][a-z0-9_-]{1,39}$'
  then
    raise exception 'invalid_plan_code' using errcode = '22023';
  end if;

  if v_name is null
     or pg_catalog.char_length(v_name) > 120
     or v_name ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_plan_name' using errcode = '22023';
  end if;

  if p_price_minor is null or p_price_minor < 0 then
    raise exception 'invalid_plan_price' using errcode = '22023';
  end if;

  if p_billing_interval is null
     or (
       p_billing_interval = 'none'
       and p_interval_count is not null
     )
     or (
       p_billing_interval in ('monthly', 'yearly')
       and (
         p_interval_count is null
         or p_interval_count not between 1 and 36
       )
     )
  then
    raise exception 'invalid_plan_interval' using errcode = '22023';
  end if;

  if p_trial_days is null or p_trial_days not between 0 and 365 then
    raise exception 'invalid_trial_days' using errcode = '22023';
  end if;

  if p_is_public is null then
    raise exception 'invalid_plan_visibility' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_features) is distinct from 'object' then
    raise exception 'invalid_plan_features' using errcode = '22023';
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  perform 1
    from public.currencies as currency
   where currency.code = v_currency_code
   for key share;

  if not found then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'supervisor_plan_code:' || v_code,
      0
    )
  );

  if exists (
    select 1
      from public.subscription_plans as plan
     where plan.code = v_code
  ) then
    raise exception 'plan_code_exists' using errcode = 'PT409';
  end if;

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
    v_code,
    v_name,
    p_price_minor,
    v_currency_code,
    p_billing_interval,
    p_interval_count,
    p_trial_days,
    p_is_public,
    true,
    p_features
  )
  returning * into v_plan;

  perform private.write_audit(
    null::uuid,
    v_supervisor_id,
    'supervisor_create_plan',
    'subscription_plans',
    v_plan.id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'before', 'null'::jsonb,
      'after', pg_catalog.to_jsonb(v_plan)
    )
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_create_plan',
    pg_catalog.jsonb_build_object(
      'plan',
      pg_catalog.to_jsonb(v_plan)
    )
  );

  perform private.cleanup_supervisor_control_plane();
  return v_plan;
end;
$$;

create function public.supervisor_update_plan(
  p_plan_id uuid,
  p_name text,
  p_price_minor bigint,
  p_currency_code text,
  p_billing_interval public.billing_interval,
  p_interval_count smallint,
  p_trial_days smallint,
  p_is_public boolean,
  p_features jsonb,
  p_note text,
  p_client_id uuid
)
returns public.subscription_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_name text;
  v_currency_code text;
  v_note text;
  v_payload jsonb;
  v_replay jsonb;
  v_before jsonb;
  v_plan public.subscription_plans%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_name := nullif(pg_catalog.btrim(p_name), '');
  v_currency_code := pg_catalog.upper(pg_catalog.btrim(p_currency_code));
  v_note := nullif(pg_catalog.btrim(p_note), '');

  v_payload := pg_catalog.jsonb_build_object(
    'plan_id', p_plan_id,
    'name', v_name,
    'price_minor', p_price_minor,
    'currency_code', v_currency_code,
    'billing_interval', p_billing_interval,
    'interval_count', p_interval_count,
    'trial_days', p_trial_days,
    'is_public', p_is_public,
    'features', p_features,
    'note', v_note,
    'client_id', p_client_id
  );

  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_update_plan',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) is distinct from 'object'
       or not (v_replay ? 'plan')
       or pg_catalog.jsonb_typeof(v_replay -> 'plan')
            is distinct from 'object'
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    select decoded.*
      into v_plan
      from pg_catalog.jsonb_populate_record(
        null::public.subscription_plans,
        v_replay -> 'plan'
      ) as decoded;

    if v_plan.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_plan;
  end if;

  if p_plan_id is null then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if v_name is null
     or pg_catalog.char_length(v_name) > 120
     or v_name ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_plan_name' using errcode = '22023';
  end if;

  if p_price_minor is null or p_price_minor < 0 then
    raise exception 'invalid_plan_price' using errcode = '22023';
  end if;

  if p_billing_interval is null
     or (
       p_billing_interval = 'none'
       and p_interval_count is not null
     )
     or (
       p_billing_interval in ('monthly', 'yearly')
       and (
         p_interval_count is null
         or p_interval_count not between 1 and 36
       )
     )
  then
    raise exception 'invalid_plan_interval' using errcode = '22023';
  end if;

  if p_trial_days is null or p_trial_days not between 0 and 365 then
    raise exception 'invalid_trial_days' using errcode = '22023';
  end if;

  if p_is_public is null then
    raise exception 'invalid_plan_visibility' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_features) is distinct from 'object' then
    raise exception 'invalid_plan_features' using errcode = '22023';
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  perform 1
    from public.currencies as currency
   where currency.code = v_currency_code
   for key share;

  if not found then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  select plan.*
    into v_plan
    from public.subscription_plans as plan
   where plan.id = p_plan_id
   for update;

  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if v_plan.code = 'trial'
     and v_plan.trial_days = 14
     and v_plan.is_active
     and p_trial_days <> 14
  then
    raise exception 'last_trial_plan' using errcode = 'PT409';
  end if;

  v_before := pg_catalog.to_jsonb(v_plan);

  update public.subscription_plans as plan
     set name = v_name,
         price_minor = p_price_minor,
         currency_code = v_currency_code,
         billing_interval = p_billing_interval,
         interval_count = p_interval_count,
         trial_days = p_trial_days,
         is_public = p_is_public,
         features = p_features
   where plan.id = v_plan.id
  returning plan.* into v_plan;

  perform private.write_audit(
    null::uuid,
    v_supervisor_id,
    'supervisor_update_plan',
    'subscription_plans',
    v_plan.id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'before', v_before,
      'after', pg_catalog.to_jsonb(v_plan)
    )
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_update_plan',
    pg_catalog.jsonb_build_object(
      'plan',
      pg_catalog.to_jsonb(v_plan)
    )
  );

  perform private.cleanup_supervisor_control_plane();
  return v_plan;
end;
$$;

create function public.supervisor_archive_plan(
  p_plan_id uuid,
  p_note text,
  p_client_id uuid
)
returns public.subscription_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_note text;
  v_payload jsonb;
  v_replay jsonb;
  v_before jsonb;
  v_plan public.subscription_plans%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_note := nullif(pg_catalog.btrim(p_note), '');

  v_payload := pg_catalog.jsonb_build_object(
    'plan_id', p_plan_id,
    'note', v_note,
    'client_id', p_client_id
  );

  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_archive_plan',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) is distinct from 'object'
       or not (v_replay ? 'plan')
       or pg_catalog.jsonb_typeof(v_replay -> 'plan')
            is distinct from 'object'
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    select decoded.*
      into v_plan
      from pg_catalog.jsonb_populate_record(
        null::public.subscription_plans,
        v_replay -> 'plan'
      ) as decoded;

    if v_plan.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_plan;
  end if;

  if p_plan_id is null then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  select plan.*
    into v_plan
    from public.subscription_plans as plan
   where plan.id = p_plan_id
   for update;

  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if v_plan.code = 'trial'
     and v_plan.trial_days = 14
     and v_plan.is_active
  then
    raise exception 'last_trial_plan' using errcode = 'PT409';
  end if;

  v_before := pg_catalog.to_jsonb(v_plan);

  update public.subscription_plans as plan
     set is_active = false,
         is_public = false
   where plan.id = v_plan.id
  returning plan.* into v_plan;

  perform private.write_audit(
    null::uuid,
    v_supervisor_id,
    'supervisor_archive_plan',
    'subscription_plans',
    v_plan.id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'before', v_before,
      'after', pg_catalog.to_jsonb(v_plan)
    )
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_archive_plan',
    pg_catalog.jsonb_build_object(
      'plan',
      pg_catalog.to_jsonb(v_plan)
    )
  );

  perform private.cleanup_supervisor_control_plane();
  return v_plan;
end;
$$;

create function public.supervisor_change_subscription_plan(
  p_workspace_id uuid,
  p_plan_id uuid,
  p_note text,
  p_client_id uuid
)
returns public.workspace_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_note text;
  v_payload jsonb;
  v_replay jsonb;
  v_before jsonb;
  v_from_status public.subscription_status;
  v_plan public.subscription_plans%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_note := nullif(pg_catalog.btrim(p_note), '');

  v_payload := pg_catalog.jsonb_build_object(
    'workspace_id', p_workspace_id,
    'plan_id', p_plan_id,
    'note', v_note,
    'client_id', p_client_id
  );

  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_change_subscription_plan',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) is distinct from 'object'
       or not (v_replay ? 'subscription')
       or pg_catalog.jsonb_typeof(v_replay -> 'subscription')
            is distinct from 'object'
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    select decoded.*
      into v_subscription
      from pg_catalog.jsonb_populate_record(
        null::public.workspace_subscriptions,
        v_replay -> 'subscription'
      ) as decoded;

    if v_subscription.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_subscription;
  end if;

  if p_workspace_id is null then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  if p_plan_id is null then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  select subscription.*
    into v_subscription
    from public.workspace_subscriptions as subscription
   where subscription.workspace_id = p_workspace_id
   for update;

  if not found then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  select plan.*
    into v_plan
    from public.subscription_plans as plan
   where plan.id = p_plan_id
   for key share;

  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if not v_plan.is_active then
    raise exception 'inactive_plan' using errcode = 'PT409';
  end if;

  perform pg_catalog.clock_timestamp();

  v_from_status := v_subscription.status;
  v_before := pg_catalog.to_jsonb(v_subscription);

  update public.workspace_subscriptions as subscription
     set plan_id = p_plan_id
   where subscription.id = v_subscription.id
  returning subscription.* into v_subscription;

  insert into public.subscription_events (
    workspace_id,
    subscription_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    metadata
  )
  values (
    p_workspace_id,
    v_subscription.id,
    v_supervisor_id,
    'supervisor_change_subscription_plan',
    v_from_status,
    v_subscription.status,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'old_plan_id', (v_before ->> 'plan_id')::uuid,
      'new_plan_id', p_plan_id
    )
  );

  perform private.write_audit(
    p_workspace_id,
    v_supervisor_id,
    'supervisor_change_subscription_plan',
    'workspace_subscriptions',
    v_subscription.id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'old_plan_id', (v_before ->> 'plan_id')::uuid,
      'new_plan_id', p_plan_id,
      'before', v_before,
      'after', pg_catalog.to_jsonb(v_subscription)
    )
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_change_subscription_plan',
    pg_catalog.jsonb_build_object(
      'subscription',
      pg_catalog.to_jsonb(v_subscription)
    )
  );

  perform private.cleanup_supervisor_control_plane();
  return v_subscription;
end;
$$;

create function public.supervisor_renew_subscription(
  p_workspace_id uuid,
  p_period_count smallint,
  p_note text,
  p_client_id uuid
)
returns public.workspace_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_note text;
  v_payload jsonb;
  v_replay jsonb;
  v_before jsonb;
  v_from_status public.subscription_status;
  v_now timestamptz;
  v_base timestamptz;
  v_period_months integer;
  v_new_period_end timestamptz;
  v_plan public.subscription_plans%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_note := nullif(pg_catalog.btrim(p_note), '');

  v_payload := pg_catalog.jsonb_build_object(
    'workspace_id', p_workspace_id,
    'period_count', p_period_count,
    'note', v_note,
    'client_id', p_client_id
  );

  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_renew_subscription',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) is distinct from 'object'
       or not (v_replay ? 'subscription')
       or pg_catalog.jsonb_typeof(v_replay -> 'subscription')
            is distinct from 'object'
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    select decoded.*
      into v_subscription
      from pg_catalog.jsonb_populate_record(
        null::public.workspace_subscriptions,
        v_replay -> 'subscription'
      ) as decoded;

    if v_subscription.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_subscription;
  end if;

  if p_workspace_id is null then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  if p_period_count is null
     or p_period_count not between 1 and 36
  then
    raise exception 'invalid_period_count' using errcode = '22023';
  end if;

  select subscription.*
    into v_subscription
    from public.workspace_subscriptions as subscription
   where subscription.workspace_id = p_workspace_id
   for update;

  if not found then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  perform 1
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
   for update;

  select plan.*
    into v_plan
    from public.subscription_plans as plan
   where plan.id = v_subscription.plan_id
   for key share;

  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if not v_plan.is_active then
    raise exception 'inactive_plan' using errcode = 'PT409';
  end if;

  v_period_months := case v_plan.billing_interval
    when 'monthly' then
      v_plan.interval_count::integer * p_period_count::integer
    when 'yearly' then
      12 * v_plan.interval_count::integer * p_period_count::integer
    else null
  end;

  if v_period_months is null
     or v_period_months <= 0
     or v_plan.interval_count is null
  then
    raise exception 'non_renewable_plan' using errcode = '22023';
  end if;

  v_now := pg_catalog.clock_timestamp();
  v_base := greatest(
    v_now,
    coalesce(v_subscription.current_period_ends_at, v_now)
  );
  v_new_period_end := v_base
    + pg_catalog.make_interval(months => v_period_months);

  v_from_status := v_subscription.status;
  v_before := pg_catalog.to_jsonb(v_subscription);

  update public.workspace_subscriptions as subscription
     set status = 'active',
         current_period_ends_at = v_new_period_end,
         trial_ends_at = null,
         grace_ends_at = null,
         frozen_at = null,
         expired_at = null,
         cancelled_at = null,
         scheduled_status = null,
         scheduled_status_at = null
   where subscription.id = v_subscription.id
  returning subscription.* into v_subscription;

  update public.workspaces as workspace
     set status = 'active'
   where workspace.id = p_workspace_id
     and workspace.status is distinct from 'active';

  insert into public.subscription_events (
    workspace_id,
    subscription_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    metadata
  )
  values (
    p_workspace_id,
    v_subscription.id,
    v_supervisor_id,
    'supervisor_renew_subscription',
    v_from_status,
    'active',
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'period_count', p_period_count,
      'new_period_end', v_new_period_end
    )
  );

  perform private.write_audit(
    p_workspace_id,
    v_supervisor_id,
    'supervisor_renew_subscription',
    'workspace_subscriptions',
    v_subscription.id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'period_count', p_period_count,
      'before', v_before,
      'after', pg_catalog.to_jsonb(v_subscription)
    )
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_renew_subscription',
    pg_catalog.jsonb_build_object(
      'subscription',
      pg_catalog.to_jsonb(v_subscription)
    )
  );

  perform private.cleanup_supervisor_control_plane();
  return v_subscription;
end;
$$;

create function public.supervisor_set_subscription_state(
  p_workspace_id uuid,
  p_target_status public.subscription_status,
  p_trial_ends_at timestamptz,
  p_current_period_ends_at timestamptz,
  p_grace_ends_at timestamptz,
  p_note text,
  p_client_id uuid
)
returns public.workspace_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_note text;
  v_payload jsonb;
  v_replay jsonb;
  v_before jsonb;
  v_from_status public.subscription_status;
  v_now timestamptz;
  v_allowed boolean;
  v_workspace_status public.workspace_status;
  v_subscription public.workspace_subscriptions%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_note := nullif(pg_catalog.btrim(p_note), '');

  v_payload := pg_catalog.jsonb_build_object(
    'workspace_id', p_workspace_id,
    'target_status', p_target_status,
    'trial_ends_at', p_trial_ends_at,
    'current_period_ends_at', p_current_period_ends_at,
    'grace_ends_at', p_grace_ends_at,
    'note', v_note,
    'client_id', p_client_id
  );

  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_set_subscription_state',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) is distinct from 'object'
       or not (v_replay ? 'subscription')
       or pg_catalog.jsonb_typeof(v_replay -> 'subscription')
            is distinct from 'object'
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    select decoded.*
      into v_subscription
      from pg_catalog.jsonb_populate_record(
        null::public.workspace_subscriptions,
        v_replay -> 'subscription'
      ) as decoded;

    if v_subscription.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_subscription;
  end if;

  if p_workspace_id is null then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  if p_target_status is null then
    raise exception 'invalid_subscription_transition' using errcode = 'PT409';
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  select subscription.*
    into v_subscription
    from public.workspace_subscriptions as subscription
   where subscription.workspace_id = p_workspace_id
   for update;

  if not found then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  perform 1
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
   for update;

  v_now := pg_catalog.clock_timestamp();
  v_from_status := v_subscription.status;

  v_allowed := (
    (
      v_from_status = 'trialing'
      and p_target_status in (
        'active',
        'grace',
        'frozen',
        'expired',
        'cancelled'
      )
    )
    or (
      v_from_status = 'active'
      and p_target_status in (
        'grace',
        'frozen',
        'expired',
        'cancelled'
      )
    )
    or (
      v_from_status = 'grace'
      and p_target_status in (
        'active',
        'frozen',
        'expired',
        'cancelled'
      )
    )
    or (
      v_from_status = 'frozen'
      and p_target_status in (
        'active',
        'grace',
        'expired',
        'cancelled'
      )
    )
    or (
      v_from_status = 'expired'
      and p_target_status = 'active'
    )
    or (
      v_from_status = 'cancelled'
      and p_target_status = 'active'
    )
  );

  if not v_allowed then
    raise exception 'invalid_subscription_transition'
      using errcode = 'PT409';
  end if;

  if p_target_status = 'trialing'
     and p_trial_ends_at is null
  then
    raise exception 'invalid_subscription_dates' using errcode = '22023';
  end if;

  if p_target_status = 'active'
     and p_current_period_ends_at is null
  then
    raise exception 'invalid_subscription_dates' using errcode = '22023';
  end if;

  if p_target_status = 'grace'
     and p_grace_ends_at is null
  then
    raise exception 'invalid_subscription_dates' using errcode = '22023';
  end if;

  v_before := pg_catalog.to_jsonb(v_subscription);

  update public.workspace_subscriptions as subscription
     set status = p_target_status,
         trial_ends_at = case
           when p_target_status = 'trialing' then p_trial_ends_at
           else null
         end,
         current_period_ends_at = p_current_period_ends_at,
         grace_ends_at = case
           when p_target_status = 'grace' then p_grace_ends_at
           else null
         end,
         frozen_at = case
           when p_target_status = 'frozen' then v_now
           else null
         end,
         expired_at = case
           when p_target_status = 'expired' then v_now
           else null
         end,
         cancelled_at = case
           when p_target_status = 'cancelled' then v_now
           else null
         end,
         scheduled_status = null,
         scheduled_status_at = null
   where subscription.id = v_subscription.id
  returning subscription.* into v_subscription;

  v_workspace_status := case
    when p_target_status in ('trialing', 'active', 'grace')
      then 'active'::public.workspace_status
    when p_target_status = 'frozen'
      then 'suspended'::public.workspace_status
    else 'archived'::public.workspace_status
  end;

  update public.workspaces as workspace
     set status = v_workspace_status
   where workspace.id = p_workspace_id
     and workspace.status is distinct from v_workspace_status;

  insert into public.subscription_events (
    workspace_id,
    subscription_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    metadata
  )
  values (
    p_workspace_id,
    v_subscription.id,
    v_supervisor_id,
    'supervisor_set_subscription_state',
    v_from_status,
    p_target_status,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note
    )
  );

  perform private.write_audit(
    p_workspace_id,
    v_supervisor_id,
    'supervisor_set_subscription_state',
    'workspace_subscriptions',
    v_subscription.id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'before', v_before,
      'after', pg_catalog.to_jsonb(v_subscription)
    )
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_set_subscription_state',
    pg_catalog.jsonb_build_object(
      'subscription',
      pg_catalog.to_jsonb(v_subscription)
    )
  );

  perform private.cleanup_supervisor_control_plane();
  return v_subscription;
end;
$$;

create function public.supervisor_schedule_subscription_state(
  p_workspace_id uuid,
  p_target_status public.subscription_status,
  p_scheduled_at timestamptz,
  p_note text,
  p_client_id uuid
)
returns public.workspace_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_note text;
  v_payload jsonb;
  v_replay jsonb;
  v_before jsonb;
  v_from_status public.subscription_status;
  v_now timestamptz;
  v_subscription public.workspace_subscriptions%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_note := nullif(pg_catalog.btrim(p_note), '');

  v_payload := pg_catalog.jsonb_build_object(
    'workspace_id', p_workspace_id,
    'target_status', p_target_status,
    'scheduled_at', p_scheduled_at,
    'note', v_note,
    'client_id', p_client_id
  );

  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_schedule_subscription_state',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) is distinct from 'object'
       or not (v_replay ? 'subscription')
       or pg_catalog.jsonb_typeof(v_replay -> 'subscription')
            is distinct from 'object'
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    select decoded.*
      into v_subscription
      from pg_catalog.jsonb_populate_record(
        null::public.workspace_subscriptions,
        v_replay -> 'subscription'
      ) as decoded;

    if v_subscription.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_subscription;
  end if;

  if p_workspace_id is null then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  if p_target_status is null
     or p_target_status not in ('cancelled', 'expired')
  then
    raise exception 'invalid_scheduled_subscription_state'
      using errcode = '22023';
  end if;

  select subscription.*
    into v_subscription
    from public.workspace_subscriptions as subscription
   where subscription.workspace_id = p_workspace_id
   for update;

  if not found then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  v_now := pg_catalog.clock_timestamp();

  if p_scheduled_at is null or p_scheduled_at <= v_now then
    raise exception 'invalid_scheduled_subscription_time'
      using errcode = '22023';
  end if;

  if v_subscription.status = 'active'
     and (
       v_subscription.current_period_ends_at is null
       or p_scheduled_at > v_subscription.current_period_ends_at
     )
  then
    raise exception 'invalid_scheduled_subscription_time'
      using errcode = '22023';
  end if;

  v_from_status := v_subscription.status;
  v_before := pg_catalog.to_jsonb(v_subscription);

  update public.workspace_subscriptions as subscription
     set scheduled_status = p_target_status,
         scheduled_status_at = p_scheduled_at
   where subscription.id = v_subscription.id
  returning subscription.* into v_subscription;

  insert into public.subscription_events (
    workspace_id,
    subscription_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    metadata
  )
  values (
    p_workspace_id,
    v_subscription.id,
    v_supervisor_id,
    'supervisor_schedule_subscription_state',
    v_from_status,
    p_target_status,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'scheduled_at', p_scheduled_at
    )
  );

  perform private.write_audit(
    p_workspace_id,
    v_supervisor_id,
    'supervisor_schedule_subscription_state',
    'workspace_subscriptions',
    v_subscription.id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'before', v_before,
      'after', pg_catalog.to_jsonb(v_subscription)
    )
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_schedule_subscription_state',
    pg_catalog.jsonb_build_object(
      'subscription',
      pg_catalog.to_jsonb(v_subscription)
    )
  );

  perform private.cleanup_supervisor_control_plane();
  return v_subscription;
end;
$$;

create function public.supervisor_send_notification(
  p_user_id uuid,
  p_workspace_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_metadata jsonb,
  p_note text,
  p_client_id uuid
)
returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid;
  v_note text;
  v_kind text;
  v_title text;
  v_body text;
  v_metadata jsonb;
  v_payload jsonb;
  v_replay jsonb;
  v_notification public.notifications%rowtype;
begin
  v_supervisor_id := auth.uid();

  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_note := nullif(pg_catalog.btrim(p_note), '');
  v_kind := nullif(pg_catalog.btrim(p_kind), '');
  v_title := nullif(pg_catalog.btrim(p_title), '');
  v_body := nullif(pg_catalog.btrim(p_body), '');
  v_metadata := coalesce(p_metadata, '{}'::jsonb);

  v_payload := pg_catalog.jsonb_build_object(
    'user_id', p_user_id,
    'workspace_id', p_workspace_id,
    'kind', v_kind,
    'title', v_title,
    'body', v_body,
    'metadata', v_metadata,
    'note', v_note,
    'client_id', p_client_id
  );

  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_send_notification',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) is distinct from 'object'
       or not (v_replay ? 'notification')
       or pg_catalog.jsonb_typeof(v_replay -> 'notification')
            is distinct from 'object'
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    select decoded.*
      into v_notification
      from pg_catalog.jsonb_populate_record(
        null::public.notifications,
        v_replay -> 'notification'
      ) as decoded;

    if v_notification.id is null then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_notification;
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  if p_user_id is null then
    raise exception 'invalid_notification_target' using errcode = '22023';
  end if;

  if p_workspace_id is not null then
    if not exists (
      select 1
        from public.workspace_members as member
       where member.workspace_id = p_workspace_id
         and member.user_id = p_user_id
         and member.status = 'active'
    ) then
      raise exception 'notification_target_mismatch'
        using errcode = '22023';
    end if;
  end if;

  if not exists (
    select 1
      from public.profiles as profile
     where profile.id = p_user_id
  ) then
    raise exception 'invalid_notification_target' using errcode = '22023';
  end if;

  if v_kind is null
     or v_kind not in (
       'billing',
       'payment',
       'workspace',
       'system'
     )
  then
    raise exception 'invalid_notification_kind' using errcode = '22023';
  end if;

  if v_title is null
     or pg_catalog.char_length(v_title) > 120
     or v_title ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_notification_title' using errcode = '22023';
  end if;

  if v_body is null
     or pg_catalog.char_length(v_body) > 2000
     or v_body ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_notification_body' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(v_metadata) is distinct from 'object' then
    raise exception 'invalid_notification_metadata' using errcode = '22023';
  end if;

  v_metadata := v_metadata || pg_catalog.jsonb_build_object(
    'actor_user_id', v_supervisor_id,
    'client_id', p_client_id
  );

  insert into public.notifications (
    user_id,
    workspace_id,
    kind,
    title,
    body,
    metadata
  )
  values (
    p_user_id,
    p_workspace_id,
    v_kind::public.notification_kind,
    v_title,
    v_body,
    v_metadata
  )
  returning * into v_notification;

  perform private.write_audit(
    p_workspace_id,
    v_supervisor_id,
    'supervisor_send_notification',
    'notifications',
    v_notification.id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'before', null,
      'after', pg_catalog.to_jsonb(v_notification)
    )
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_send_notification',
    pg_catalog.jsonb_build_object(
      'notification',
      pg_catalog.to_jsonb(v_notification)
    )
  );

  perform private.cleanup_supervisor_control_plane();
  return v_notification;
end;
$$;

create function public.complete_required_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  update public.profiles as profile
     set must_change_password = false,
         updated_at = pg_catalog.clock_timestamp()
   where profile.id = v_user_id
     and profile.must_change_password;
end;
$$;

create function public.supervisor_list_customers(
  p_query text,
  p_account_status public.account_status,
  p_subscription_status public.subscription_status,
  p_plan_id uuid,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_offset integer;
  v_query text;
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_query := nullif(pg_catalog.btrim(p_query), '');

  with customer_base as (
    select
      profile.id as user_id,
      auth_user.email,
      profile.display_name,
      profile.account_status,
      auth_user.last_sign_in_at,
      workspace.id as workspace_id,
      workspace.name as workspace_name,
      workspace.default_currency_code,
      workspace.status as workspace_status,
      subscription.id as subscription_id,
      subscription.status as subscription_status,
      subscription.starts_at,
      subscription.trial_ends_at,
      subscription.current_period_ends_at,
      subscription.grace_ends_at,
      subscription.frozen_at,
      subscription.expired_at,
      subscription.cancelled_at,
      subscription.scheduled_status,
      subscription.scheduled_status_at,
      case
        when subscription.scheduled_status is not null
         and subscription.scheduled_status_at
           <= pg_catalog.clock_timestamp()
        then subscription.scheduled_status
        else subscription.status
      end as effective_subscription_status,
      plan.id as plan_id,
      plan.name as plan_name,
      (
        select pg_catalog.count(*)::integer
          from public.payment_requests as payment
         where payment.workspace_id = workspace.id
           and payment.status = 'pending'
      ) as pending_payments,
      profile.created_at as profile_created_at
    from public.profiles as profile
    join auth.users as auth_user
      on auth_user.id = profile.id
    left join public.workspace_members as membership
      on membership.user_id = profile.id
     and membership.role = 'owner'
     and membership.status = 'active'
    left join public.workspaces as workspace
      on workspace.id = membership.workspace_id
    left join public.workspace_subscriptions as subscription
      on subscription.workspace_id = workspace.id
    left join public.subscription_plans as plan
      on plan.id = subscription.plan_id
    where profile.system_role = 'user'
      and (
        p_account_status is null
        or profile.account_status = p_account_status
      )
      and (
        p_plan_id is null
        or plan.id = p_plan_id
      )
      and (
        v_query is null
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(auth_user.email, '')),
          pg_catalog.lower(v_query)
        ) > 0
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(profile.display_name, '')),
          pg_catalog.lower(v_query)
        ) > 0
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(workspace.name, '')),
          pg_catalog.lower(v_query)
        ) > 0
      )
  ),
  filtered as (
    select *
      from customer_base as customer
     where p_subscription_status is null
        or customer.effective_subscription_status = p_subscription_status
  )
  select
    (
      select pg_catalog.count(*)::integer
        from filtered
    ),
    coalesce(
      (
        select pg_catalog.jsonb_agg(customer.row_json order by customer.ord)
          from (
            select
              pg_catalog.jsonb_build_object(
                'user_id', filtered.user_id,
                'email', filtered.email,
                'display_name', filtered.display_name,
                'account_status', filtered.account_status,
                'last_sign_in_at', filtered.last_sign_in_at,
                'workspace_id', filtered.workspace_id,
                'workspace_name', filtered.workspace_name,
                'default_currency_code', filtered.default_currency_code,
                'workspace_status', filtered.workspace_status,
                'subscription_id', filtered.subscription_id,
                'subscription_status', filtered.subscription_status,
                'starts_at', filtered.starts_at,
                'trial_ends_at', filtered.trial_ends_at,
                'current_period_ends_at', filtered.current_period_ends_at,
                'grace_ends_at', filtered.grace_ends_at,
                'frozen_at', filtered.frozen_at,
                'expired_at', filtered.expired_at,
                'cancelled_at', filtered.cancelled_at,
                'scheduled_status', filtered.scheduled_status,
                'scheduled_status_at', filtered.scheduled_status_at,
                'effective_subscription_status',
                  filtered.effective_subscription_status,
                'plan_id', filtered.plan_id,
                'plan_name', filtered.plan_name,
                'pending_payments', filtered.pending_payments
              ) as row_json,
              pg_catalog.row_number() over (
                order by
                  filtered.profile_created_at desc,
                  filtered.user_id desc
              ) as ord
            from filtered
            order by
              filtered.profile_created_at desc,
              filtered.user_id desc
            limit v_limit
            offset v_offset
          ) as customer
      ),
      '[]'::jsonb
    )
  into v_total, v_rows;

  return pg_catalog.jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );
end;
$$;

create function public.supervisor_get_customer(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  select pg_catalog.jsonb_build_object(
    'user_id', profile.id,
    'email', auth_user.email,
    'display_name', profile.display_name,
    'account_status', profile.account_status,
    'last_sign_in_at', auth_user.last_sign_in_at,
    'workspace_id', workspace.id,
    'workspace_name', workspace.name,
    'default_currency_code', workspace.default_currency_code,
    'workspace_status', workspace.status,
    'subscription_id', subscription.id,
    'subscription_status', subscription.status,
    'starts_at', subscription.starts_at,
    'trial_ends_at', subscription.trial_ends_at,
    'current_period_ends_at', subscription.current_period_ends_at,
    'grace_ends_at', subscription.grace_ends_at,
    'frozen_at', subscription.frozen_at,
    'expired_at', subscription.expired_at,
    'cancelled_at', subscription.cancelled_at,
    'scheduled_status', subscription.scheduled_status,
    'scheduled_status_at', subscription.scheduled_status_at,
    'effective_subscription_status',
      case
        when subscription.scheduled_status is not null
         and subscription.scheduled_status_at
           <= pg_catalog.clock_timestamp()
        then subscription.scheduled_status
        else subscription.status
      end,
    'plan_id', plan.id,
    'plan_name', plan.name,
    'pending_payments',
      (
        select pg_catalog.count(*)::integer
          from public.payment_requests as payment
         where payment.workspace_id = workspace.id
           and payment.status = 'pending'
      )
  )
    into v_row
    from public.profiles as profile
    join auth.users as auth_user
      on auth_user.id = profile.id
    left join public.workspace_members as membership
      on membership.user_id = profile.id
     and membership.role = 'owner'
     and membership.status = 'active'
    left join public.workspaces as workspace
      on workspace.id = membership.workspace_id
    left join public.workspace_subscriptions as subscription
      on subscription.workspace_id = workspace.id
    left join public.subscription_plans as plan
      on plan.id = subscription.plan_id
   where profile.id = p_user_id
     and profile.system_role = 'user';

  if v_row is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

create function public.supervisor_list_plans(
  p_include_archived boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_include_archived boolean;
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_include_archived := coalesce(p_include_archived, true);

  select
    (
      select pg_catalog.count(*)::integer
        from public.subscription_plans as plan
       where v_include_archived
          or plan.is_active
    ),
    coalesce(
      (
        select pg_catalog.jsonb_agg(plan_row.row_json order by plan_row.code)
          from (
            select
              plan.code,
              pg_catalog.jsonb_build_object(
                'plan_id', plan.id,
                'code', plan.code,
                'name', plan.name,
                'price_minor', plan.price_minor,
                'currency_code', plan.currency_code,
                'billing_interval', plan.billing_interval,
                'interval_count', plan.interval_count,
                'trial_days', plan.trial_days,
                'is_public', plan.is_public,
                'is_active', plan.is_active,
                'features', plan.features,
                'created_at', plan.created_at,
                'updated_at', plan.updated_at,
                'subscription_counts', pg_catalog.jsonb_build_object(
                  'trialing', coalesce(counts.trialing, 0),
                  'active', coalesce(counts.active, 0),
                  'grace', coalesce(counts.grace, 0),
                  'frozen', coalesce(counts.frozen, 0),
                  'expired', coalesce(counts.expired, 0),
                  'cancelled', coalesce(counts.cancelled, 0)
                )
              ) as row_json
            from public.subscription_plans as plan
            left join lateral (
              select
                pg_catalog.count(*) filter (
                  where subscription.status = 'trialing'
                )::integer as trialing,
                pg_catalog.count(*) filter (
                  where subscription.status = 'active'
                )::integer as active,
                pg_catalog.count(*) filter (
                  where subscription.status = 'grace'
                )::integer as grace,
                pg_catalog.count(*) filter (
                  where subscription.status = 'frozen'
                )::integer as frozen,
                pg_catalog.count(*) filter (
                  where subscription.status = 'expired'
                )::integer as expired,
                pg_catalog.count(*) filter (
                  where subscription.status = 'cancelled'
                )::integer as cancelled
              from public.workspace_subscriptions as subscription
              where subscription.plan_id = plan.id
            ) as counts on true
            where v_include_archived
               or plan.is_active
          ) as plan_row
      ),
      '[]'::jsonb
    )
  into v_total, v_rows;

  return pg_catalog.jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );
end;
$$;

create function public.supervisor_list_payments(
  p_status public.payment_request_status,
  p_query text,
  p_plan_id uuid,
  p_currency_code text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_offset integer;
  v_query text;
  v_currency_code text;
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_query := nullif(pg_catalog.btrim(p_query), '');
  v_currency_code := nullif(
    pg_catalog.upper(pg_catalog.btrim(p_currency_code)),
    ''
  );

  with payment_base as (
    select
      payment.id as payment_request_id,
      payment.status,
      payment.amount_minor,
      payment.currency_code,
      payment.period_count,
      payment.proof_object_path,
      payment.requester_note,
      payment.review_note,
      payment.reviewed_at,
      payment.created_at,
      payment.workspace_id,
      workspace.name as workspace_name,
      payment.requested_by as user_id,
      auth_user.email,
      requester.display_name,
      payment.plan_id,
      plan.name as plan_name,
      payment.reviewed_by,
      reviewer.display_name as reviewer_display_name
    from public.payment_requests as payment
    join public.workspaces as workspace
      on workspace.id = payment.workspace_id
    join public.profiles as requester
      on requester.id = payment.requested_by
    join auth.users as auth_user
      on auth_user.id = payment.requested_by
    join public.subscription_plans as plan
      on plan.id = payment.plan_id
    left join public.profiles as reviewer
      on reviewer.id = payment.reviewed_by
    where (
      p_status is null
      or payment.status = p_status
    )
      and (
        p_plan_id is null
        or payment.plan_id = p_plan_id
      )
      and (
        v_currency_code is null
        or payment.currency_code = v_currency_code
      )
      and (
        p_from is null
        or payment.created_at >= p_from
      )
      and (
        p_to is null
        or payment.created_at <= p_to
      )
      and (
        v_query is null
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(auth_user.email, '')),
          pg_catalog.lower(v_query)
        ) > 0
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(requester.display_name, '')),
          pg_catalog.lower(v_query)
        ) > 0
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(workspace.name, '')),
          pg_catalog.lower(v_query)
        ) > 0
      )
  )
  select
    (
      select pg_catalog.count(*)::integer
        from payment_base
    ),
    coalesce(
      (
        select pg_catalog.jsonb_agg(payment.row_json order by payment.ord)
          from (
            select
              pg_catalog.jsonb_build_object(
                'payment_request_id', payment_base.payment_request_id,
                'status', payment_base.status,
                'amount_minor', payment_base.amount_minor,
                'currency_code', payment_base.currency_code,
                'period_count', payment_base.period_count,
                'proof_object_path', payment_base.proof_object_path,
                'requester_note', payment_base.requester_note,
                'review_note', payment_base.review_note,
                'reviewed_at', payment_base.reviewed_at,
                'created_at', payment_base.created_at,
                'workspace_id', payment_base.workspace_id,
                'workspace_name', payment_base.workspace_name,
                'user_id', payment_base.user_id,
                'email', payment_base.email,
                'display_name', payment_base.display_name,
                'plan_id', payment_base.plan_id,
                'plan_name', payment_base.plan_name,
                'reviewed_by', payment_base.reviewed_by,
                'reviewer_display_name', payment_base.reviewer_display_name
              ) as row_json,
              pg_catalog.row_number() over (
                order by
                  payment_base.created_at desc,
                  payment_base.payment_request_id desc
              ) as ord
            from payment_base
            order by
              payment_base.created_at desc,
              payment_base.payment_request_id desc
            limit v_limit
            offset v_offset
          ) as payment
      ),
      '[]'::jsonb
    )
  into v_total, v_rows;

  return pg_catalog.jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );
end;
$$;

revoke all on function private.lock_customer_onboarding_email(text)
  from public, anon, authenticated;
revoke all on function private.cleanup_supervisor_control_plane()
  from public, anon, authenticated;
revoke all on function private.begin_supervisor_operation(
  uuid,
  uuid,
  text,
  jsonb
) from public, anon, authenticated;
revoke all on function private.finish_supervisor_operation(
  uuid,
  uuid,
  text,
  jsonb
) from public, anon, authenticated;
revoke all on function private.sanitize_onboarding_auth_metadata()
  from public, anon, authenticated;
revoke all on function private.handle_new_user()
  from public, anon, authenticated;

revoke all on function public.supervisor_prepare_customer_onboarding(
  text,
  text,
  text,
  text,
  uuid,
  public.subscription_status,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  text,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.supervisor_issue_customer_onboarding_capability(
  uuid,
  text
) from public, anon, authenticated;
revoke all on function public.supervisor_cancel_customer_onboarding(uuid, text)
  from public, anon, authenticated;
revoke all on function public.supervisor_create_plan(
  text,
  text,
  bigint,
  text,
  public.billing_interval,
  smallint,
  smallint,
  boolean,
  jsonb,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.supervisor_update_plan(
  uuid,
  text,
  bigint,
  text,
  public.billing_interval,
  smallint,
  smallint,
  boolean,
  jsonb,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.supervisor_archive_plan(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.supervisor_change_subscription_plan(
  uuid,
  uuid,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.supervisor_renew_subscription(
  uuid,
  smallint,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.supervisor_set_subscription_state(
  uuid,
  public.subscription_status,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.supervisor_schedule_subscription_state(
  uuid,
  public.subscription_status,
  timestamptz,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.supervisor_send_notification(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.complete_required_password_change()
  from public, anon, authenticated;
revoke all on function public.supervisor_list_customers(
  text,
  public.account_status,
  public.subscription_status,
  uuid,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.supervisor_get_customer(uuid)
  from public, anon, authenticated;
revoke all on function public.supervisor_list_plans(boolean)
  from public, anon, authenticated;
revoke all on function public.supervisor_list_payments(
  public.payment_request_status,
  text,
  uuid,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.supervisor_prepare_customer_onboarding(
  text,
  text,
  text,
  text,
  uuid,
  public.subscription_status,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  text,
  text,
  uuid
) to authenticated;
grant execute on function public.supervisor_issue_customer_onboarding_capability(
  uuid,
  text
) to authenticated;
grant execute on function public.supervisor_cancel_customer_onboarding(uuid, text)
  to authenticated;
grant execute on function public.supervisor_create_plan(
  text,
  text,
  bigint,
  text,
  public.billing_interval,
  smallint,
  smallint,
  boolean,
  jsonb,
  text,
  uuid
) to authenticated;
grant execute on function public.supervisor_update_plan(
  uuid,
  text,
  bigint,
  text,
  public.billing_interval,
  smallint,
  smallint,
  boolean,
  jsonb,
  text,
  uuid
) to authenticated;
grant execute on function public.supervisor_archive_plan(uuid, text, uuid)
  to authenticated;
grant execute on function public.supervisor_change_subscription_plan(
  uuid,
  uuid,
  text,
  uuid
) to authenticated;
grant execute on function public.supervisor_renew_subscription(
  uuid,
  smallint,
  text,
  uuid
) to authenticated;
grant execute on function public.supervisor_set_subscription_state(
  uuid,
  public.subscription_status,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  uuid
) to authenticated;
grant execute on function public.supervisor_schedule_subscription_state(
  uuid,
  public.subscription_status,
  timestamptz,
  text,
  uuid
) to authenticated;
grant execute on function public.supervisor_send_notification(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  uuid
) to authenticated;
grant execute on function public.complete_required_password_change()
  to authenticated;
grant execute on function public.supervisor_list_customers(
  text,
  public.account_status,
  public.subscription_status,
  uuid,
  integer,
  integer
) to authenticated;
grant execute on function public.supervisor_get_customer(uuid)
  to authenticated;
grant execute on function public.supervisor_list_plans(boolean)
  to authenticated;
grant execute on function public.supervisor_list_payments(
  public.payment_request_status,
  text,
  uuid,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer
) to authenticated;

comment on function public.supervisor_prepare_customer_onboarding(
  text,
  text,
  text,
  text,
  uuid,
  public.subscription_status,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean,
  text,
  text,
  uuid
) is
  'Creates a short-lived onboarding intent and returns its internal row ID. Exact replay is guaranteed for 90 days; after retention cleanup the same request may create a new intent.';

comment on function public.supervisor_issue_customer_onboarding_capability(
  uuid,
  text
) is
  'Rotates a valid intent capability and returns the plaintext random UUID exactly once; only its SHA-256 hash is stored and audit metadata contains no token or hash.';

comment on function public.supervisor_cancel_customer_onboarding(uuid, text) is
  'Marks the internal onboarding intent ID as a cancelled tombstone through an audited supervisor path.';

comment on function public.supervisor_create_plan(
  text,
  text,
  bigint,
  text,
  public.billing_interval,
  smallint,
  smallint,
  boolean,
  jsonb,
  text,
  uuid
) is
  'Creates a validated active subscription plan through an audited, idempotent supervisor path.';

comment on function public.supervisor_update_plan(
  uuid,
  text,
  bigint,
  text,
  public.billing_interval,
  smallint,
  smallint,
  boolean,
  jsonb,
  text,
  uuid
) is
  'Updates mutable subscription plan fields without changing the immutable code through an audited, idempotent supervisor path.';

comment on function public.supervisor_archive_plan(uuid, text, uuid) is
  'Archives a subscription plan without deleting it or changing subscription history through an audited, idempotent supervisor path.';

comment on function public.supervisor_change_subscription_plan(
  uuid,
  uuid,
  text,
  uuid
) is
  'Changes a workspace subscription plan through an audited, idempotent supervisor path without altering status or period dates.';

comment on function public.supervisor_renew_subscription(
  uuid,
  smallint,
  text,
  uuid
) is
  'Renews a workspace subscription from max(now, current period end), activates it, and clears grace/frozen/expired/cancelled and scheduled markers.';

comment on function public.supervisor_set_subscription_state(
  uuid,
  public.subscription_status,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  uuid
) is
  'Applies an allowed immediate subscription status transition with required date shape and aligned workspace status through an audited, idempotent path.';

comment on function public.supervisor_schedule_subscription_state(
  uuid,
  public.subscription_status,
  timestamptz,
  text,
  uuid
) is
  'Schedules a future cancelled or expired subscription state without changing the current status through an audited, idempotent supervisor path.';

comment on function public.supervisor_send_notification(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb,
  text,
  uuid
) is
  'Sends an in-app notification to a recipient through an audited, idempotent supervisor path; membership is required when both user and workspace are provided.';

comment on function public.complete_required_password_change() is
  'Clears must_change_password for the authenticated caller only after they complete a required password update.';

comment on function public.supervisor_list_customers(
  text,
  public.account_status,
  public.subscription_status,
  uuid,
  integer,
  integer
) is
  'Returns a paginated allow-listed customer read model for active supervisors, with effective subscription status and pre-pagination totals.';

comment on function public.supervisor_get_customer(uuid) is
  'Returns one allow-listed customer control-plane row for an active supervisor without exposing auth secrets or metadata.';

comment on function public.supervisor_list_plans(boolean) is
  'Returns subscription plans with per-status subscription counts; archived plans are included when p_include_archived is true.';

comment on function public.supervisor_list_payments(
  public.payment_request_status,
  text,
  uuid,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer
) is
  'Returns a paginated enriched payment-request read model for active supervisors with independent filters and deterministic ordering.';
