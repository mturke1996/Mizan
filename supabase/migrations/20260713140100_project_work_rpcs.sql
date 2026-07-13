-- Project CRUD helpers + cafe work-log RPCs.

create or replace function public.create_project(
  p_workspace_id uuid,
  p_name text,
  p_description text default null,
  p_goal_minor bigint default null,
  p_color_token text default 'primary',
  p_status public.project_status default 'active',
  p_client_id uuid default extensions.gen_random_uuid()
)
returns public.projects
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_project public.projects;
begin
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 then
    raise exception 'invalid_project_name' using errcode = '22023';
  end if;

  insert into public.projects (
    workspace_id,
    name,
    description,
    goal_minor,
    color_token,
    status,
    created_by
  )
  values (
    p_workspace_id,
    btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_goal_minor,
    coalesce(nullif(btrim(p_color_token), ''), 'primary'),
    p_status,
    auth.uid()
  )
  returning * into v_project;

  return v_project;
end;
$$;

create or replace function public.update_project(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text default null,
  p_description text default null,
  p_goal_minor bigint default null,
  p_color_token text default null,
  p_status public.project_status default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_project public.projects;
begin
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.projects
  set
    name = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
    description = case
      when p_description is null then description
      else nullif(btrim(p_description), '')
    end,
    goal_minor = coalesce(p_goal_minor, goal_minor),
    color_token = coalesce(nullif(btrim(coalesce(p_color_token, '')), ''), color_token),
    status = coalesce(p_status, status),
    updated_at = clock_timestamp()
  where workspace_id = p_workspace_id
    and id = p_project_id
  returning * into v_project;

  if v_project.id is null then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  return v_project;
end;
$$;

create or replace function public.create_project_worker(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text,
  p_daily_wage_minor bigint,
  p_phone text default null
)
returns public.project_workers
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_worker public.project_workers;
begin
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.projects
    where workspace_id = p_workspace_id and id = p_project_id
  ) then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  if p_daily_wage_minor is null or p_daily_wage_minor < 0 then
    raise exception 'invalid_daily_wage' using errcode = '22023';
  end if;

  insert into public.project_workers (
    workspace_id,
    project_id,
    name,
    phone,
    daily_wage_minor,
    created_by
  )
  values (
    p_workspace_id,
    p_project_id,
    btrim(p_name),
    nullif(btrim(coalesce(p_phone, '')), ''),
    p_daily_wage_minor,
    auth.uid()
  )
  returning * into v_worker;

  return v_worker;
end;
$$;

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

  select * into v_worker
  from public.project_workers
  where workspace_id = p_workspace_id
    and id = p_worker_id
    and project_id = p_project_id
    and status = 'active';

  if v_worker.id is null then
    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;

  select * into v_workspace from public.workspaces where id = p_workspace_id;

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
  on conflict (workspace_id, client_id, operation)
  do update set updated_at = public.project_work_logs.updated_at
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
  v_balance numeric;
begin
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_entry_type not in ('bonus', 'deduction', 'withdrawal', 'adjustment') then
    raise exception 'invalid_entry_type' using errcode = '22023';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select * into v_worker
  from public.project_workers
  where workspace_id = p_workspace_id
    and id = p_worker_id
    and project_id = p_project_id;

  if v_worker.id is null then
    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;

  select * into v_workspace from public.workspaces where id = p_workspace_id;

  -- Worker ledger: earnings positive, withdrawals/deductions negative.
  v_signed := case
    when p_entry_type in ('bonus', 'adjustment') then p_amount_minor
    else -p_amount_minor
  end;

  v_operation := case p_entry_type
    when 'bonus' then 'post_wage_bonus'
    when 'deduction' then 'post_wage_deduction'
    when 'withdrawal' then 'post_wage_withdrawal'
    else 'post_wage_adjustment'
  end;

  select coalesce(sum(amount_minor::numeric), 0)
  into v_balance
  from public.project_work_logs
  where workspace_id = p_workspace_id
    and worker_id = p_worker_id;

  if p_entry_type in ('withdrawal', 'deduction') and (v_balance - p_amount_minor) < 0 then
    raise exception 'insufficient_worker_balance' using errcode = 'P0001';
  end if;

  -- Cash out from a wallet for withdrawals (expense against project).
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

    select (public.post_transaction(
      p_workspace_id := p_workspace_id,
      p_wallet_id := p_wallet_id,
      p_direction := 'out',
      p_amount_minor := p_amount_minor,
      p_category_id := v_category_id,
      p_project_id := p_project_id,
      p_memo := coalesce(p_note, 'سحب أجر عامل: ' || v_worker.name),
      p_client_id := p_client_id
    )).id into v_event_id;
  end if;

  v_payload := jsonb_build_object(
    'worker_id', p_worker_id,
    'entry_type', p_entry_type,
    'amount_minor', p_amount_minor,
    'work_date', p_work_date,
    'wallet_id', p_wallet_id
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
    extensions.digest(v_payload::text, 'sha256')
  )
  on conflict (workspace_id, client_id, operation)
  do update set updated_at = public.project_work_logs.updated_at
  returning * into v_log;

  return v_log;
end;
$$;

grant execute on function public.create_project(
  uuid, text, text, bigint, text, public.project_status, uuid
) to authenticated;

grant execute on function public.update_project(
  uuid, uuid, text, text, bigint, text, public.project_status
) to authenticated;

grant execute on function public.create_project_worker(
  uuid, uuid, text, bigint, text
) to authenticated;

grant execute on function public.record_daily_work(
  uuid, uuid, uuid, date, bigint, text, uuid
) to authenticated;

grant execute on function public.post_wage_movement(
  uuid, uuid, uuid, public.work_log_entry_type, bigint, date, uuid, text, uuid
) to authenticated;
