-- Narrow authenticated mutation surface.
-- Every RPC runs with an empty search_path and names database objects fully.

create function public.create_wallet(
  p_workspace_id uuid,
  p_client_id uuid,
  p_name text,
  p_currency_code text,
  p_opening_balance_minor bigint default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := pg_catalog.btrim(p_name);
  v_currency_code text := pg_catalog.upper(pg_catalog.btrim(p_currency_code));
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_account_id uuid;
  v_wallet_id uuid;
  v_event_id uuid;
  v_offset_account_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'authentication required';
  end if;

  if not private.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin', 'member']::public.workspace_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'active workspace writer role required';
  end if;

  if v_name is null
     or pg_catalog.char_length(v_name) not between 1 and 120
  then
    raise exception using
      errcode = '22023',
      message = 'wallet name must contain 1 to 120 characters';
  end if;

  if p_opening_balance_minor is null or p_opening_balance_minor < 0 then
    raise exception using
      errcode = '22023',
      message = 'opening balance must be zero or positive';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'currency_code', v_currency_code,
    'name', v_name,
    'opening_balance_minor', p_opening_balance_minor
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'create_wallet',
    v_payload_hash
  );

  if v_existing_result is not null then
    return (v_existing_result ->> 'wallet_id')::uuid;
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'workspace writes are unavailable for the current entitlement';
  end if;

  perform 1
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
     and workspace.status = 'active'
   for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'active workspace not found';
  end if;

  if not exists (
    select 1
      from public.currencies as currency
     where currency.code = v_currency_code
       and currency.is_active
  ) then
    raise exception using
      errcode = '22023',
      message = 'active currency not found';
  end if;

  perform private.ensure_system_accounts(
    p_workspace_id,
    v_currency_code,
    v_user_id
  );

  insert into public.ledger_accounts (
    workspace_id,
    currency_code,
    account_type,
    name,
    created_by
  )
  values (
    p_workspace_id,
    v_currency_code,
    'asset',
    v_name,
    v_user_id
  )
  returning id into v_account_id;

  insert into public.wallets (
    workspace_id,
    ledger_account_id,
    currency_code,
    name,
    created_by
  )
  values (
    p_workspace_id,
    v_account_id,
    v_currency_code,
    v_name,
    v_user_id
  )
  returning id into v_wallet_id;

  if p_opening_balance_minor > 0 then
    select account.id
      into v_offset_account_id
      from public.ledger_accounts as account
     where account.workspace_id = p_workspace_id
       and account.currency_code = v_currency_code
       and account.system_key = 'opening_equity';

    if v_offset_account_id is null then
      raise exception using
        errcode = '55000',
        message = 'opening equity account is unavailable';
    end if;

    v_event_id := extensions.gen_random_uuid();

    insert into public.financial_events (
      id,
      workspace_id,
      event_type,
      currency_code,
      occurred_at,
      description,
      created_by,
      client_id,
      operation,
      payload_hash
    )
    values (
      v_event_id,
      p_workspace_id,
      'opening_balance',
      v_currency_code,
      pg_catalog.clock_timestamp(),
      pg_catalog.format('Opening balance: %s', v_name),
      v_user_id,
      p_client_id,
      'create_wallet',
      v_payload_hash
    );

    insert into public.ledger_entries (
      workspace_id,
      event_id,
      account_id,
      currency_code,
      line_no,
      amount_minor
    )
    values
      (
        p_workspace_id,
        v_event_id,
        v_account_id,
        v_currency_code,
        1,
        p_opening_balance_minor
      ),
      (
        p_workspace_id,
        v_event_id,
        v_offset_account_id,
        v_currency_code,
        2,
        -p_opening_balance_minor
      );
  end if;

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'create_wallet',
    pg_catalog.jsonb_build_object('wallet_id', v_wallet_id)
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'wallet.created',
    'wallets',
    v_wallet_id,
    pg_catalog.jsonb_build_object(
      'currency_code', v_currency_code,
      'has_opening_balance', p_opening_balance_minor > 0
    )
  );

  return v_wallet_id;
end;
$$;

create function public.post_transaction(
  p_workspace_id uuid,
  p_client_id uuid,
  p_wallet_id uuid,
  p_kind public.transaction_kind,
  p_amount_minor bigint,
  p_occurred_at timestamptz default null,
  p_description text default null,
  p_category_id uuid default null,
  p_project_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_description text := nullif(pg_catalog.btrim(p_description), '');
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_wallet public.wallets%rowtype;
  v_event_id uuid;
  v_offset_account_id uuid;
  v_wallet_amount bigint;
  v_event_time timestamptz;
  v_category_kind public.category_kind;
  v_category_active boolean;
  v_project_active boolean;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'authentication required';
  end if;

  if not private.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin', 'member']::public.workspace_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'active workspace writer role required';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using
      errcode = '22023',
      message = 'transaction amount must be positive';
  end if;

  if p_kind is null then
    raise exception using
      errcode = '22023',
      message = 'transaction kind is required';
  end if;

  if v_description is not null
     and pg_catalog.char_length(v_description) > 1000
  then
    raise exception using
      errcode = '22023',
      message = 'description cannot exceed 1000 characters';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'amount_minor', p_amount_minor,
    'category_id', p_category_id,
    'description', v_description,
    'kind', p_kind::text,
    'occurred_at', p_occurred_at,
    'project_id', p_project_id,
    'wallet_id', p_wallet_id
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'post_transaction',
    v_payload_hash
  );

  if v_existing_result is not null then
    return (v_existing_result ->> 'event_id')::uuid;
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'workspace writes are unavailable for the current entitlement';
  end if;

  perform private.lock_wallets(p_workspace_id, array[p_wallet_id]);

  select wallet.*
    into v_wallet
    from public.wallets as wallet
   where wallet.workspace_id = p_workspace_id
     and wallet.id = p_wallet_id;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'wallet not found in workspace';
  end if;

  if v_wallet.status <> 'active' then
    raise exception using
      errcode = '22023',
      message = 'wallet is not active';
  end if;

  if p_category_id is not null then
    select category.kind, category.is_active
      into v_category_kind, v_category_active
      from public.categories as category
     where category.workspace_id = p_workspace_id
       and category.id = p_category_id;

    if not found or not v_category_active or v_category_kind::text <> p_kind::text then
      raise exception using
        errcode = '22023',
        message = 'category must be active, in the workspace, and match transaction kind';
    end if;
  end if;

  if p_project_id is not null then
    select project.status = 'active'
      into v_project_active
      from public.projects as project
     where project.workspace_id = p_workspace_id
       and project.id = p_project_id;

    if not found or not v_project_active then
      raise exception using
        errcode = '22023',
        message = 'project must be active and in the workspace';
    end if;
  end if;

  if p_kind = 'expense'
     and private.wallet_balance(p_workspace_id, p_wallet_id) < p_amount_minor
  then
    raise exception using
      errcode = '22003',
      message = 'insufficient wallet funds';
  end if;

  perform private.ensure_system_accounts(
    p_workspace_id,
    v_wallet.currency_code,
    v_user_id
  );

  select account.id
    into v_offset_account_id
    from public.ledger_accounts as account
   where account.workspace_id = p_workspace_id
     and account.currency_code = v_wallet.currency_code
     and account.system_key::text = p_kind::text;

  if v_offset_account_id is null then
    raise exception using
      errcode = '55000',
      message = 'transaction offset account is unavailable';
  end if;

  v_event_id := extensions.gen_random_uuid();
  v_event_time := coalesce(
    p_occurred_at,
    pg_catalog.clock_timestamp()
  );
  v_wallet_amount := case
    when p_kind = 'income' then p_amount_minor
    else -p_amount_minor
  end;

  insert into public.financial_events (
    id,
    workspace_id,
    event_type,
    currency_code,
    occurred_at,
    description,
    category_id,
    project_id,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    v_event_id,
    p_workspace_id,
    p_kind::text::public.financial_event_type,
    v_wallet.currency_code,
    v_event_time,
    v_description,
    p_category_id,
    p_project_id,
    v_user_id,
    p_client_id,
    'post_transaction',
    v_payload_hash
  );

  insert into public.ledger_entries (
    workspace_id,
    event_id,
    account_id,
    currency_code,
    line_no,
    amount_minor
  )
  values
    (
      p_workspace_id,
      v_event_id,
      v_wallet.ledger_account_id,
      v_wallet.currency_code,
      1,
      v_wallet_amount
    ),
    (
      p_workspace_id,
      v_event_id,
      v_offset_account_id,
      v_wallet.currency_code,
      2,
      -v_wallet_amount
    );

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'post_transaction',
    pg_catalog.jsonb_build_object('event_id', v_event_id)
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'financial_event.posted',
    'financial_events',
    v_event_id,
    pg_catalog.jsonb_build_object('event_type', p_kind::text)
  );

  return v_event_id;
end;
$$;

create function public.post_transfer(
  p_workspace_id uuid,
  p_client_id uuid,
  p_source_wallet_id uuid,
  p_destination_wallet_id uuid,
  p_amount_minor bigint,
  p_occurred_at timestamptz default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_description text := nullif(pg_catalog.btrim(p_description), '');
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_source public.wallets%rowtype;
  v_destination public.wallets%rowtype;
  v_event_id uuid;
  v_event_time timestamptz;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'authentication required';
  end if;

  if not private.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin', 'member']::public.workspace_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'active workspace writer role required';
  end if;

  if p_source_wallet_id is null
     or p_destination_wallet_id is null
     or p_source_wallet_id = p_destination_wallet_id
  then
    raise exception using
      errcode = '22023',
      message = 'source and destination wallets must be different';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using
      errcode = '22023',
      message = 'transfer amount must be positive';
  end if;

  if v_description is not null
     and pg_catalog.char_length(v_description) > 1000
  then
    raise exception using
      errcode = '22023',
      message = 'description cannot exceed 1000 characters';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'amount_minor', p_amount_minor,
    'description', v_description,
    'destination_wallet_id', p_destination_wallet_id,
    'occurred_at', p_occurred_at,
    'source_wallet_id', p_source_wallet_id
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'post_transfer',
    v_payload_hash
  );

  if v_existing_result is not null then
    return (v_existing_result ->> 'event_id')::uuid;
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'workspace writes are unavailable for the current entitlement';
  end if;

  -- Every wallet-changing RPC takes wallet locks in UUID order. This makes
  -- concurrent transfers deadlock-safe and serializes balance checks.
  perform private.lock_wallets(
    p_workspace_id,
    array[p_source_wallet_id, p_destination_wallet_id]
  );

  select wallet.*
    into v_source
    from public.wallets as wallet
   where wallet.workspace_id = p_workspace_id
     and wallet.id = p_source_wallet_id;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'source wallet not found in workspace';
  end if;

  select wallet.*
    into v_destination
    from public.wallets as wallet
   where wallet.workspace_id = p_workspace_id
     and wallet.id = p_destination_wallet_id;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'destination wallet not found in workspace';
  end if;

  if v_source.status <> 'active' or v_destination.status <> 'active' then
    raise exception using
      errcode = '22023',
      message = 'both transfer wallets must be active';
  end if;

  if v_source.currency_code <> v_destination.currency_code then
    raise exception using
      errcode = '22023',
      message = 'transfer wallets must use the same currency';
  end if;

  if private.wallet_balance(p_workspace_id, p_source_wallet_id) < p_amount_minor then
    raise exception using
      errcode = '22003',
      message = 'insufficient source wallet funds';
  end if;

  v_event_id := extensions.gen_random_uuid();
  v_event_time := coalesce(
    p_occurred_at,
    pg_catalog.clock_timestamp()
  );

  insert into public.financial_events (
    id,
    workspace_id,
    event_type,
    currency_code,
    occurred_at,
    description,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    v_event_id,
    p_workspace_id,
    'transfer',
    v_source.currency_code,
    v_event_time,
    v_description,
    v_user_id,
    p_client_id,
    'post_transfer',
    v_payload_hash
  );

  insert into public.ledger_entries (
    workspace_id,
    event_id,
    account_id,
    currency_code,
    line_no,
    amount_minor
  )
  values
    (
      p_workspace_id,
      v_event_id,
      v_source.ledger_account_id,
      v_source.currency_code,
      1,
      -p_amount_minor
    ),
    (
      p_workspace_id,
      v_event_id,
      v_destination.ledger_account_id,
      v_destination.currency_code,
      2,
      p_amount_minor
    );

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'post_transfer',
    pg_catalog.jsonb_build_object('event_id', v_event_id)
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'financial_event.posted',
    'financial_events',
    v_event_id,
    pg_catalog.jsonb_build_object('event_type', 'transfer')
  );

  return v_event_id;
end;
$$;

create function public.reverse_financial_event(
  p_workspace_id uuid,
  p_client_id uuid,
  p_event_id uuid,
  p_occurred_at timestamptz default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_original public.financial_events%rowtype;
  v_reversal_event_id uuid;
  v_event_time timestamptz;
  v_wallet_ids uuid[];
  v_requirement record;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'authentication required';
  end if;

  if not private.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin', 'member']::public.workspace_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'active workspace writer role required';
  end if;

  if v_reason is not null and pg_catalog.char_length(v_reason) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'reversal reason cannot exceed 1000 characters';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'event_id', p_event_id,
    'occurred_at', p_occurred_at,
    'reason', v_reason
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'reverse_financial_event',
    v_payload_hash
  );

  if v_existing_result is not null then
    return (v_existing_result ->> 'event_id')::uuid;
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'workspace writes are unavailable for the current entitlement';
  end if;

  select event.*
    into v_original
    from public.financial_events as event
   where event.workspace_id = p_workspace_id
     and event.id = p_event_id
   for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'financial event not found in workspace';
  end if;

  if v_original.event_type = 'reversal' then
    raise exception using
      errcode = '22023',
      message = 'reversal events cannot be reversed';
  end if;

  if exists (
    select 1
      from public.financial_events as event
     where event.workspace_id = p_workspace_id
       and event.reversal_of_event_id = p_event_id
  ) then
    raise exception using
      errcode = '23505',
      message = 'financial event was already reversed';
  end if;

  select pg_catalog.array_agg(wallet.id order by wallet.id)
    into v_wallet_ids
    from public.ledger_entries as entry
    join public.wallets as wallet
      on wallet.workspace_id = entry.workspace_id
     and wallet.ledger_account_id = entry.account_id
   where entry.workspace_id = p_workspace_id
     and entry.event_id = p_event_id;

  if v_wallet_ids is null then
    raise exception using
      errcode = '55000',
      message = 'financial event has no wallet lines';
  end if;

  perform private.lock_wallets(p_workspace_id, v_wallet_ids);

  -- A positive original wallet line becomes an outgoing reversal line.
  -- Check each affected wallet after all wallet locks are held.
  for v_requirement in
    select
      wallet.id as wallet_id,
      sum(entry.amount_minor::numeric) as required_minor
    from public.ledger_entries as entry
    join public.wallets as wallet
      on wallet.workspace_id = entry.workspace_id
     and wallet.ledger_account_id = entry.account_id
    where entry.workspace_id = p_workspace_id
      and entry.event_id = p_event_id
    group by wallet.id
    having sum(entry.amount_minor::numeric) > 0
  loop
    if private.wallet_balance(
      p_workspace_id,
      v_requirement.wallet_id
    ) < v_requirement.required_minor then
      raise exception using
        errcode = '22003',
        message = 'reversal would overdraw a wallet';
    end if;
  end loop;

  v_reversal_event_id := extensions.gen_random_uuid();
  v_event_time := coalesce(
    p_occurred_at,
    pg_catalog.clock_timestamp()
  );

  insert into public.financial_events (
    id,
    workspace_id,
    event_type,
    currency_code,
    occurred_at,
    description,
    category_id,
    project_id,
    reversal_of_event_id,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    v_reversal_event_id,
    p_workspace_id,
    'reversal',
    v_original.currency_code,
    v_event_time,
    coalesce(
      v_reason,
      pg_catalog.format('Reversal of event %s', p_event_id)
    ),
    v_original.category_id,
    v_original.project_id,
    p_event_id,
    v_user_id,
    p_client_id,
    'reverse_financial_event',
    v_payload_hash
  );

  insert into public.ledger_entries (
    workspace_id,
    event_id,
    account_id,
    currency_code,
    line_no,
    amount_minor
  )
  select
    entry.workspace_id,
    v_reversal_event_id,
    entry.account_id,
    entry.currency_code,
    entry.line_no,
    -entry.amount_minor
  from public.ledger_entries as entry
  where entry.workspace_id = p_workspace_id
    and entry.event_id = p_event_id
  order by entry.line_no;

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'reverse_financial_event',
    pg_catalog.jsonb_build_object('event_id', v_reversal_event_id)
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'financial_event.reversed',
    'financial_events',
    p_event_id,
    pg_catalog.jsonb_build_object(
      'reversal_event_id', v_reversal_event_id
    )
  );

  return v_reversal_event_id;
end;
$$;

create function public.create_payment_request(
  p_workspace_id uuid,
  p_client_id uuid,
  p_plan_id uuid,
  p_period_count smallint default 1,
  p_requester_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_note text := nullif(pg_catalog.btrim(p_requester_note), '');
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_plan public.subscription_plans%rowtype;
  v_request_id uuid;
  v_amount_minor bigint;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'authentication required';
  end if;

  -- Deliberately does not call can_write_workspace: expired members retain
  -- access to renewal workflows.
  if not private.is_workspace_member(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'active workspace membership required';
  end if;

  if p_period_count is null or p_period_count not between 1 and 24 then
    raise exception using
      errcode = '22023',
      message = 'period_count must be between 1 and 24';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'requester note cannot exceed 1000 characters';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'period_count', p_period_count,
    'plan_id', p_plan_id,
    'requester_note', v_note
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'create_payment_request',
    v_payload_hash
  );

  if v_existing_result is not null then
    return (v_existing_result ->> 'payment_request_id')::uuid;
  end if;

  select plan.*
    into v_plan
    from public.subscription_plans as plan
   where plan.id = p_plan_id
     and plan.is_active
     and plan.is_public
     and plan.price_minor > 0
     and plan.billing_interval in ('monthly', 'yearly');

  if not found then
    raise exception using
      errcode = '22023',
      message = 'purchasable subscription plan not found';
  end if;

  v_amount_minor := v_plan.price_minor * p_period_count;

  insert into public.payment_requests (
    workspace_id,
    requested_by,
    plan_id,
    period_count,
    amount_minor,
    currency_code,
    requester_note
  )
  values (
    p_workspace_id,
    v_user_id,
    p_plan_id,
    p_period_count,
    v_amount_minor,
    v_plan.currency_code,
    v_note
  )
  returning id into v_request_id;

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'create_payment_request',
    pg_catalog.jsonb_build_object(
      'payment_request_id',
      v_request_id
    )
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'payment_request.created',
    'payment_requests',
    v_request_id,
    pg_catalog.jsonb_build_object(
      'amount_minor', v_amount_minor,
      'currency_code', v_plan.currency_code,
      'plan_id', p_plan_id
    )
  );

  return v_request_id;
end;
$$;

create function public.review_payment_request(
  p_payment_request_id uuid,
  p_decision public.payment_review_decision,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor_id uuid := auth.uid();
  v_note text := nullif(pg_catalog.btrim(p_review_note), '');
  v_request public.payment_requests%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_period_base timestamptz;
  v_period_months integer;
  v_new_period_end timestamptz;
begin
  if v_supervisor_id is null or not private.is_supervisor() then
    raise exception using
      errcode = '42501',
      message = 'active supervisor role required';
  end if;

  if p_decision is null then
    raise exception using
      errcode = '22023',
      message = 'review decision is required';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'review note cannot exceed 1000 characters';
  end if;

  select request.*
    into v_request
    from public.payment_requests as request
   where request.id = p_payment_request_id
   for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'payment request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception using
      errcode = '55000',
      message = 'payment request was already reviewed';
  end if;

  select plan.*
    into v_plan
    from public.subscription_plans as plan
   where plan.id = v_request.plan_id;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'payment request plan is unavailable';
  end if;

  select subscription.*
    into v_subscription
    from public.workspace_subscriptions as subscription
   where subscription.workspace_id = v_request.workspace_id
   for update;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'workspace subscription is unavailable';
  end if;

  if p_decision = 'approve' then
    if v_request.proof_object_path is null then
      raise exception using
        errcode = '22023',
        message = 'payment proof must be attached before approval';
    end if;

    if not exists (
      select 1
        from storage.objects as object
       where object.bucket_id = 'payment-proofs'
         and object.name = v_request.proof_object_path
    ) then
      raise exception using
        errcode = '22023',
        message = 'attached payment proof object no longer exists';
    end if;

    v_period_months := case v_plan.billing_interval
      when 'monthly' then v_plan.interval_count * v_request.period_count
      when 'yearly' then 12 * v_plan.interval_count * v_request.period_count
      else null
    end;

    if v_period_months is null or v_period_months <= 0 then
      raise exception using
        errcode = '55000',
        message = 'payment plan has no renewable interval';
    end if;

    v_period_base := case
      when v_subscription.status = 'trialing'
       and v_subscription.trial_ends_at > v_now
        then v_subscription.trial_ends_at
      when v_subscription.status in ('active', 'grace')
       and v_subscription.current_period_ends_at > v_now
        then v_subscription.current_period_ends_at
      else v_now
    end;
    v_new_period_end := v_period_base
      + pg_catalog.make_interval(months => v_period_months);

    update public.payment_requests as request
       set status = 'approved',
           reviewed_by = v_supervisor_id,
           reviewed_at = v_now,
           review_note = v_note
     where request.id = p_payment_request_id;

    update public.workspace_subscriptions as subscription
       set plan_id = v_request.plan_id,
           status = 'active',
           current_period_ends_at = v_new_period_end,
           grace_ends_at = null,
           frozen_at = null,
           expired_at = null,
           cancelled_at = null
     where subscription.id = v_subscription.id;

    insert into public.subscription_events (
      workspace_id,
      subscription_id,
      payment_request_id,
      actor_user_id,
      event_type,
      from_status,
      to_status,
      metadata
    )
    values (
      v_request.workspace_id,
      v_subscription.id,
      v_request.id,
      v_supervisor_id,
      'payment_approved',
      v_subscription.status,
      'active',
      pg_catalog.jsonb_build_object(
        'new_period_end', v_new_period_end,
        'plan_id', v_request.plan_id
      )
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
      v_request.requested_by,
      v_request.workspace_id,
      'payment',
      'Payment approved',
      'Your payment was approved and the workspace subscription is active.',
      pg_catalog.jsonb_build_object(
        'payment_request_id', v_request.id,
        'current_period_ends_at', v_new_period_end
      )
    );
  else
    update public.payment_requests as request
       set status = 'rejected',
           reviewed_by = v_supervisor_id,
           reviewed_at = v_now,
           review_note = v_note
     where request.id = p_payment_request_id;

    insert into public.subscription_events (
      workspace_id,
      subscription_id,
      payment_request_id,
      actor_user_id,
      event_type,
      from_status,
      to_status,
      metadata
    )
    values (
      v_request.workspace_id,
      v_subscription.id,
      v_request.id,
      v_supervisor_id,
      'payment_rejected',
      v_subscription.status,
      v_subscription.status,
      pg_catalog.jsonb_build_object('review_note', v_note)
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
      v_request.requested_by,
      v_request.workspace_id,
      'payment',
      'Payment requires attention',
      'Your payment proof was not approved. Review the supervisor note.',
      pg_catalog.jsonb_build_object(
        'payment_request_id', v_request.id,
        'review_note', v_note
      )
    );
  end if;

  perform private.write_audit(
    v_request.workspace_id,
    v_supervisor_id,
    case
      when p_decision = 'approve' then 'payment_request.approved'
      else 'payment_request.rejected'
    end,
    'payment_requests',
    v_request.id,
    pg_catalog.jsonb_build_object(
      'decision', p_decision::text,
      'review_note', v_note
    )
  );

  return v_request.id;
end;
$$;

comment on function public.create_wallet(uuid, uuid, text, text, bigint) is
  'Idempotently creates a wallet and optional balanced opening event.';
comment on function public.post_transaction(
  uuid,
  uuid,
  uuid,
  public.transaction_kind,
  bigint,
  timestamptz,
  text,
  uuid,
  uuid
) is
  'Idempotently posts a balanced income or expense event.';
comment on function public.post_transfer(
  uuid,
  uuid,
  uuid,
  uuid,
  bigint,
  timestamptz,
  text
) is
  'Idempotently posts a race-safe same-currency wallet transfer.';
comment on function public.reverse_financial_event(
  uuid,
  uuid,
  uuid,
  timestamptz,
  text
) is
  'Idempotently reverses an event by posting its exact opposite entries.';
comment on function public.create_payment_request(
  uuid,
  uuid,
  uuid,
  smallint,
  text
) is
  'Creates an idempotent member renewal request without requiring entitlement.';
comment on function public.review_payment_request(
  uuid,
  public.payment_review_decision,
  text
) is
  'Atomically reviews a manual payment and activates approved subscriptions.';

revoke all on function public.create_wallet(
  uuid,
  uuid,
  text,
  text,
  bigint
) from public, anon, authenticated;
revoke all on function public.post_transaction(
  uuid,
  uuid,
  uuid,
  public.transaction_kind,
  bigint,
  timestamptz,
  text,
  uuid,
  uuid
) from public, anon, authenticated;
revoke all on function public.post_transfer(
  uuid,
  uuid,
  uuid,
  uuid,
  bigint,
  timestamptz,
  text
) from public, anon, authenticated;
revoke all on function public.reverse_financial_event(
  uuid,
  uuid,
  uuid,
  timestamptz,
  text
) from public, anon, authenticated;
revoke all on function public.create_payment_request(
  uuid,
  uuid,
  uuid,
  smallint,
  text
) from public, anon, authenticated;
revoke all on function public.review_payment_request(
  uuid,
  public.payment_review_decision,
  text
) from public, anon, authenticated;

grant execute on function public.create_wallet(
  uuid,
  uuid,
  text,
  text,
  bigint
) to authenticated;
grant execute on function public.post_transaction(
  uuid,
  uuid,
  uuid,
  public.transaction_kind,
  bigint,
  timestamptz,
  text,
  uuid,
  uuid
) to authenticated;
grant execute on function public.post_transfer(
  uuid,
  uuid,
  uuid,
  uuid,
  bigint,
  timestamptz,
  text
) to authenticated;
grant execute on function public.reverse_financial_event(
  uuid,
  uuid,
  uuid,
  timestamptz,
  text
) to authenticated;
grant execute on function public.create_payment_request(
  uuid,
  uuid,
  uuid,
  smallint,
  text
) to authenticated;
grant execute on function public.review_payment_request(
  uuid,
  public.payment_review_decision,
  text
) to authenticated;
