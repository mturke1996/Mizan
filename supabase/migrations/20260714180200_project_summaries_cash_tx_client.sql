-- Include project cash fields in summaries + optional business client on post_transaction

drop view if exists public.project_summaries;

create view public.project_summaries
with (security_invoker = true) as
select
  project.id,
  project.workspace_id,
  project.name,
  project.description,
  project.goal_minor::text as goal_minor,
  project.color_token,
  project.status,
  project.project_type,
  project.modules,
  project.parent_project_id,
  project.cash_mode,
  project.linked_wallet_id,
  project.created_by,
  project.created_at,
  project.updated_at
from public.projects as project;

grant select on public.project_summaries to authenticated;

create or replace function public.post_transaction(
  p_workspace_id uuid,
  p_client_id uuid,
  p_wallet_id uuid,
  p_kind public.transaction_kind,
  p_amount_minor bigint,
  p_occurred_at timestamptz default null,
  p_description text default null,
  p_category_id uuid default null,
  p_project_id uuid default null,
  p_business_client_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
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
  v_business_client_ok boolean;
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
    'business_client_id', p_business_client_id,
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

  if p_business_client_id is not null then
    select true
      into v_business_client_ok
      from public.clients as business_client
     where business_client.workspace_id = p_workspace_id
       and business_client.id = p_business_client_id;

    if not coalesce(v_business_client_ok, false) then
      raise exception using
        errcode = '22023',
        message = 'business client must exist in the workspace';
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
    business_client_id,
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
    p_business_client_id,
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
$function$;

grant execute on function public.post_transaction(
  uuid, uuid, uuid, public.transaction_kind, bigint, timestamptz, text, uuid, uuid, uuid
) to authenticated;
