-- Treasury fund/withdraw: amount-based wallet movements with clear Arabic labels.
-- Replaces the primary "set target balance" UX while keeping adjust_wallet_balance.

alter type private.idempotency_operation
  add value if not exists 'post_treasury_movement';

alter table public.financial_events
  drop constraint financial_events_operation;

alter table public.financial_events
  add constraint financial_events_operation
  check (
    operation in (
      'create_wallet',
      'post_transaction',
      'post_transfer',
      'reverse_financial_event',
      'adjust_wallet_balance',
      'replace_transaction',
      'post_debt_payment',
      'post_treasury_movement'
    )
  );

create or replace function public.post_treasury_movement(
  p_workspace_id uuid,
  p_client_id uuid,
  p_wallet_id uuid,
  p_amount_minor bigint,
  p_direction text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_direction text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_direction, '')));
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_wallet public.wallets%rowtype;
  v_current_balance numeric;
  v_delta bigint;
  v_event_id uuid;
  v_offset_account_id uuid;
  v_default_description text;
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

  if v_direction not in ('fund', 'withdraw') then
    raise exception using
      errcode = '22023',
      message = 'treasury direction must be fund or withdraw';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using
      errcode = '22023',
      message = 'transaction amount must be positive';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'description cannot exceed 1000 characters';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'amount_minor', p_amount_minor,
    'direction', v_direction,
    'note', v_note,
    'wallet_id', p_wallet_id
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'post_treasury_movement',
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

  v_current_balance := private.wallet_balance(p_workspace_id, p_wallet_id);
  v_delta := case
    when v_direction = 'fund' then p_amount_minor
    else -p_amount_minor
  end;

  if v_direction = 'withdraw' and v_current_balance < p_amount_minor::numeric then
    raise exception using
      errcode = '22023',
      message = 'insufficient wallet funds';
  end if;

  select account.id
    into v_offset_account_id
    from public.ledger_accounts as account
   where account.workspace_id = p_workspace_id
     and account.currency_code = v_wallet.currency_code
     and account.system_key = 'opening_equity';

  if v_offset_account_id is null then
    raise exception using
      errcode = '55000',
      message = 'opening equity account is unavailable';
  end if;

  v_default_description := case
    when v_direction = 'fund' then
      pg_catalog.format('تمويل الخزينة — %s', v_wallet.name)
    else
      pg_catalog.format('سحب من الخزينة — %s', v_wallet.name)
  end;

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
    v_wallet.currency_code,
    pg_catalog.clock_timestamp(),
    coalesce(v_note, v_default_description),
    v_user_id,
    p_client_id,
    'post_treasury_movement',
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
      v_delta
    ),
    (
      p_workspace_id,
      v_event_id,
      v_offset_account_id,
      v_wallet.currency_code,
      2,
      -v_delta
    );

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'post_treasury_movement',
    pg_catalog.jsonb_build_object('event_id', v_event_id)
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'wallet.treasury_movement',
    'wallets',
    p_wallet_id,
    pg_catalog.jsonb_build_object(
      'event_id', v_event_id,
      'direction', v_direction,
      'amount_minor', p_amount_minor,
      'delta_minor', v_delta
    )
  );

  return v_event_id;
end;
$$;

comment on function public.post_treasury_movement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text
) is
  'Posts a treasury fund or withdraw movement against opening equity for a wallet.';

revoke all on function public.post_treasury_movement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.post_treasury_movement(
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  text
) to authenticated;

-- Prefer Arabic defaults on legacy absolute balance adjustments.
create or replace function public.adjust_wallet_balance(
  p_workspace_id uuid,
  p_client_id uuid,
  p_wallet_id uuid,
  p_target_balance_minor bigint,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_wallet public.wallets%rowtype;
  v_current_balance numeric;
  v_delta bigint;
  v_event_id uuid;
  v_offset_account_id uuid;
  v_default_description text;
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

  if p_target_balance_minor is null or p_target_balance_minor < 0 then
    raise exception using
      errcode = '22023',
      message = 'target balance must be zero or positive';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'description cannot exceed 1000 characters';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'note', v_note,
    'target_balance_minor', p_target_balance_minor,
    'wallet_id', p_wallet_id
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'adjust_wallet_balance',
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

  v_current_balance := private.wallet_balance(p_workspace_id, p_wallet_id);
  v_delta := (p_target_balance_minor::numeric - v_current_balance)::bigint;

  if v_delta = 0 then
    perform private.finish_idempotent_operation(
      p_workspace_id,
      p_client_id,
      'adjust_wallet_balance',
      pg_catalog.jsonb_build_object('event_id', null, 'unchanged', true)
    );
    return null;
  end if;

  select account.id
    into v_offset_account_id
    from public.ledger_accounts as account
   where account.workspace_id = p_workspace_id
     and account.currency_code = v_wallet.currency_code
     and account.system_key = 'opening_equity';

  if v_offset_account_id is null then
    raise exception using
      errcode = '55000',
      message = 'opening equity account is unavailable';
  end if;

  v_default_description := case
    when v_delta > 0 then
      pg_catalog.format('تمويل الخزينة — %s', v_wallet.name)
    else
      pg_catalog.format('سحب من الخزينة — %s', v_wallet.name)
  end;

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
    v_wallet.currency_code,
    pg_catalog.clock_timestamp(),
    coalesce(v_note, v_default_description),
    v_user_id,
    p_client_id,
    'adjust_wallet_balance',
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
      v_delta
    ),
    (
      p_workspace_id,
      v_event_id,
      v_offset_account_id,
      v_wallet.currency_code,
      2,
      -v_delta
    );

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'adjust_wallet_balance',
    pg_catalog.jsonb_build_object('event_id', v_event_id)
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'wallet.balance_adjusted',
    'wallets',
    p_wallet_id,
    pg_catalog.jsonb_build_object(
      'event_id', v_event_id,
      'target_balance_minor', p_target_balance_minor,
      'delta_minor', v_delta
    )
  );

  return v_event_id;
end;
$$;
