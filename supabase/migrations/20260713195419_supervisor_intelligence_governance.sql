-- Supervisor intelligence, notification campaigns, financial read-only access,
-- and governance audit/control-ledger RPCs.

create table private.notification_campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid not null references public.profiles (id),
  segment text not null,
  title text not null,
  body text not null,
  recipient_count integer not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint notification_campaigns_segment_shape
    check (
      segment in (
        'all_active',
        'trialing',
        'expiring_7d',
        'grace',
        'frozen'
      )
    ),
  constraint notification_campaigns_title_shape
    check (
      title = pg_catalog.btrim(title)
      and pg_catalog.char_length(title) between 1 and 120
      and title !~ '[[:cntrl:]]'
    ),
  constraint notification_campaigns_body_shape
    check (
      body = pg_catalog.btrim(body)
      and pg_catalog.char_length(body) between 1 and 2000
      and body !~ '[[:cntrl:]]'
    ),
  constraint notification_campaigns_recipient_count_range
    check (recipient_count between 0 and 10000)
);

alter table private.notification_campaigns enable row level security;

revoke all on table private.notification_campaigns
  from public, anon, authenticated;

create index notification_campaigns_created_at_idx
  on private.notification_campaigns (created_at desc, id desc);

create index payment_requests_status_reviewed_at_idx
  on public.payment_requests (status, reviewed_at)
  where status in ('approved', 'rejected');

create index notifications_campaign_id_idx
  on public.notifications ((metadata ->> 'campaign_id'))
  where metadata ? 'campaign_id';

create index audit_events_action_created_idx
  on audit.events (action, created_at desc);

create function private.sanitize_supervisor_audit_metadata(
  p_metadata jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_key text;
  v_value jsonb;
  v_result jsonb := '{}'::jsonb;
  v_secret_keys text[] := array[
    'password',
    'temporary_password',
    'encrypted_password',
    'capability',
    'capability_token',
    'capability_hash',
    'secret',
    'token',
    'access_token',
    'refresh_token'
  ];
begin
  if pg_catalog.jsonb_typeof(v_metadata) is distinct from 'object' then
    return '{}'::jsonb;
  end if;

  for v_key, v_value in
    select key, value
      from pg_catalog.jsonb_each(v_metadata)
  loop
    if v_key = any (v_secret_keys) then
      continue;
    end if;

    if pg_catalog.jsonb_typeof(v_value) = 'object' then
      v_result := v_result || pg_catalog.jsonb_build_object(
        v_key,
        private.sanitize_supervisor_audit_metadata(v_value)
      );
    else
      v_result := v_result || pg_catalog.jsonb_build_object(v_key, v_value);
    end if;
  end loop;

  return v_result;
end;
$$;

create function private.campaign_segment_recipients(
  p_segment text
)
returns table (
  user_id uuid,
  workspace_id uuid
)
language sql
stable
set search_path = ''
as $$
  with owners as (
    select
      profile.id as user_id,
      workspace.id as workspace_id,
      subscription.status as subscription_status,
      subscription.trial_ends_at,
      subscription.current_period_ends_at
    from public.profiles as profile
    join public.workspace_members as membership
      on membership.user_id = profile.id
     and membership.role = 'owner'
     and membership.status = 'active'
    join public.workspaces as workspace
      on workspace.id = membership.workspace_id
    join public.workspace_subscriptions as subscription
      on subscription.workspace_id = workspace.id
    where profile.system_role = 'user'
      and profile.account_status = 'active'
  )
  select owners.user_id, owners.workspace_id
    from owners
   where case p_segment
           when 'all_active' then owners.subscription_status = 'active'
           when 'trialing' then owners.subscription_status = 'trialing'
           when 'grace' then owners.subscription_status = 'grace'
           when 'frozen' then owners.subscription_status = 'frozen'
           when 'expiring_7d' then
             owners.subscription_status in ('active', 'trialing')
             and coalesce(
               owners.current_period_ends_at,
               owners.trial_ends_at
             ) is not null
             and coalesce(
               owners.current_period_ends_at,
               owners.trial_ends_at
             ) > pg_catalog.clock_timestamp()
             and coalesce(
               owners.current_period_ends_at,
               owners.trial_ends_at
             ) <= pg_catalog.clock_timestamp() + interval '7 days'
           else false
         end
   order by owners.user_id, owners.workspace_id;
$$;

create function private.assert_supervisor_financial_read(
  p_workspace_id uuid,
  p_resource text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid := auth.uid();
  v_resource text := nullif(pg_catalog.btrim(p_resource), '');
  v_audit_id uuid;
begin
  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_workspace_id is null then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  if v_resource is null
     or pg_catalog.char_length(v_resource) > 80
     or v_resource ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_financial_resource' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.workspaces as workspace
     where workspace.id = p_workspace_id
  ) then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  v_audit_id := private.write_audit(
    p_workspace_id,
    v_supervisor_id,
    'supervisor.financial_accessed',
    'workspaces',
    p_workspace_id,
    pg_catalog.jsonb_build_object('resource', v_resource)
  );

  return v_audit_id;
end;
$$;

create function public.supervisor_operational_metrics(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customers jsonb;
  v_payments jsonb;
  v_trials jsonb;
  v_pending bigint;
  v_approved bigint;
  v_rejected bigint;
  v_approval_sample bigint;
  v_approval_rate numeric;
  v_avg_review_minutes numeric;
  v_converted bigint;
  v_decided bigint;
  v_trial_rate numeric;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_time_range' using errcode = '22023';
  end if;

  select pg_catalog.jsonb_build_object(
    'total',
    (
      select pg_catalog.count(*)::integer
        from public.profiles as profile
       where profile.system_role = 'user'
    ),
    'active',
    (
      select pg_catalog.count(*)::integer
        from public.workspace_subscriptions as subscription
       where subscription.status = 'active'
    ),
    'trialing',
    (
      select pg_catalog.count(*)::integer
        from public.workspace_subscriptions as subscription
       where subscription.status = 'trialing'
    ),
    'grace',
    (
      select pg_catalog.count(*)::integer
        from public.workspace_subscriptions as subscription
       where subscription.status = 'grace'
    ),
    'frozen',
    (
      select pg_catalog.count(*)::integer
        from public.workspace_subscriptions as subscription
       where subscription.status = 'frozen'
    ),
    'expiring_7d',
    (
      select pg_catalog.count(*)::integer
        from public.workspace_subscriptions as subscription
       where subscription.status in ('active', 'trialing')
         and coalesce(
           subscription.current_period_ends_at,
           subscription.trial_ends_at
         ) is not null
         and coalesce(
           subscription.current_period_ends_at,
           subscription.trial_ends_at
         ) > pg_catalog.clock_timestamp()
         and coalesce(
           subscription.current_period_ends_at,
           subscription.trial_ends_at
         ) <= pg_catalog.clock_timestamp() + interval '7 days'
    )
  )
  into v_customers;

  select
    pg_catalog.count(*) filter (
      where payment.status = 'pending'
        and payment.created_at >= p_from
        and payment.created_at <= p_to
    ),
    pg_catalog.count(*) filter (
      where payment.status = 'approved'
        and payment.reviewed_at is not null
        and payment.reviewed_at >= p_from
        and payment.reviewed_at <= p_to
    ),
    pg_catalog.count(*) filter (
      where payment.status = 'rejected'
        and payment.reviewed_at is not null
        and payment.reviewed_at >= p_from
        and payment.reviewed_at <= p_to
    ),
    pg_catalog.avg(
      extract(
        epoch from (payment.reviewed_at - payment.created_at)
      ) / 60.0
    ) filter (
      where payment.status in ('approved', 'rejected')
        and payment.reviewed_at is not null
        and payment.reviewed_at >= p_from
        and payment.reviewed_at <= p_to
    )
  into v_pending, v_approved, v_rejected, v_avg_review_minutes
  from public.payment_requests as payment;

  v_approval_sample := coalesce(v_approved, 0) + coalesce(v_rejected, 0);
  if v_approval_sample = 0 then
    v_approval_rate := null;
  else
    v_approval_rate :=
      (coalesce(v_approved, 0)::numeric / v_approval_sample::numeric) * 100;
  end if;

  select pg_catalog.jsonb_build_object(
    'pending', coalesce(v_pending, 0),
    'approved', coalesce(v_approved, 0),
    'rejected', coalesce(v_rejected, 0),
    'approval_rate', v_approval_rate,
    'approval_sample_size', v_approval_sample,
    'average_review_minutes', v_avg_review_minutes
  )
  into v_payments;

  select
    pg_catalog.count(*) filter (
      where event.from_status = 'trialing'
        and event.to_status = 'active'
    ),
    pg_catalog.count(*) filter (
      where event.from_status = 'trialing'
        and event.to_status is distinct from 'trialing'
    )
  into v_converted, v_decided
  from public.subscription_events as event
  where event.created_at >= p_from
    and event.created_at <= p_to;

  if coalesce(v_decided, 0) = 0 then
    v_trial_rate := null;
  else
    v_trial_rate :=
      (coalesce(v_converted, 0)::numeric / v_decided::numeric) * 100;
  end if;

  select pg_catalog.jsonb_build_object(
    'conversion_rate', v_trial_rate,
    'sample_size', coalesce(v_decided, 0)
  )
  into v_trials;

  return pg_catalog.jsonb_build_object(
    'customers', v_customers,
    'payments', v_payments,
    'trials', v_trials
  );
end;
$$;

create function public.supervisor_revenue_series(
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'month'
)
returns table (
  bucket_start date,
  currency_code text,
  approved_amount_minor bigint,
  approved_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_bucket, 'month')));
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_time_range' using errcode = '22023';
  end if;

  if v_bucket not in ('day', 'week', 'month') then
    raise exception 'invalid_bucket' using errcode = '22023';
  end if;

  return query
  select
    (pg_catalog.date_trunc(v_bucket, payment.reviewed_at))::date
      as bucket_start,
    payment.currency_code,
    pg_catalog.sum(payment.amount_minor)::bigint as approved_amount_minor,
    pg_catalog.count(*)::bigint as approved_count
  from public.payment_requests as payment
  where payment.status = 'approved'
    and payment.reviewed_at is not null
    and payment.reviewed_at >= p_from
    and payment.reviewed_at <= p_to
  group by
    pg_catalog.date_trunc(v_bucket, payment.reviewed_at),
    payment.currency_code
  order by
    bucket_start,
    payment.currency_code;
end;
$$;

create function public.supervisor_plan_mix()
returns table (
  plan_id uuid,
  plan_name text,
  active_subscriptions bigint,
  trialing_subscriptions bigint,
  frozen_subscriptions bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    plan.id as plan_id,
    plan.name as plan_name,
    pg_catalog.count(subscription.id) filter (
      where subscription.status = 'active'
    )::bigint as active_subscriptions,
    pg_catalog.count(subscription.id) filter (
      where subscription.status = 'trialing'
    )::bigint as trialing_subscriptions,
    pg_catalog.count(subscription.id) filter (
      where subscription.status = 'frozen'
    )::bigint as frozen_subscriptions
  from public.subscription_plans as plan
  left join public.workspace_subscriptions as subscription
    on subscription.plan_id = plan.id
  group by plan.id, plan.name
  order by plan.name, plan.id;
end;
$$;

create function public.supervisor_action_queue(
  p_limit integer default 50
)
returns table (
  item_id text,
  item_type text,
  severity text,
  workspace_id uuid,
  customer_name text,
  title text,
  description text,
  due_at timestamptz,
  action_href text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with customer as (
    select
      workspace.id as workspace_id,
      profile.display_name as customer_name,
      profile.account_status,
      subscription.status as subscription_status,
      subscription.grace_ends_at,
      subscription.trial_ends_at,
      subscription.current_period_ends_at,
      subscription.expired_at,
      coalesce(
        subscription.current_period_ends_at,
        subscription.trial_ends_at
      ) as period_ends_at
    from public.profiles as profile
    join public.workspace_members as membership
      on membership.user_id = profile.id
     and membership.role = 'owner'
     and membership.status = 'active'
    join public.workspaces as workspace
      on workspace.id = membership.workspace_id
    left join public.workspace_subscriptions as subscription
      on subscription.workspace_id = workspace.id
    where profile.system_role = 'user'
  ),
  queue as (
    select
      'grace:' || customer.workspace_id::text as item_id,
      'subscription_grace'::text as item_type,
      'critical'::text as severity,
      customer.workspace_id,
      customer.customer_name,
      'اشتراك في المهلة'::text as title,
      'مساحة العمل في حالة مهلة وتتطلب قرارًا.'::text as description,
      customer.grace_ends_at as due_at,
      '/supervisor/customers/' || customer.workspace_id::text as action_href,
      1 as sort_rank
    from customer
    where customer.subscription_status = 'grace'

    union all

    select
      'expired_pending:' || payment.id::text,
      'expired_pending_payment',
      'critical',
      customer.workspace_id,
      customer.customer_name,
      'دفع معلّق بعد انتهاء الاشتراك',
      'يوجد طلب دفع معلّق لاشتراك منتهٍ.',
      payment.created_at,
      '/supervisor/payments',
      2
    from customer
    join public.payment_requests as payment
      on payment.workspace_id = customer.workspace_id
     and payment.status = 'pending'
    where customer.subscription_status = 'expired'

    union all

    select
      'expiring_3d:' || customer.workspace_id::text,
      'subscription_expiring',
      'warning',
      customer.workspace_id,
      customer.customer_name,
      'ينتهي خلال 3 أيام',
      'فترة الاشتراك تنتهي خلال ثلاثة أيام.',
      customer.period_ends_at,
      '/supervisor/customers/' || customer.workspace_id::text,
      3
    from customer
    where customer.subscription_status in ('active', 'trialing')
      and customer.period_ends_at is not null
      and customer.period_ends_at > pg_catalog.clock_timestamp()
      and customer.period_ends_at
        <= pg_catalog.clock_timestamp() + interval '3 days'

    union all

    select
      'pending_payment:' || payment.id::text,
      'pending_payment',
      'warning',
      customer.workspace_id,
      customer.customer_name,
      'طلب دفع معلّق',
      'طلب دفع بانتظار مراجعة المدير.',
      payment.created_at,
      '/supervisor/payments',
      4
    from customer
    join public.payment_requests as payment
      on payment.workspace_id = customer.workspace_id
     and payment.status = 'pending'
    where customer.subscription_status is distinct from 'expired'

    union all

    select
      'suspended:' || customer.workspace_id::text,
      'suspended_account',
      'info',
      customer.workspace_id,
      customer.customer_name,
      'حساب معلّق',
      'حساب العميل معلّق ويتطلب متابعة.',
      null::timestamptz,
      '/supervisor/customers/' || customer.workspace_id::text,
      5
    from customer
    where customer.account_status = 'suspended'
  )
  select
    queue.item_id,
    queue.item_type,
    queue.severity,
    queue.workspace_id,
    queue.customer_name,
    queue.title,
    queue.description,
    queue.due_at,
    queue.action_href
  from queue
  order by
    queue.sort_rank,
    queue.due_at nulls last,
    queue.item_id
  limit v_limit;
end;
$$;

create function public.supervisor_send_notification_campaign(
  p_segment text,
  p_title text,
  p_body text,
  p_note text,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid := auth.uid();
  v_segment text := nullif(pg_catalog.btrim(p_segment), '');
  v_title text := nullif(pg_catalog.btrim(p_title), '');
  v_body text := nullif(pg_catalog.btrim(p_body), '');
  v_note text := nullif(pg_catalog.btrim(p_note), '');
  v_payload jsonb;
  v_replay jsonb;
  v_campaign_id uuid;
  v_recipient_count integer;
  v_result jsonb;
begin
  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'segment', v_segment,
    'title', v_title,
    'body', v_body,
    'note', v_note,
    'client_id', p_client_id
  );

  perform private.cleanup_supervisor_control_plane();

  v_replay := private.begin_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_send_notification_campaign',
    v_payload
  );

  if v_replay is not null then
    if pg_catalog.jsonb_typeof(v_replay) is distinct from 'object'
       or not (v_replay ? 'campaign_id')
    then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;
    return v_replay;
  end if;

  if v_note is null
     or pg_catalog.char_length(v_note) not between 3 and 500
     or v_note ~ '[[:cntrl:]]'
  then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  if v_segment is null
     or v_segment not in (
       'all_active',
       'trialing',
       'expiring_7d',
       'grace',
       'frozen'
     )
  then
    raise exception 'invalid_campaign_segment' using errcode = '22023';
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

  select pg_catalog.count(*)::integer
    into v_recipient_count
    from private.campaign_segment_recipients(v_segment) as recipient;

  if v_recipient_count > 10000 then
    raise exception 'campaign_recipient_limit_exceeded'
      using errcode = '22023';
  end if;

  insert into private.notification_campaigns (
    actor_user_id,
    segment,
    title,
    body,
    recipient_count
  )
  values (
    v_supervisor_id,
    v_segment,
    v_title,
    v_body,
    v_recipient_count
  )
  returning id into v_campaign_id;

  insert into public.notifications (
    user_id,
    workspace_id,
    kind,
    title,
    body,
    metadata
  )
  select
    recipient.user_id,
    recipient.workspace_id,
    'system'::public.notification_kind,
    v_title,
    v_body,
    pg_catalog.jsonb_build_object(
      'campaign_id', v_campaign_id,
      'segment', v_segment,
      'actor_user_id', v_supervisor_id,
      'client_id', p_client_id
    )
  from private.campaign_segment_recipients(v_segment) as recipient;

  perform private.write_audit(
    null,
    v_supervisor_id,
    'supervisor_send_notification_campaign',
    'notification_campaigns',
    v_campaign_id,
    pg_catalog.jsonb_build_object(
      'client_id', p_client_id,
      'note', v_note,
      'segment', v_segment,
      'recipient_count', v_recipient_count,
      'title', v_title
    )
  );

  v_result := pg_catalog.jsonb_build_object(
    'campaign_id', v_campaign_id,
    'segment', v_segment,
    'title', v_title,
    'body', v_body,
    'recipient_count', v_recipient_count
  );

  perform private.finish_supervisor_operation(
    v_supervisor_id,
    p_client_id,
    'supervisor_send_notification_campaign',
    v_result
  );

  perform private.cleanup_supervisor_control_plane();
  return v_result;
end;
$$;

create function public.supervisor_list_notification_campaigns(
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  segment text,
  title text,
  body text,
  recipient_count integer,
  read_count integer,
  actor_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    campaign.id,
    campaign.segment,
    campaign.title,
    campaign.body,
    campaign.recipient_count,
    (
      select pg_catalog.count(*)::integer
        from public.notifications as notification
       where notification.metadata ->> 'campaign_id' = campaign.id::text
         and notification.read_at is not null
    ) as read_count,
    actor.display_name as actor_name,
    campaign.created_at
  from private.notification_campaigns as campaign
  join public.profiles as actor
    on actor.id = campaign.actor_user_id
  order by campaign.created_at desc, campaign.id desc
  limit v_limit
  offset v_offset;
end;
$$;

create function public.supervisor_list_customer_notifications(
  p_user_id uuid,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
      from public.profiles as profile
     where profile.id = p_user_id
       and profile.system_role = 'user'
  ) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  select pg_catalog.count(*)::integer
    into v_total
    from public.notifications as notification
   where notification.user_id = p_user_id;

  select coalesce(
    (
      select pg_catalog.jsonb_agg(row_json.payload order by row_json.ord)
        from (
          select
            pg_catalog.jsonb_build_object(
              'id', notification.id,
              'workspace_id', notification.workspace_id,
              'kind', notification.kind,
              'title', notification.title,
              'body', notification.body,
              'metadata', notification.metadata,
              'read_at', notification.read_at,
              'created_at', notification.created_at
            ) as payload,
            pg_catalog.row_number() over (
              order by notification.created_at desc, notification.id desc
            ) as ord
          from public.notifications as notification
          where notification.user_id = p_user_id
          order by notification.created_at desc, notification.id desc
          limit v_limit
          offset v_offset
        ) as row_json
    ),
    '[]'::jsonb
  )
  into v_rows;

  return pg_catalog.jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );
end;
$$;

create function public.supervisor_customer_financial_snapshot(
  p_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_rows jsonb;
begin
  perform private.assert_supervisor_financial_read(
    p_workspace_id,
    'financial_snapshot'
  );

  with wallet_by_currency as (
    select
      balance.currency_code,
      coalesce(sum(balance.balance_minor::numeric), 0) as wallet_balance_minor
    from public.wallet_balances as balance
    where balance.workspace_id = p_workspace_id
    group by balance.currency_code
  ),
  project_by_currency as (
    select
      totals.currency_code,
      coalesce(sum(totals.income_minor::numeric), 0) as project_income_minor,
      coalesce(sum(totals.expense_minor::numeric), 0) as project_expense_minor,
      coalesce(sum(totals.net_minor::numeric), 0) as project_net_minor
    from public.project_totals as totals
    where totals.workspace_id = p_workspace_id
    group by totals.currency_code
  ),
  worker_by_currency as (
    select
      log.currency_code,
      coalesce(sum(log.amount_minor::numeric), 0) as worker_balance_minor
    from public.project_work_logs as log
    where log.workspace_id = p_workspace_id
    group by log.currency_code
  ),
  currencies as (
    select currency_code from wallet_by_currency
    union
    select currency_code from project_by_currency
    union
    select currency_code from worker_by_currency
  )
  select coalesce(
    (
      select pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'currency_code', currency.currency_code,
                 'wallet_balance_minor',
                   coalesce(wallet.wallet_balance_minor, 0)::text,
                 'project_income_minor',
                   coalesce(project.project_income_minor, 0)::text,
                 'project_expense_minor',
                   coalesce(project.project_expense_minor, 0)::text,
                 'project_net_minor',
                   coalesce(project.project_net_minor, 0)::text,
                 'worker_balance_minor',
                   coalesce(worker.worker_balance_minor, 0)::text
               )
               order by currency.currency_code
             )
        from currencies as currency
        left join wallet_by_currency as wallet
          on wallet.currency_code = currency.currency_code
        left join project_by_currency as project
          on project.currency_code = currency.currency_code
        left join worker_by_currency as worker
          on worker.currency_code = currency.currency_code
    ),
    '[]'::jsonb
  )
  into v_rows;

  return pg_catalog.jsonb_build_object(
    'workspace_id', p_workspace_id,
    'currencies', v_rows
  );
end;
$$;

create function public.supervisor_customer_wallets(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
begin
  perform private.assert_supervisor_financial_read(
    p_workspace_id,
    'wallets'
  );

  select pg_catalog.count(*)::integer
    into v_total
    from public.wallet_balances as balance
   where balance.workspace_id = p_workspace_id;

  select coalesce(
    (
      select pg_catalog.jsonb_agg(row_json.payload order by row_json.ord)
        from (
          select
            pg_catalog.jsonb_build_object(
              'id', balance.id,
              'name', balance.name,
              'currency_code', balance.currency_code,
              'status', balance.status,
              'balance_minor', balance.balance_minor,
              'created_at', balance.created_at,
              'updated_at', balance.updated_at
            ) as payload,
            pg_catalog.row_number() over (
              order by balance.created_at desc, balance.id desc
            ) as ord
          from public.wallet_balances as balance
          where balance.workspace_id = p_workspace_id
          order by balance.created_at desc, balance.id desc
          limit v_limit
          offset v_offset
        ) as row_json
    ),
    '[]'::jsonb
  )
  into v_rows;

  return pg_catalog.jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );
end;
$$;

create function public.supervisor_customer_transactions(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
begin
  perform private.assert_supervisor_financial_read(
    p_workspace_id,
    'transactions'
  );

  select pg_catalog.count(*)::integer
    into v_total
    from public.visible_financial_events as event
   where event.workspace_id = p_workspace_id;

  select coalesce(
    (
      select pg_catalog.jsonb_agg(row_json.payload order by row_json.ord)
        from (
          select
            pg_catalog.jsonb_build_object(
              'id', event.id,
              'event_type', event.event_type,
              'currency_code', event.currency_code,
              'occurred_at', event.occurred_at,
              'description', event.description,
              'category_id', event.category_id,
              'project_id', event.project_id,
              'reversal_of_event_id', event.reversal_of_event_id,
              'created_by', event.created_by,
              'source_wallet_id', event.source_wallet_id,
              'destination_wallet_id', event.destination_wallet_id,
              'amount_minor', event.amount_minor,
              'created_at', event.created_at
            ) as payload,
            pg_catalog.row_number() over (
              order by event.occurred_at desc, event.id desc
            ) as ord
          from public.visible_financial_events as event
          where event.workspace_id = p_workspace_id
          order by event.occurred_at desc, event.id desc
          limit v_limit
          offset v_offset
        ) as row_json
    ),
    '[]'::jsonb
  )
  into v_rows;

  return pg_catalog.jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );
end;
$$;

create function public.supervisor_customer_projects(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
begin
  perform private.assert_supervisor_financial_read(
    p_workspace_id,
    'projects'
  );

  select pg_catalog.count(*)::integer
    into v_total
    from public.projects as project
   where project.workspace_id = p_workspace_id;

  select coalesce(
    (
      select pg_catalog.jsonb_agg(row_json.payload order by row_json.ord)
        from (
          select
            pg_catalog.jsonb_build_object(
              'id', project.id,
              'name', project.name,
              'status', project.status,
              'created_at', project.created_at,
              'updated_at', project.updated_at,
              'totals',
                coalesce(
                  (
                    select pg_catalog.jsonb_agg(
                             pg_catalog.jsonb_build_object(
                               'currency_code', totals.currency_code,
                               'income_minor', totals.income_minor,
                               'expense_minor', totals.expense_minor,
                               'net_minor', totals.net_minor
                             )
                             order by totals.currency_code
                           )
                      from public.project_totals as totals
                     where totals.workspace_id = project.workspace_id
                       and totals.project_id = project.id
                  ),
                  '[]'::jsonb
                )
            ) as payload,
            pg_catalog.row_number() over (
              order by project.created_at desc, project.id desc
            ) as ord
          from public.projects as project
          where project.workspace_id = p_workspace_id
          order by project.created_at desc, project.id desc
          limit v_limit
          offset v_offset
        ) as row_json
    ),
    '[]'::jsonb
  )
  into v_rows;

  return pg_catalog.jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );
end;
$$;

create function public.supervisor_customer_workers(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
begin
  perform private.assert_supervisor_financial_read(
    p_workspace_id,
    'workers'
  );

  select pg_catalog.count(*)::integer
    into v_total
    from public.project_worker_balances as balance
   where balance.workspace_id = p_workspace_id;

  select coalesce(
    (
      select pg_catalog.jsonb_agg(row_json.payload order by row_json.ord)
        from (
          select
            pg_catalog.jsonb_build_object(
              'worker_id', balance.worker_id,
              'project_id', balance.project_id,
              'name', balance.name,
              'phone', balance.phone,
              'daily_wage_minor', balance.daily_wage_minor,
              'status', balance.status,
              'balance_minor', balance.balance_minor,
              'earned_minor', balance.earned_minor,
              'withdrawn_minor', balance.withdrawn_minor,
              'deducted_minor', balance.deducted_minor,
              'work_days', balance.work_days
            ) as payload,
            pg_catalog.row_number() over (
              order by balance.name, balance.worker_id
            ) as ord
          from public.project_worker_balances as balance
          where balance.workspace_id = p_workspace_id
          order by balance.name, balance.worker_id
          limit v_limit
          offset v_offset
        ) as row_json
    ),
    '[]'::jsonb
  )
  into v_rows;

  return pg_catalog.jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );
end;
$$;

create function public.supervisor_list_audit_events(
  p_query text,
  p_action_prefix text,
  p_workspace_id uuid,
  p_actor_user_id uuid,
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
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_query text := nullif(pg_catalog.btrim(p_query), '');
  v_action_prefix text := nullif(pg_catalog.btrim(p_action_prefix), '');
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'invalid_time_range' using errcode = '22023';
  end if;

  with filtered as (
    select
      event.id,
      event.workspace_id,
      event.actor_user_id,
      event.action,
      event.target_table,
      event.target_id,
      private.sanitize_supervisor_audit_metadata(event.metadata) as metadata,
      event.created_at,
      actor.display_name as actor_name,
      customer.display_name as customer_name,
      workspace.name as workspace_name
    from audit.events as event
    left join public.profiles as actor
      on actor.id = event.actor_user_id
    left join public.workspaces as workspace
      on workspace.id = event.workspace_id
    left join public.profiles as customer
      on customer.id = workspace.created_by
    where (p_workspace_id is null or event.workspace_id = p_workspace_id)
      and (p_actor_user_id is null or event.actor_user_id = p_actor_user_id)
      and (p_from is null or event.created_at >= p_from)
      and (p_to is null or event.created_at <= p_to)
      and (
        v_action_prefix is null
        or event.action like v_action_prefix || '%'
      )
      and (
        v_query is null
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(event.action, '')),
          pg_catalog.lower(v_query)
        ) > 0
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(actor.display_name, '')),
          pg_catalog.lower(v_query)
        ) > 0
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(customer.display_name, '')),
          pg_catalog.lower(v_query)
        ) > 0
        or pg_catalog.strpos(
          pg_catalog.lower(coalesce(workspace.name, '')),
          pg_catalog.lower(v_query)
        ) > 0
      )
  )
  select
    (select pg_catalog.count(*)::integer from filtered),
    coalesce(
      (
        select pg_catalog.jsonb_agg(row_json.payload order by row_json.ord)
          from (
            select
              pg_catalog.jsonb_build_object(
                'id', filtered.id,
                'workspace_id', filtered.workspace_id,
                'workspace_name', filtered.workspace_name,
                'customer_name', filtered.customer_name,
                'actor_user_id', filtered.actor_user_id,
                'actor_name', filtered.actor_name,
                'action', filtered.action,
                'target_table', filtered.target_table,
                'target_id', filtered.target_id,
                'metadata', filtered.metadata,
                'created_at', filtered.created_at
              ) as payload,
              pg_catalog.row_number() over (
                order by filtered.created_at desc, filtered.id desc
              ) as ord
            from filtered
            order by filtered.created_at desc, filtered.id desc
            limit v_limit
            offset v_offset
          ) as row_json
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

create function public.supervisor_customer_control_ledger(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null or not private.is_supervisor() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_workspace_id is null
     or not exists (
       select 1
         from public.workspaces as workspace
        where workspace.id = p_workspace_id
     )
  then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  with ledger as (
    select
      'audit:' || event.id::text as entry_id,
      'audit'::text as entry_type,
      event.action as title,
      event.created_at as occurred_at,
      event.actor_user_id,
      actor.display_name as actor_name,
      private.sanitize_supervisor_audit_metadata(event.metadata) as metadata
    from audit.events as event
    left join public.profiles as actor
      on actor.id = event.actor_user_id
    where event.workspace_id = p_workspace_id

    union all

    select
      'subscription:' || sub_event.id::text,
      'subscription_event',
      sub_event.event_type,
      sub_event.created_at,
      sub_event.actor_user_id,
      actor.display_name,
      pg_catalog.jsonb_build_object(
        'from_status', sub_event.from_status,
        'to_status', sub_event.to_status,
        'payment_request_id', sub_event.payment_request_id,
        'metadata', sub_event.metadata
      )
    from public.subscription_events as sub_event
    left join public.profiles as actor
      on actor.id = sub_event.actor_user_id
    where sub_event.workspace_id = p_workspace_id

    union all

    select
      'payment_review:' || payment.id::text,
      'payment_review',
      'payment_' || payment.status::text,
      payment.reviewed_at,
      payment.reviewed_by,
      actor.display_name,
      pg_catalog.jsonb_build_object(
        'payment_request_id', payment.id,
        'amount_minor', payment.amount_minor,
        'currency_code', payment.currency_code,
        'status', payment.status,
        'review_note', payment.review_note
      )
    from public.payment_requests as payment
    left join public.profiles as actor
      on actor.id = payment.reviewed_by
    where payment.workspace_id = p_workspace_id
      and payment.status in ('approved', 'rejected')
      and payment.reviewed_at is not null

    union all

    select
      'notification:' || notification.id::text,
      'notification',
      notification.title,
      notification.created_at,
      nullif(notification.metadata ->> 'actor_user_id', '')::uuid,
      actor.display_name,
      pg_catalog.jsonb_build_object(
        'notification_id', notification.id,
        'kind', notification.kind,
        'body', notification.body,
        'campaign_id', notification.metadata ->> 'campaign_id',
        'read_at', notification.read_at
      )
    from public.notifications as notification
    left join public.profiles as actor
      on actor.id = nullif(notification.metadata ->> 'actor_user_id', '')::uuid
    where notification.workspace_id = p_workspace_id
  )
  select
    (select pg_catalog.count(*)::integer from ledger),
    coalesce(
      (
        select pg_catalog.jsonb_agg(row_json.payload order by row_json.ord)
          from (
            select
              pg_catalog.jsonb_build_object(
                'entry_id', ledger.entry_id,
                'entry_type', ledger.entry_type,
                'title', ledger.title,
                'occurred_at', ledger.occurred_at,
                'actor_user_id', ledger.actor_user_id,
                'actor_name', ledger.actor_name,
                'metadata', ledger.metadata
              ) as payload,
              pg_catalog.row_number() over (
                order by ledger.occurred_at desc, ledger.entry_id desc
              ) as ord
            from ledger
            order by ledger.occurred_at desc, ledger.entry_id desc
            limit v_limit
            offset v_offset
          ) as row_json
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

-- Privileges: private helpers stay internal; public RPCs authenticated-only.
revoke all on function private.sanitize_supervisor_audit_metadata(jsonb)
  from public, anon, authenticated;
revoke all on function private.campaign_segment_recipients(text)
  from public, anon, authenticated;
revoke all on function private.assert_supervisor_financial_read(uuid, text)
  from public, anon, authenticated;

revoke all on function public.supervisor_operational_metrics(
  timestamptz,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.supervisor_revenue_series(
  timestamptz,
  timestamptz,
  text
) from public, anon, authenticated;
revoke all on function public.supervisor_plan_mix()
  from public, anon, authenticated;
revoke all on function public.supervisor_action_queue(integer)
  from public, anon, authenticated;
revoke all on function public.supervisor_send_notification_campaign(
  text,
  text,
  text,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.supervisor_list_notification_campaigns(
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.supervisor_list_customer_notifications(
  uuid,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.supervisor_customer_financial_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function public.supervisor_customer_wallets(
  uuid,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.supervisor_customer_transactions(
  uuid,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.supervisor_customer_projects(
  uuid,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.supervisor_customer_workers(
  uuid,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.supervisor_list_audit_events(
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.supervisor_customer_control_ledger(
  uuid,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.supervisor_operational_metrics(
  timestamptz,
  timestamptz
) to authenticated;
grant execute on function public.supervisor_revenue_series(
  timestamptz,
  timestamptz,
  text
) to authenticated;
grant execute on function public.supervisor_plan_mix() to authenticated;
grant execute on function public.supervisor_action_queue(integer)
  to authenticated;
grant execute on function public.supervisor_send_notification_campaign(
  text,
  text,
  text,
  text,
  uuid
) to authenticated;
grant execute on function public.supervisor_list_notification_campaigns(
  integer,
  integer
) to authenticated;
grant execute on function public.supervisor_list_customer_notifications(
  uuid,
  integer,
  integer
) to authenticated;
grant execute on function public.supervisor_customer_financial_snapshot(uuid)
  to authenticated;
grant execute on function public.supervisor_customer_wallets(
  uuid,
  integer,
  integer
) to authenticated;
grant execute on function public.supervisor_customer_transactions(
  uuid,
  integer,
  integer
) to authenticated;
grant execute on function public.supervisor_customer_projects(
  uuid,
  integer,
  integer
) to authenticated;
grant execute on function public.supervisor_customer_workers(
  uuid,
  integer,
  integer
) to authenticated;
grant execute on function public.supervisor_list_audit_events(
  text,
  text,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  integer,
  integer
) to authenticated;
grant execute on function public.supervisor_customer_control_ledger(
  uuid,
  integer,
  integer
) to authenticated;
