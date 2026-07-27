-- Durable dismiss/snooze for operational alerts so delete/read does not
-- immediately recreate the same dedupe_key on the next refresh.

create table if not exists public.notification_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  dedupe_key text not null,
  dismissed_until timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, workspace_id, dedupe_key)
);

create index if not exists notification_dismissals_active_idx
  on public.notification_dismissals (user_id, workspace_id, dismissed_until);

alter table public.notification_dismissals enable row level security;

drop policy if exists notification_dismissals_select_own on public.notification_dismissals;
create policy notification_dismissals_select_own
  on public.notification_dismissals
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notification_dismissals_upsert_own on public.notification_dismissals;
create policy notification_dismissals_upsert_own
  on public.notification_dismissals
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.notification_dismissals is
  'User snooze of operational alert keys; blocks refresh_operational_notifications re-insert.';

create or replace function private.operational_alert_suppressed(
  p_user_id uuid,
  p_workspace_id uuid,
  p_dedupe_key text,
  p_window interval
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    exists (
      select 1
      from public.notifications as notification
      where notification.user_id = p_user_id
        and notification.workspace_id = p_workspace_id
        and notification.kind = 'operational'
        and notification.metadata ->> 'dedupe_key' = p_dedupe_key
        and notification.created_at > clock_timestamp() - p_window
    )
    or exists (
      select 1
      from public.notification_dismissals as dismissal
      where dismissal.user_id = p_user_id
        and dismissal.workspace_id = p_workspace_id
        and dismissal.dedupe_key = p_dedupe_key
        and dismissal.dismissed_until > clock_timestamp()
    );
$$;

create or replace function public.dismiss_operational_notification(
  p_notification_id uuid,
  p_snooze_hours integer default 72
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.notifications%rowtype;
  v_key text;
  v_hours integer := greatest(coalesce(p_snooze_hours, 72), 1);
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_row
  from public.notifications as notification
  where notification.id = p_notification_id
    and notification.user_id = v_user_id
  for update;

  if not found then
    return;
  end if;

  v_key := nullif(v_row.metadata ->> 'dedupe_key', '');

  if v_row.kind = 'operational'
     and v_row.workspace_id is not null
     and v_key is not null then
    insert into public.notification_dismissals as dismissal (
      user_id,
      workspace_id,
      dedupe_key,
      dismissed_until
    ) values (
      v_user_id,
      v_row.workspace_id,
      v_key,
      clock_timestamp() + make_interval(hours => v_hours)
    )
    on conflict (user_id, workspace_id, dedupe_key)
    do update set
      dismissed_until = greatest(
        dismissal.dismissed_until,
        excluded.dismissed_until
      ),
      updated_at = clock_timestamp();
  end if;

  delete from public.notifications
  where id = p_notification_id
    and user_id = v_user_id;
end;
$$;

create or replace function public.dismiss_all_own_notifications(
  p_snooze_hours integer default 72
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_hours integer := greatest(coalesce(p_snooze_hours, 72), 1);
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.notification_dismissals as dismissal (
    user_id,
    workspace_id,
    dedupe_key,
    dismissed_until
  )
  select
    v_user_id,
    notification.workspace_id,
    notification.metadata ->> 'dedupe_key',
    clock_timestamp() + make_interval(hours => v_hours)
  from public.notifications as notification
  where notification.user_id = v_user_id
    and notification.kind = 'operational'
    and notification.workspace_id is not null
    and nullif(notification.metadata ->> 'dedupe_key', '') is not null
  on conflict (user_id, workspace_id, dedupe_key)
  do update set
    dismissed_until = greatest(
      dismissal.dismissed_until,
      excluded.dismissed_until
    ),
    updated_at = clock_timestamp();

  delete from public.notifications
  where user_id = v_user_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

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
  v_overdue_invoices integer;
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

  perform public.refresh_overdue_invoices(p_workspace_id);

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
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not private.operational_alert_suppressed(
        v_member.user_id, p_workspace_id, v_key, interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'low_wallet', 'wallet_id', v_low_wallet.id)
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

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
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not private.operational_alert_suppressed(
        v_member.user_id, p_workspace_id, v_key, interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'uncovered_labor')
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  select count(*)::integer into v_overdue_count
  from public.debt_balances as debt
  where debt.workspace_id = p_workspace_id
    and debt.status in ('open', 'partial')
    and debt.due_on is not null
    and debt.due_on < (timezone('utc', now()))::date
    and debt.balance_minor::bigint > 0;

  if coalesce(v_overdue_count, 0) > 0 then
    v_key := 'overdue_debts';
    v_title := 'ديون متأخرة';
    v_body := format('لديك %s دينًا متأخرًا. راجع تبويب الديون.', v_overdue_count::text);
    for v_member in
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not private.operational_alert_suppressed(
        v_member.user_id, p_workspace_id, v_key, interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'overdue_debts')
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  select count(*)::integer into v_overdue_invoices
  from public.invoices as invoice
  where invoice.workspace_id = p_workspace_id
    and invoice.status = 'overdue';

  if coalesce(v_overdue_invoices, 0) > 0 then
    v_key := 'overdue_invoices';
    v_title := 'فواتير متأخرة';
    v_body := format(
      'لديك %s فاتورة متأخرة عن الاستحقاق. راجع التحصيل.',
      v_overdue_invoices::text
    );
    for v_member in
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not private.operational_alert_suppressed(
        v_member.user_id, p_workspace_id, v_key, interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'overdue_invoices')
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  for v_inactive in
    select project.id, project.name
    from public.projects as project
    where project.workspace_id = p_workspace_id
      and project.status = 'active'
      and not exists (
        select 1 from public.financial_events as event
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
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not private.operational_alert_suppressed(
        v_member.user_id, p_workspace_id, v_key, interval '7 days'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object(
            'dedupe_key', v_key, 'alert', 'inactive_project', 'project_id', v_inactive.id
          )
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

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
        select user_id from public.workspace_members
        where workspace_id = p_workspace_id
          and role in ('owner', 'admin')
      loop
        if not private.operational_alert_suppressed(
          v_member.user_id, p_workspace_id, v_key, interval '3 days'
        ) then
          insert into public.notifications (
            user_id, workspace_id, kind, title, body, metadata
          ) values (
            v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
            jsonb_build_object('dedupe_key', v_key, 'alert', 'subscription_nearing_end')
          );
          v_inserted := v_inserted + 1;
        end if;
      end loop;
    end if;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.dismiss_operational_notification(uuid, integer) from public;
revoke all on function public.dismiss_all_own_notifications(integer) from public;
revoke all on function public.refresh_operational_notifications(uuid) from public;

grant execute on function public.dismiss_operational_notification(uuid, integer) to authenticated;
grant execute on function public.dismiss_all_own_notifications(integer) to authenticated;
grant execute on function public.refresh_operational_notifications(uuid) to authenticated;
