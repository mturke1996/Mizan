-- Make append-only work-log RPC idempotency safe under concurrent retries.

create or replace function public.record_daily_work(
  p_workspace_id uuid,
  p_project_id uuid,
  p_worker_id uuid,
  p_work_date date,
  p_amount_minor bigint default null,
  p_note text default null,
  p_client_id uuid default extensions.gen_random_uuid()
)
returns public.project_work_logs
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_worker public.project_workers;
  v_workspace public.workspaces;
  v_amount bigint;
  v_log public.project_work_logs;
  v_payload jsonb;
begin
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_client_id is null or p_work_date is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':' || p_client_id::text || ':record_daily_work',
      0
    )
  );

  select * into v_log
  from public.project_work_logs
  where workspace_id = p_workspace_id
    and client_id = p_client_id
    and operation = 'record_daily_work';

  if found then
    if v_log.project_id is distinct from p_project_id
      or v_log.worker_id is distinct from p_worker_id
      or v_log.work_date is distinct from p_work_date
      or (
        p_amount_minor is not null
        and v_log.amount_minor is distinct from p_amount_minor
      )
    then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    return v_log;
  end if;

  select * into v_worker
  from public.project_workers
  where workspace_id = p_workspace_id
    and id = p_worker_id
    and project_id = p_project_id
    and status = 'active';

  if v_worker.id is null then
    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;

  select * into v_workspace
  from public.workspaces
  where id = p_workspace_id;

  v_amount := coalesce(p_amount_minor, v_worker.daily_wage_minor);
  if v_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'worker_id', p_worker_id,
    'work_date', p_work_date,
    'amount_minor', v_amount,
    'entry_type', 'daily_wage'
  );

  insert into public.project_work_logs (
    workspace_id,
    project_id,
    worker_id,
    entry_type,
    work_date,
    amount_minor,
    currency_code,
    note,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    p_workspace_id,
    p_project_id,
    p_worker_id,
    'daily_wage',
    p_work_date,
    v_amount,
    v_workspace.default_currency_code,
    nullif(btrim(coalesce(p_note, '')), ''),
    auth.uid(),
    p_client_id,
    'record_daily_work',
    extensions.digest(v_payload::text, 'sha256')
  )
  returning * into v_log;

  return v_log;
end;
$$;

create or replace function public.post_wage_movement(
  p_workspace_id uuid,
  p_project_id uuid,
  p_worker_id uuid,
  p_entry_type public.work_log_entry_type,
  p_amount_minor bigint,
  p_work_date date default (timezone('utc', now()))::date,
  p_wallet_id uuid default null,
  p_note text default null,
  p_client_id uuid default extensions.gen_random_uuid()
)
returns public.project_work_logs
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_worker public.project_workers;
  v_workspace public.workspaces;
  v_signed bigint;
  v_operation text;
  v_event_id uuid;
  v_category_id uuid;
  v_log public.project_work_logs;
  v_payload jsonb;
  v_payload_hash bytea;
  v_balance numeric;
  v_tx_client_id uuid;
begin
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_client_id is null or p_work_date is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if p_entry_type not in ('bonus', 'deduction', 'withdrawal', 'adjustment') then
    raise exception 'invalid_entry_type' using errcode = '22023';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  v_operation := case p_entry_type
    when 'bonus' then 'post_wage_bonus'
    when 'deduction' then 'post_wage_deduction'
    when 'withdrawal' then 'post_wage_withdrawal'
    else 'post_wage_adjustment'
  end;

  v_payload := jsonb_build_object(
    'worker_id', p_worker_id,
    'entry_type', p_entry_type,
    'amount_minor', p_amount_minor,
    'work_date', p_work_date,
    'wallet_id', p_wallet_id
  );
  v_payload_hash := extensions.digest(v_payload::text, 'sha256');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':' || p_client_id::text || ':' || v_operation,
      0
    )
  );

  select * into v_log
  from public.project_work_logs
  where workspace_id = p_workspace_id
    and client_id = p_client_id
    and operation = v_operation;

  if found then
    if v_log.payload_hash is distinct from v_payload_hash then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    return v_log;
  end if;

  select * into v_worker
  from public.project_workers
  where workspace_id = p_workspace_id
    and id = p_worker_id
    and project_id = p_project_id;

  if v_worker.id is null then
    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;

  select * into v_workspace
  from public.workspaces
  where id = p_workspace_id;

  v_signed := case
    when p_entry_type in ('bonus', 'adjustment') then p_amount_minor
    else -p_amount_minor
  end;

  select coalesce(sum(amount_minor::numeric), 0)
  into v_balance
  from public.project_work_logs
  where workspace_id = p_workspace_id
    and worker_id = p_worker_id;

  if p_entry_type in ('withdrawal', 'deduction')
    and (v_balance - p_amount_minor) < 0
  then
    raise exception 'insufficient_worker_balance' using errcode = 'P0001';
  end if;

  if p_entry_type = 'withdrawal' then
    if p_wallet_id is null then
      raise exception 'wallet_required' using errcode = '22023';
    end if;

    select id into v_category_id
    from public.categories
    where workspace_id = p_workspace_id
      and kind = 'expense'
      and name = 'أجور يومية'
    limit 1;

    if v_category_id is null then
      insert into public.categories (workspace_id, kind, name, created_by)
      values (p_workspace_id, 'expense', 'أجور يومية', auth.uid())
      returning id into v_category_id;
    end if;

    v_tx_client_id := extensions.gen_random_uuid();
    v_event_id := public.post_transaction(
      p_workspace_id := p_workspace_id,
      p_client_id := v_tx_client_id,
      p_wallet_id := p_wallet_id,
      p_kind := 'expense'::public.transaction_kind,
      p_amount_minor := p_amount_minor,
      p_occurred_at := p_work_date::timestamptz,
      p_description := coalesce(p_note, 'سحب أجر عامل: ' || v_worker.name),
      p_category_id := v_category_id,
      p_project_id := p_project_id
    );
  end if;

  insert into public.project_work_logs (
    workspace_id,
    project_id,
    worker_id,
    entry_type,
    work_date,
    amount_minor,
    currency_code,
    note,
    financial_event_id,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    p_workspace_id,
    p_project_id,
    p_worker_id,
    p_entry_type,
    p_work_date,
    v_signed,
    v_workspace.default_currency_code,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_event_id,
    auth.uid(),
    p_client_id,
    v_operation,
    v_payload_hash
  )
  returning * into v_log;

  return v_log;
end;
$$;
