-- Authorization helpers, idempotency state, RLS policies, and explicit API grants.

create type private.idempotency_operation as enum (
  'create_wallet',
  'post_transaction',
  'post_transfer',
  'reverse_financial_event',
  'create_payment_request'
);

create table private.idempotency_keys (
  workspace_id uuid not null references public.workspaces (id),
  client_id uuid not null,
  operation private.idempotency_operation not null,
  payload_hash bytea not null,
  result jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, client_id, operation),
  constraint idempotency_keys_sha256_length
    check (octet_length(payload_hash) = 32)
);

create index idempotency_keys_created_at_idx
  on private.idempotency_keys (created_at);

create function private.payload_hash(p_payload jsonb)
returns bytea
language sql
immutable
strict
set search_path = ''
as $$
  select extensions.digest(
    pg_catalog.convert_to(p_payload::text, 'UTF8'),
    'sha256'
  )
$$;

create function private.begin_idempotent_operation(
  p_workspace_id uuid,
  p_client_id uuid,
  p_operation private.idempotency_operation,
  p_payload_hash bytea
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_stored_hash bytea;
  v_result jsonb;
begin
  if p_client_id is null then
    raise exception using
      errcode = '22023',
      message = 'client_id is required';
  end if;

  insert into private.idempotency_keys (
    workspace_id,
    client_id,
    operation,
    payload_hash
  )
  values (
    p_workspace_id,
    p_client_id,
    p_operation,
    p_payload_hash
  )
  on conflict (workspace_id, client_id, operation) do nothing;

  select key.payload_hash, key.result
    into v_stored_hash, v_result
    from private.idempotency_keys as key
   where key.workspace_id = p_workspace_id
     and key.client_id = p_client_id
     and key.operation = p_operation
   for update;

  if v_stored_hash is distinct from p_payload_hash then
    raise exception using
      errcode = '22000',
      message = 'idempotency key was already used with a different payload';
  end if;

  return v_result;
end;
$$;

create function private.finish_idempotent_operation(
  p_workspace_id uuid,
  p_client_id uuid,
  p_operation private.idempotency_operation,
  p_result jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_result is null then
    raise exception using
      errcode = '22023',
      message = 'idempotency result cannot be null';
  end if;

  update private.idempotency_keys as key
     set result = p_result,
         updated_at = clock_timestamp()
   where key.workspace_id = p_workspace_id
     and key.client_id = p_client_id
     and key.operation = p_operation;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'idempotency key was not claimed';
  end if;
end;
$$;

create function private.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles as profile
     where profile.id = auth.uid()
       and profile.system_role = 'supervisor'
       and profile.account_status = 'active'
  )
$$;

create function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.workspace_members as member
      join public.profiles as profile
        on profile.id = member.user_id
     where member.workspace_id = p_workspace_id
       and member.user_id = auth.uid()
       and member.status = 'active'
       and profile.account_status = 'active'
  )
$$;

create function private.has_workspace_role(
  p_workspace_id uuid,
  p_roles public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.workspace_members as member
      join public.profiles as profile
        on profile.id = member.user_id
     where member.workspace_id = p_workspace_id
       and member.user_id = auth.uid()
       and member.status = 'active'
       and member.role = any(p_roles)
       and profile.account_status = 'active'
  )
$$;

create function private.has_current_entitlement(p_workspace_id uuid)
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
         and (
           (
             subscription.status = 'trialing'
             and subscription.trial_ends_at > statement_timestamp()
           )
           or
           (
             subscription.status = 'active'
             and subscription.current_period_ends_at > statement_timestamp()
           )
           or
           (
             subscription.status = 'grace'
             and subscription.grace_ends_at > statement_timestamp()
           )
         )
    )
$$;

create function private.can_write_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
        from public.workspaces as workspace
        join public.workspace_members as member
          on member.workspace_id = workspace.id
        join public.profiles as profile
          on profile.id = member.user_id
       where workspace.id = p_workspace_id
         and workspace.status = 'active'
         and member.user_id = auth.uid()
         and member.status = 'active'
         and member.role in ('owner', 'admin', 'member')
         and profile.account_status = 'active'
    )
    and private.has_current_entitlement(p_workspace_id)
$$;

create function private.ensure_system_accounts(
  p_workspace_id uuid,
  p_currency_code text,
  p_actor_user_id uuid
)
returns void
language sql
set search_path = ''
as $$
  insert into public.ledger_accounts (
    workspace_id,
    currency_code,
    account_type,
    system_key,
    name,
    created_by
  )
  values
    (
      p_workspace_id,
      p_currency_code,
      'income',
      'income',
      'Income',
      p_actor_user_id
    ),
    (
      p_workspace_id,
      p_currency_code,
      'expense',
      'expense',
      'Expense',
      p_actor_user_id
    ),
    (
      p_workspace_id,
      p_currency_code,
      'equity',
      'opening_equity',
      'Opening balance equity',
      p_actor_user_id
    )
  on conflict (workspace_id, currency_code, system_key)
    where system_key is not null
  do nothing
$$;

create function private.lock_wallets(
  p_workspace_id uuid,
  p_wallet_ids uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform wallet.id
    from public.wallets as wallet
   where wallet.workspace_id = p_workspace_id
     and wallet.id = any(p_wallet_ids)
   order by wallet.id
   for update;
end;
$$;

create function private.wallet_balance(
  p_workspace_id uuid,
  p_wallet_id uuid
)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(entry.amount_minor::numeric), 0)
    from public.wallets as wallet
    left join public.ledger_entries as entry
      on entry.workspace_id = wallet.workspace_id
     and entry.account_id = wallet.ledger_account_id
   where wallet.workspace_id = p_workspace_id
     and wallet.id = p_wallet_id
$$;

create function private.write_audit(
  p_workspace_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into audit.events (
    workspace_id,
    actor_user_id,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    p_workspace_id,
    p_actor_user_id,
    p_action,
    p_target_table,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Read policies intentionally ignore subscription state. Expiry blocks writes,
-- not member access or exports.
create policy currencies_select_authenticated
on public.currencies
for select
to authenticated
using (true);

create policy profiles_select_self_or_supervisor
on public.profiles
for select
to authenticated
using (id = auth.uid() or private.is_supervisor());

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid() and account_status = 'active')
with check (id = auth.uid() and account_status = 'active');

create policy workspaces_select_member_or_supervisor
on public.workspaces
for select
to authenticated
using (
  private.is_workspace_member(id)
  or private.is_supervisor()
);

create policy workspaces_update_admin_or_supervisor
on public.workspaces
for update
to authenticated
using (
  (
    private.has_workspace_role(
      id,
      array['owner', 'admin']::public.workspace_role[]
    )
    and private.can_write_workspace(id)
  )
  or private.is_supervisor()
)
with check (
  (
    private.has_workspace_role(
      id,
      array['owner', 'admin']::public.workspace_role[]
    )
    and private.can_write_workspace(id)
  )
  or private.is_supervisor()
);

create policy workspace_members_select_member_or_supervisor
on public.workspace_members
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  or private.is_supervisor()
);

create policy subscription_plans_select_available_or_supervisor
on public.subscription_plans
for select
to authenticated
using (
  (is_public and is_active)
  or private.is_supervisor()
);

create policy workspace_subscriptions_select_member_or_supervisor
on public.workspace_subscriptions
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  or private.is_supervisor()
);

create policy payment_requests_select_member_or_supervisor
on public.payment_requests
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  or private.is_supervisor()
);

create policy subscription_events_select_member_or_supervisor
on public.subscription_events
for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  or private.is_supervisor()
);

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy notifications_update_own
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy projects_select_member
on public.projects
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy projects_insert_writer
on public.projects
for insert
to authenticated
with check (
  created_by = auth.uid()
  and private.can_write_workspace(workspace_id)
);

create policy projects_update_writer
on public.projects
for update
to authenticated
using (private.can_write_workspace(workspace_id))
with check (private.can_write_workspace(workspace_id));

create policy categories_select_member
on public.categories
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy categories_insert_writer
on public.categories
for insert
to authenticated
with check (
  created_by = auth.uid()
  and not is_system
  and private.can_write_workspace(workspace_id)
);

create policy categories_update_writer
on public.categories
for update
to authenticated
using (
  not is_system
  and private.can_write_workspace(workspace_id)
)
with check (
  not is_system
  and private.can_write_workspace(workspace_id)
);

create policy ledger_accounts_select_member
on public.ledger_accounts
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy wallets_select_member
on public.wallets
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy financial_events_select_member
on public.financial_events
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy ledger_entries_select_member
on public.ledger_entries
for select
to authenticated
using (private.is_workspace_member(workspace_id));

-- Auto-expose is disabled. Start from no API privileges and grant only the
-- intended authenticated surface.
revoke all privileges on all tables in schema public
  from public, anon, authenticated;
revoke all privileges on all sequences in schema public
  from public, anon, authenticated;
revoke execute on all functions in schema public
  from public, anon, authenticated;
revoke execute on all functions in schema private
  from public, anon, authenticated;
revoke execute on all functions in schema audit
  from public, anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema private
  revoke execute on functions from public;
alter default privileges in schema audit
  revoke execute on functions from public;

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;

grant select on public.currencies to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, locale, timezone)
  on public.profiles to authenticated;

grant select on public.workspaces to authenticated;
grant update (name, default_currency_code)
  on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;

grant select on public.subscription_plans to authenticated;
grant select on public.workspace_subscriptions to authenticated;
grant select on public.payment_requests to authenticated;
grant select on public.subscription_events to authenticated;

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant select on public.projects to authenticated;
grant insert (workspace_id, name, created_by)
  on public.projects to authenticated;
grant update (name, status)
  on public.projects to authenticated;

grant select on public.categories to authenticated;
grant insert (workspace_id, name, kind, created_by)
  on public.categories to authenticated;
grant update (name, is_active)
  on public.categories to authenticated;

grant select on public.ledger_accounts to authenticated;
grant select on public.wallets to authenticated;
grant select on public.financial_events to authenticated;
grant select on public.ledger_entries to authenticated;

grant select on public.wallet_balances to authenticated;
grant select on public.visible_financial_events to authenticated;
grant select on public.project_totals to authenticated;

grant execute on function private.is_supervisor()
  to authenticated;
grant execute on function private.is_workspace_member(uuid)
  to authenticated;
grant execute on function private.has_workspace_role(
  uuid,
  public.workspace_role[]
)
  to authenticated;
grant execute on function private.has_current_entitlement(uuid)
  to authenticated;
grant execute on function private.can_write_workspace(uuid)
  to authenticated;

revoke all privileges on all tables in schema private
  from public, anon, authenticated;
revoke all privileges on all tables in schema audit
  from public, anon, authenticated;
