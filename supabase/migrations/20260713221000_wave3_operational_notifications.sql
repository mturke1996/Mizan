-- Wave 3: operational notifications refresh RPC.
-- Inserts workspace-scoped alerts for low wallet balance, uncovered labor,
-- overdue debts, inactive projects, and nearing subscription end.

alter type public.notification_kind
  add value if not exists 'operational';

create or replace function public.refresh_operational_notifications(
  p_workspace_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
  v_member record;
  v_title text;
  v_body text;
  v_key text;
  v_low_wallet record;
  v_uncovered bigint;
  v_overdue_count integer;
  v_inactive record;
  v_subscription record;
  v_days_left numeric;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  -- Low wallet balance: wallets under 100 major units (scale-aware via currencies).
  for v_low_wallet in
    select
      wallet.id,
      wallet.name,
      wallet.currency_code,
      private.wallet_balance(p_workspace_id, wallet.id) as balance_minor,
      currency.minor_unit
    from public.wallets as wallet
    join public.currencies as currency
      on currency.code = wallet.currency_code
    where wallet.workspace_id = p_workspace_id
      and wallet.status = 'active'
      and private.wallet_balance(p_workspace_id, wallet.id)
        < (100::numeric * power(10::numeric, currency.minor_unit))
  loop
    v_key := 'low_wallet:' || v_low_wallet.id::text;
    v_title := 'رصيد محفظة منخفض';
    v_body := format(
      'المحفظة «%s» رصيدها منخفض (%s). راجع التدفقات القادمة.',
      v_low_wallet.name,
      v_low_wallet.balance_minor::text
    );
    for v_member in
      select user_id
      from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not exists (
        select 1
        from public.notifications as notification
        where notification.user_id = v_member.user_id
          and notification.workspace_id = p_workspace_id
          and notification.kind = 'operational'
          and notification.read_at is null
          and notification.metadata ->> 'dedupe_key' = v_key
          and notification.created_at > clock_timestamp() - interval '24 hours'
      ) then
        insert into public.notifications (
          user_id,
          workspace_id,
          kind,
          title,
          body,
          metadata
        ) values (
          v_member.user_id,
          p_workspace_id,
          'operational',
          v_title,
          v_body,
          jsonb_build_object(
            'dedupe_key', v_key,
            'alert', 'low_wallet',
            'wallet_id', v_low_wallet.id
          )
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

  -- Uncovered labor across active projects with workers module.
  select coalesce(sum(greatest(detail.balance_minor::numeric, 0)), 0)::bigint
  into v_uncovered
  from public.project_worker_balance_details as detail
  join public.projects as project
    on project.id = detail.project_id
   and project.workspace_id = detail.workspace_id
  where detail.workspace_id = p_workspace_id
    and project.status = 'active'
    and coalesce((project.modules ->> 'workers')::boolean, false);

  if v_uncovered > 0 then
    v_key := 'uncovered_labor';
    v_title := 'مستحقات عمال غير مغطاة';
    v_body := format(
      'يوجد مستحقات عمال مفتوحة بمقدار %s. راجع تبويب العمال قبل الدفع.',
      v_uncovered::text
    );
    for v_member in
      select user_id
      from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not exists (
        select 1
        from public.notifications as notification
        where notification.user_id = v_member.user_id
          and notification.workspace_id = p_workspace_id
          and notification.kind = 'operational'
          and notification.read_at is null
          and notification.metadata ->> 'dedupe_key' = v_key
          and notification.created_at > clock_timestamp() - interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id,
          p_workspace_id,
          'operational',
          v_title,
          v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'uncovered_labor')
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  -- Overdue debts (open/partial past due_on).
  select count(*)::integer
  into v_overdue_count
  from public.debt_balances as debt
  where debt.workspace_id = p_workspace_id
    and debt.status in ('open', 'partial')
    and debt.due_on is not null
    and debt.due_on < (timezone('utc', now()))::date
    and debt.balance_minor::bigint <> 0;

  if v_overdue_count > 0 then
    v_key := 'overdue_debts';
    v_title := 'ديون متأخرة';
    v_body := format(
      'لديك %s دينًا تجاوز تاريخ الاستحقاق. افتح قسم الديون للمتابعة.',
      v_overdue_count
    );
    for v_member in
      select user_id
      from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not exists (
        select 1
        from public.notifications as notification
        where notification.user_id = v_member.user_id
          and notification.workspace_id = p_workspace_id
          and notification.kind = 'operational'
          and notification.read_at is null
          and notification.metadata ->> 'dedupe_key' = v_key
          and notification.created_at > clock_timestamp() - interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id,
          p_workspace_id,
          'operational',
          v_title,
          v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'overdue_debts')
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  -- Inactive projects: no financial events in 14 days.
  for v_inactive in
    select project.id, project.name
    from public.projects as project
    where project.workspace_id = p_workspace_id
      and project.status = 'active'
      and not exists (
        select 1
        from public.financial_events as event
        where event.workspace_id = project.workspace_id
          and event.project_id = project.id
          and event.occurred_at > clock_timestamp() - interval '14 days'
      )
  loop
    v_key := 'inactive_project:' || v_inactive.id::text;
    v_title := 'مشروع بلا نشاط';
    v_body := format(
      'المشروع «%s» بلا حركات منذ أسبوعين. سجّل نشاطًا أو راجع حالته.',
      v_inactive.name
    );
    for v_member in
      select user_id
      from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not exists (
        select 1
        from public.notifications as notification
        where notification.user_id = v_member.user_id
          and notification.workspace_id = p_workspace_id
          and notification.kind = 'operational'
          and notification.read_at is null
          and notification.metadata ->> 'dedupe_key' = v_key
          and notification.created_at > clock_timestamp() - interval '7 days'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id,
          p_workspace_id,
          'operational',
          v_title,
          v_body,
          jsonb_build_object(
            'dedupe_key', v_key,
            'alert', 'inactive_project',
            'project_id', v_inactive.id
          )
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

  -- Subscription nearing end (within 7 days).
  select
    subscription.status,
    subscription.current_period_ends_at,
    subscription.trial_ends_at,
    subscription.grace_ends_at
  into v_subscription
  from public.workspace_subscriptions as subscription
  where subscription.workspace_id = p_workspace_id;

  if found then
    v_days_left := null;
    if v_subscription.current_period_ends_at is not null then
      v_days_left := extract(
        epoch from (v_subscription.current_period_ends_at - clock_timestamp())
      ) / 86400.0;
    elsif v_subscription.trial_ends_at is not null then
      v_days_left := extract(
        epoch from (v_subscription.trial_ends_at - clock_timestamp())
      ) / 86400.0;
    elsif v_subscription.grace_ends_at is not null then
      v_days_left := extract(
        epoch from (v_subscription.grace_ends_at - clock_timestamp())
      ) / 86400.0;
    end if;

    if v_days_left is not null and v_days_left >= 0 and v_days_left <= 7 then
      v_key := 'subscription_nearing_end';
      v_title := 'الاشتراك يقترب من الانتهاء';
      v_body := format(
        'يتبقى حوالي %s يومًا على نهاية فترة الاشتراك الحالية.',
        ceil(v_days_left)::text
      );
      for v_member in
        select user_id
        from public.workspace_members
        where workspace_id = p_workspace_id
          and role in ('owner', 'admin')
      loop
        if not exists (
          select 1
          from public.notifications as notification
          where notification.user_id = v_member.user_id
            and notification.workspace_id = p_workspace_id
            and notification.kind = 'operational'
            and notification.read_at is null
            and notification.metadata ->> 'dedupe_key' = v_key
            and notification.created_at > clock_timestamp() - interval '3 days'
        ) then
          insert into public.notifications (
            user_id, workspace_id, kind, title, body, metadata
          ) values (
            v_member.user_id,
            p_workspace_id,
            'operational',
            v_title,
            v_body,
            jsonb_build_object(
              'dedupe_key', v_key,
              'alert', 'subscription_nearing_end'
            )
          );
          v_inserted := v_inserted + 1;
        end if;
      end loop;
    end if;
  end if;

  return v_inserted;
end;
$$;

comment on function public.refresh_operational_notifications(uuid) is
  'Inserts deduped operational alerts for the workspace members.';

revoke all on function public.refresh_operational_notifications(uuid)
  from public, anon;
grant execute on function public.refresh_operational_notifications(uuid)
  to authenticated;
