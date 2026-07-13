-- Allow correcting a wallet balance to an explicit target via a ledger adjustment.

alter type private.idempotency_operation
  add value if not exists 'adjust_wallet_balance';

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
      'adjust_wallet_balance'
    )
  );

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
    coalesce(
      v_note,
      pg_catalog.format('Balance adjustment: %s', v_wallet.name)
    ),
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

comment on function public.adjust_wallet_balance(
  uuid,
  uuid,
  uuid,
  bigint,
  text
) is
  'Idempotently adjusts a wallet ledger balance to an explicit non-negative target.';

revoke all on function public.adjust_wallet_balance(
  uuid,
  uuid,
  uuid,
  bigint,
  text
) from public, anon, authenticated;

grant execute on function public.adjust_wallet_balance(
  uuid,
  uuid,
  uuid,
  bigint,
  text
) to authenticated;
