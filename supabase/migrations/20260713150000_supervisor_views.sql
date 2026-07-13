-- Supervisor platform stats + user directory views.

create or replace view public.supervisor_platform_stats
with (security_invoker = true)
as
select
  (select count(*)::int from public.workspaces) as total_workspaces,
  (select count(*)::int from public.profiles where system_role = 'user') as total_users,
  (
    select count(*)::int
    from public.workspace_subscriptions
    where status = 'trialing'
  ) as trialing_count,
  (
    select count(*)::int
    from public.workspace_subscriptions
    where status = 'active'
  ) as active_count,
  (
    select count(*)::int
    from public.workspace_subscriptions
    where status = 'frozen'
  ) as frozen_count,
  (
    select count(*)::int
    from public.workspace_subscriptions
    where status in ('expired', 'cancelled')
  ) as churned_count,
  (
    select count(*)::int
    from public.payment_requests
    where status = 'pending'
  ) as pending_payments,
  (
    select coalesce(sum(amount_minor::numeric), 0)::text
    from public.payment_requests
    where status = 'pending'
  ) as pending_amount_minor,
  (
    select count(*)::int
    from public.profiles
    where account_status <> 'active'
  ) as suspended_users;

create or replace view public.supervisor_user_directory
with (security_invoker = true)
as
select
  profile.id as user_id,
  profile.display_name,
  profile.account_status,
  profile.system_role,
  profile.created_at,
  membership.workspace_id,
  workspace.name as workspace_name,
  subscription.status as subscription_status,
  subscription.trial_ends_at
from public.profiles as profile
left join public.workspace_members as membership
  on membership.user_id = profile.id
 and membership.role = 'owner'
 and membership.status = 'active'
left join public.workspaces as workspace
  on workspace.id = membership.workspace_id
left join public.workspace_subscriptions as subscription
  on subscription.workspace_id = membership.workspace_id
where profile.system_role = 'user';

grant select on public.supervisor_platform_stats to authenticated;
grant select on public.supervisor_user_directory to authenticated;
