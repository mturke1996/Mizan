-- Fix: assigning a paid plan must activate the subscription (not leave it trialing).
-- Also repair already-stuck rows and clear trial metadata whenever status becomes active.

-- ─── Clear trial timestamps whenever a subscription becomes active ───────────
create or replace function private.clear_trial_on_activate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' then
    new.trial_ends_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_subscriptions_clear_trial_on_activate
  on public.workspace_subscriptions;

create trigger workspace_subscriptions_clear_trial_on_activate
before update of status on public.workspace_subscriptions
for each row
when (new.status = 'active')
execute function private.clear_trial_on_activate();

-- ─── Change plan: activate when assigning a renewable paid plan ──────────────
create or replace function public.supervisor_change_subscription_plan(
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
  v_now timestamptz;
  v_period_months integer;
  v_new_period_end timestamptz;
  v_should_activate boolean;
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

  perform 1
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
   for update;

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

  v_now := pg_catalog.clock_timestamp();
  v_from_status := v_subscription.status;
  v_before := pg_catalog.to_jsonb(v_subscription);

  v_period_months := case v_plan.billing_interval
    when 'monthly' then v_plan.interval_count::integer
    when 'yearly' then 12 * v_plan.interval_count::integer
    else null
  end;

  -- Paid renewable plan + not already active → activate for one billing period.
  v_should_activate :=
    v_period_months is not null
    and v_period_months > 0
    and v_subscription.status is distinct from 'active';

  if v_should_activate then
    v_new_period_end := v_now
      + pg_catalog.make_interval(months => v_period_months);

    update public.workspace_subscriptions as subscription
       set plan_id = p_plan_id,
           status = 'active',
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
  else
    -- Already active (or non-renewable trial plan): swap plan only.
    update public.workspace_subscriptions as subscription
       set plan_id = p_plan_id
     where subscription.id = v_subscription.id
    returning subscription.* into v_subscription;
  end if;

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
      'new_plan_id', p_plan_id,
      'activated', v_should_activate,
      'new_period_end', v_new_period_end
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
      'activated', v_should_activate,
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

comment on function public.supervisor_change_subscription_plan(uuid, uuid, text, uuid) is
  'Changes a workspace subscription plan. Assigning a renewable paid plan activates the subscription for one billing period; already-active subscriptions keep status/dates and only swap plan_id.';

-- ─── Repair stuck paid plans left on trialing ────────────────────────────────
do $$
declare
  v_row record;
  v_period_months integer;
  v_new_period_end timestamptz;
begin
  for v_row in
    select
      subscription.id,
      subscription.workspace_id,
      subscription.plan_id,
      plan.billing_interval,
      plan.interval_count
    from public.workspace_subscriptions as subscription
    join public.subscription_plans as plan
      on plan.id = subscription.plan_id
    where subscription.status = 'trialing'
      and plan.billing_interval in ('monthly', 'yearly')
      and plan.interval_count is not null
      and plan.interval_count > 0
  loop
    v_period_months := case v_row.billing_interval
      when 'monthly' then v_row.interval_count::integer
      when 'yearly' then 12 * v_row.interval_count::integer
    end;
    v_new_period_end :=
      pg_catalog.clock_timestamp()
      + pg_catalog.make_interval(months => v_period_months);

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
     where subscription.id = v_row.id;

    update public.workspaces as workspace
       set status = 'active'
     where workspace.id = v_row.workspace_id
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
      v_row.workspace_id,
      v_row.id,
      null,
      'system_repair_activate_paid_plan',
      'trialing',
      'active',
      pg_catalog.jsonb_build_object(
        'reason', 'paid_plan_left_on_trialing',
        'plan_id', v_row.plan_id,
        'new_period_end', v_new_period_end
      )
    );
  end loop;
end;
$$;

-- Clear stale trial timestamps on already-active subscriptions.
update public.workspace_subscriptions
   set trial_ends_at = null
 where status = 'active'
   and trial_ends_at is not null;
