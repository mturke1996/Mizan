-- Atomically replace an income/expense transaction (wallet, amount, project, kind, description).

alter type private.idempotency_operation
  add value if not exists 'replace_transaction';

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
      'replace_transaction'
    )
  );

create or replace function public.replace_transaction(
  p_workspace_id uuid,
  p_client_id uuid,
  p_event_id uuid,
  p_wallet_id uuid,
  p_kind public.transaction_kind,
  p_amount_minor bigint,
  p_description text default null,
  p_category_id uuid default null,
  p_project_id uuid default null,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_description text := nullif(pg_catalog.btrim(coalesce(p_description, '')), '');
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_original public.financial_events%rowtype;
  v_wallet public.wallets%rowtype;
  v_original_wallet_id uuid;
  v_original_amount bigint;
  v_reversal_event_id uuid;
  v_new_event_id uuid;
  v_event_time timestamptz;
  v_offset_account_id uuid;
  v_wallet_amount bigint;
  v_category_kind public.category_kind;
  v_category_active boolean;
  v_project_active boolean;
  v_wallet_ids uuid[];
  v_balance_after_reverse numeric;
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
    'event_id', p_event_id,
    'kind', p_kind::text,
    'occurred_at', p_occurred_at,
    'project_id', p_project_id,
    'wallet_id', p_wallet_id
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'replace_transaction',
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

  if v_original.event_type not in (
    'income'::public.financial_event_type,
    'expense'::public.financial_event_type
  ) then
    raise exception using
      errcode = '22023',
      message = 'only income and expense transactions can be replaced';
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

  select wallet.id
    into v_original_wallet_id
    from public.ledger_entries as entry
    join public.wallets as wallet
      on wallet.workspace_id = entry.workspace_id
     and wallet.ledger_account_id = entry.account_id
   where entry.workspace_id = p_workspace_id
     and entry.event_id = p_event_id
   order by entry.line_no
   limit 1;

  if v_original_wallet_id is null then
    raise exception using
      errcode = '55000',
      message = 'financial event has no wallet lines';
  end if;

  select abs(entry.amount_minor)
    into v_original_amount
    from public.ledger_entries as entry
    join public.wallets as wallet
      on wallet.workspace_id = entry.workspace_id
     and wallet.ledger_account_id = entry.account_id
   where entry.workspace_id = p_workspace_id
     and entry.event_id = p_event_id
   order by entry.line_no
   limit 1;

  v_wallet_ids := (
    select pg_catalog.array_agg(distinct wallet_id order by wallet_id)
      from (
        select v_original_wallet_id as wallet_id
        union
        select p_wallet_id
      ) as wallets
  );

  perform private.lock_wallets(p_workspace_id, v_wallet_ids);

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

  -- Balance available on the destination wallet after reversing the original.
  v_balance_after_reverse := private.wallet_balance(p_workspace_id, p_wallet_id);
  if p_wallet_id = v_original_wallet_id then
    if v_original.event_type = 'income'::public.financial_event_type then
      v_balance_after_reverse := v_balance_after_reverse - v_original_amount;
    else
      v_balance_after_reverse := v_balance_after_reverse + v_original_amount;
    end if;
  end if;

  if p_kind = 'expense' and v_balance_after_reverse < p_amount_minor then
    raise exception using
      errcode = '22003',
      message = 'insufficient wallet funds';
  end if;

  -- Reversing an income on another wallet must not overdraw that wallet.
  if v_original.event_type = 'income'::public.financial_event_type
     and p_wallet_id <> v_original_wallet_id
     and private.wallet_balance(p_workspace_id, v_original_wallet_id) < v_original_amount
  then
    raise exception using
      errcode = '22003',
      message = 'reversal would overdraw a wallet';
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

  v_reversal_event_id := extensions.gen_random_uuid();
  v_new_event_id := extensions.gen_random_uuid();
  v_event_time := coalesce(p_occurred_at, v_original.occurred_at);

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
    pg_catalog.clock_timestamp(),
    pg_catalog.format('Replaced event %s', p_event_id),
    v_original.category_id,
    v_original.project_id,
    p_event_id,
    v_user_id,
    extensions.gen_random_uuid(),
    'reverse_financial_event',
    private.payload_hash(
      pg_catalog.jsonb_build_object(
        'event_id', p_event_id,
        'replace_client_id', p_client_id
      )
    )
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
    v_new_event_id,
    p_workspace_id,
    p_kind::text::public.financial_event_type,
    v_wallet.currency_code,
    v_event_time,
    v_description,
    p_category_id,
    p_project_id,
    v_user_id,
    p_client_id,
    'replace_transaction',
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
      v_new_event_id,
      v_wallet.ledger_account_id,
      v_wallet.currency_code,
      1,
      v_wallet_amount
    ),
    (
      p_workspace_id,
      v_new_event_id,
      v_offset_account_id,
      v_wallet.currency_code,
      2,
      -v_wallet_amount
    );

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'replace_transaction',
    pg_catalog.jsonb_build_object(
      'event_id', v_new_event_id,
      'reversal_event_id', v_reversal_event_id,
      'replaced_event_id', p_event_id
    )
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'financial_event.replaced',
    'financial_events',
    p_event_id,
    pg_catalog.jsonb_build_object(
      'new_event_id', v_new_event_id,
      'reversal_event_id', v_reversal_event_id,
      'event_type', p_kind::text
    )
  );

  return v_new_event_id;
end;
$$;

comment on function public.replace_transaction(
  uuid,
  uuid,
  uuid,
  uuid,
  public.transaction_kind,
  bigint,
  text,
  uuid,
  uuid,
  timestamptz
) is
  'Idempotently reverses an income/expense event and posts a replacement with updated fields.';

revoke all on function public.replace_transaction(
  uuid,
  uuid,
  uuid,
  uuid,
  public.transaction_kind,
  bigint,
  text,
  uuid,
  uuid,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.replace_transaction(
  uuid,
  uuid,
  uuid,
  uuid,
  public.transaction_kind,
  bigint,
  text,
  uuid,
  uuid,
  timestamptz
) to authenticated;
