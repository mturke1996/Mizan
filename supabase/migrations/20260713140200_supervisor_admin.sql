-- Supervisor admin RPCs: freeze/unfreeze workspace, extend trial, set account status.

create or replace function public.supervisor_freeze_workspace(
  p_workspace_id uuid,
  p_note text default null
)
returns public.workspace_subscriptions
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_sub public.workspace_subscriptions;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_from public.subscription_status;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_sub
  from public.workspace_subscriptions
  where workspace_id = p_workspace_id
  for update;

  if v_sub.id is null then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  v_from := v_sub.status;

  update public.workspace_subscriptions
  set
    status = 'frozen',
    frozen_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where workspace_id = p_workspace_id
  returning * into v_sub;

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
    v_sub.id,
    auth.uid(),
    'supervisor_freeze',
    v_from,
    'frozen',
    jsonb_build_object('note', v_note)
  );

  return v_sub;
end;
$$;

create or replace function public.supervisor_unfreeze_workspace(
  p_workspace_id uuid,
  p_note text default null
)
returns public.workspace_subscriptions
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_sub public.workspace_subscriptions;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_from public.subscription_status;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_sub
  from public.workspace_subscriptions
  where workspace_id = p_workspace_id
  for update;

  if v_sub.id is null then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  v_from := v_sub.status;

  update public.workspace_subscriptions
  set
    status = case
      when trial_ends_at is not null and trial_ends_at > clock_timestamp() then 'trialing'
      when current_period_ends_at is not null and current_period_ends_at > clock_timestamp() then 'active'
      else 'expired'
    end,
    frozen_at = null,
    updated_at = clock_timestamp()
  where workspace_id = p_workspace_id
  returning * into v_sub;

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
    v_sub.id,
    auth.uid(),
    'supervisor_unfreeze',
    v_from,
    v_sub.status,
    jsonb_build_object('note', v_note)
  );

  return v_sub;
end;
$$;

create or replace function public.supervisor_extend_trial(
  p_workspace_id uuid,
  p_extra_days integer,
  p_note text default null
)
returns public.workspace_subscriptions
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_sub public.workspace_subscriptions;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_from public.subscription_status;
  v_base timestamptz;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_extra_days is null or p_extra_days < 1 or p_extra_days > 365 then
    raise exception 'invalid_extra_days' using errcode = '22023';
  end if;

  select * into v_sub
  from public.workspace_subscriptions
  where workspace_id = p_workspace_id
  for update;

  if v_sub.id is null then
    raise exception 'subscription_not_found' using errcode = 'P0002';
  end if;

  v_from := v_sub.status;
  v_base := greatest(coalesce(v_sub.trial_ends_at, clock_timestamp()), clock_timestamp());

  update public.workspace_subscriptions
  set
    status = 'trialing',
    trial_ends_at = v_base + make_interval(days => p_extra_days),
    frozen_at = null,
    expired_at = null,
    updated_at = clock_timestamp()
  where workspace_id = p_workspace_id
  returning * into v_sub;

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
    v_sub.id,
    auth.uid(),
    'supervisor_extend_trial',
    v_from,
    v_sub.status,
    jsonb_build_object('extra_days', p_extra_days, 'note', v_note)
  );

  return v_sub;
end;
$$;

create or replace function public.supervisor_set_account_status(
  p_user_id uuid,
  p_status public.account_status,
  p_note text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_profile public.profiles;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'cannot_modify_self' using errcode = '42501';
  end if;

  update public.profiles
  set
    account_status = p_status,
    updated_at = clock_timestamp()
  where id = p_user_id
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  insert into audit.events (
    actor_user_id,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'supervisor_set_account_status',
    'profiles',
    p_user_id,
    jsonb_build_object('status', p_status, 'note', v_note)
  );

  return v_profile;
end;
$$;

create or replace view public.supervisor_workspace_overview
with (security_invoker = true)
as
select
  workspace.id as workspace_id,
  workspace.name as workspace_name,
  workspace.default_currency_code,
  workspace.status as workspace_status,
  workspace.created_at as workspace_created_at,
  owner_profile.id as owner_user_id,
  owner_profile.display_name as owner_display_name,
  owner_profile.account_status as owner_account_status,
  subscription.id as subscription_id,
  subscription.status as subscription_status,
  subscription.trial_ends_at,
  subscription.current_period_ends_at,
  subscription.frozen_at,
  plan.code as plan_code,
  plan.name as plan_name,
  (
    select count(*)::int
    from public.payment_requests as payment
    where payment.workspace_id = workspace.id
      and payment.status = 'pending'
  ) as pending_payments
from public.workspaces as workspace
left join public.workspace_members as membership
  on membership.workspace_id = workspace.id
 and membership.role = 'owner'
 and membership.status = 'active'
left join public.profiles as owner_profile
  on owner_profile.id = membership.user_id
left join public.workspace_subscriptions as subscription
  on subscription.workspace_id = workspace.id
left join public.subscription_plans as plan
  on plan.id = subscription.plan_id;

grant execute on function public.supervisor_freeze_workspace(uuid, text) to authenticated;
grant execute on function public.supervisor_unfreeze_workspace(uuid, text) to authenticated;
grant execute on function public.supervisor_extend_trial(uuid, integer, text) to authenticated;
grant execute on function public.supervisor_set_account_status(uuid, public.account_status, text) to authenticated;
grant select on public.supervisor_workspace_overview to authenticated;
