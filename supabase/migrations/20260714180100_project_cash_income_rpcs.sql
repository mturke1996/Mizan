-- RPCs for project cash, project wallet link, clients, personal income

create or replace function public.upsert_client(
  p_workspace_id uuid,
  p_name text,
  p_phone text default null,
  p_notes text default null,
  p_client_row_id uuid default null
)
returns public.clients
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_row public.clients%rowtype;
  v_name text := btrim(p_name);
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 160 then
    raise exception 'invalid_client_name' using errcode = '22023';
  end if;

  if p_client_row_id is not null then
    update public.clients
       set name = v_name,
           phone = nullif(btrim(coalesce(p_phone, '')), ''),
           notes = nullif(btrim(coalesce(p_notes, '')), ''),
           updated_at = clock_timestamp()
     where workspace_id = p_workspace_id
       and id = p_client_row_id
    returning * into v_row;
    if not found then
      raise exception 'client_not_found' using errcode = 'P0002';
    end if;
    return v_row;
  end if;

  insert into public.clients (workspace_id, name, phone, notes, created_by)
  values (
    p_workspace_id,
    v_name,
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_user_id
  )
  returning * into v_row;
  return v_row;
end;
$fn$;

create or replace function public.set_project_cash_mode(
  p_workspace_id uuid,
  p_project_id uuid,
  p_cash_mode public.project_cash_mode
)
returns public.projects
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_row public.projects%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.projects
     set cash_mode = p_cash_mode,
         updated_at = clock_timestamp()
   where workspace_id = p_workspace_id
     and id = p_project_id
  returning * into v_row;

  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$fn$;

create or replace function public.open_or_link_project_wallet(
  p_workspace_id uuid,
  p_project_id uuid,
  p_client_id uuid,
  p_wallet_id uuid default null,
  p_wallet_name text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_wallet public.wallets%rowtype;
  v_workspace public.workspaces%rowtype;
  v_new_wallet_id uuid;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_client_id is null then
    raise exception 'client_id_required' using errcode = '22023';
  end if;

  select * into v_project
  from public.projects
  where workspace_id = p_workspace_id and id = p_project_id
  for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  select * into v_workspace from public.workspaces where id = p_workspace_id;

  if p_wallet_id is not null then
    select * into v_wallet
    from public.wallets
    where workspace_id = p_workspace_id and id = p_wallet_id and status = 'active'
    for update;
    if not found then
      raise exception 'wallet_not_found' using errcode = 'P0002';
    end if;
    if v_wallet.project_id is not null and v_wallet.project_id is distinct from p_project_id then
      raise exception 'wallet_already_linked' using errcode = 'PT409';
    end if;
    update public.wallets
       set project_id = p_project_id, updated_at = clock_timestamp()
     where id = p_wallet_id;
    v_new_wallet_id := p_wallet_id;
  else
    v_name := coalesce(nullif(btrim(coalesce(p_wallet_name, '')), ''), 'خزينة ' || v_project.name);
    v_new_wallet_id := public.create_wallet(
      p_workspace_id,
      p_client_id,
      v_name,
      v_workspace.default_currency_code,
      0
    );
    update public.wallets
       set project_id = p_project_id, updated_at = clock_timestamp()
     where workspace_id = p_workspace_id and id = v_new_wallet_id;
  end if;

  update public.projects
     set linked_wallet_id = v_new_wallet_id,
         cash_mode = case
           when cash_mode = 'off' then 'project_wallet'::public.project_cash_mode
           when cash_mode = 'project_cash' then 'hybrid'::public.project_cash_mode
           else cash_mode
         end,
         updated_at = clock_timestamp()
   where workspace_id = p_workspace_id and id = p_project_id
  returning * into v_project;

  return v_project;
end;
$fn$;

create or replace function public.post_project_cash_entry(
  p_workspace_id uuid,
  p_project_id uuid,
  p_client_id uuid,
  p_entry_type public.project_cash_entry_type,
  p_amount_minor bigint,
  p_title text,
  p_note text default null,
  p_category_id uuid default null,
  p_business_client_id uuid default null,
  p_occurred_on date default ((timezone('utc', now()))::date)
)
returns public.project_cash_entries
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype;
  v_row public.project_cash_entries%rowtype;
  v_title text := btrim(p_title);
  v_payload jsonb;
  v_hash bytea;
  v_balance bigint;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_client_id is null then
    raise exception 'client_id_required' using errcode = '22023';
  end if;
  if p_entry_type not in ('income', 'expense') then
    raise exception 'invalid_entry_type' using errcode = '22023';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_title is null or char_length(v_title) not between 1 and 200 then
    raise exception 'invalid_title' using errcode = '22023';
  end if;

  select * into v_project
  from public.projects
  where workspace_id = p_workspace_id and id = p_project_id
  for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  if v_project.cash_mode = 'off' then
    raise exception 'project_cash_disabled' using errcode = 'PT409';
  end if;
  if v_project.cash_mode = 'project_wallet' then
    raise exception 'use_project_wallet' using errcode = 'PT409';
  end if;

  select * into v_workspace from public.workspaces where id = p_workspace_id;

  select coalesce(balance_minor, 0) into v_balance
  from public.project_cash_balances
  where workspace_id = p_workspace_id and project_id = p_project_id;

  if p_entry_type = 'expense' and coalesce(v_balance, 0) < p_amount_minor then
    raise exception 'insufficient_project_cash' using errcode = 'PT409';
  end if;

  v_payload := jsonb_build_object(
    'amount_minor', p_amount_minor,
    'entry_type', p_entry_type,
    'project_id', p_project_id,
    'title', v_title,
    'occurred_on', p_occurred_on
  );
  v_hash := private.payload_hash(v_payload);

  insert into public.project_cash_entries (
    workspace_id, project_id, entry_type, amount_minor, currency_code,
    title, note, category_id, business_client_id, occurred_on,
    created_by, client_id, operation, payload_hash
  ) values (
    p_workspace_id, p_project_id, p_entry_type, p_amount_minor,
    v_workspace.default_currency_code, v_title,
    nullif(btrim(coalesce(p_note, '')), ''),
    p_category_id, p_business_client_id, p_occurred_on,
    v_user_id, p_client_id, 'post_project_cash_entry', v_hash
  )
  on conflict (workspace_id, client_id, operation) do update
    set title = excluded.title
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.transfer_project_cash_to_wallet(
  p_workspace_id uuid,
  p_project_id uuid,
  p_wallet_id uuid,
  p_amount_minor bigint,
  p_client_id uuid,
  p_note text default null
)
returns public.project_cash_entries
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_workspace public.workspaces%rowtype;
  v_balance bigint;
  v_event_id uuid;
  v_row public.project_cash_entries%rowtype;
  v_payload jsonb;
  v_hash bytea;
  v_title text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_client_id is null then
    raise exception 'client_id_required' using errcode = '22023';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select * into v_project
  from public.projects
  where workspace_id = p_workspace_id and id = p_project_id
  for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  select coalesce(balance_minor, 0) into v_balance
  from public.project_cash_balances
  where workspace_id = p_workspace_id and project_id = p_project_id;

  if coalesce(v_balance, 0) < p_amount_minor then
    raise exception 'insufficient_project_cash' using errcode = 'PT409';
  end if;

  select * into v_workspace from public.workspaces where id = p_workspace_id;
  v_title := 'ترحيل من مشروع ' || v_project.name;

  v_event_id := public.post_transaction(
    p_workspace_id,
    p_client_id,
    p_wallet_id,
    'income',
    p_amount_minor,
    null,
    coalesce(nullif(btrim(coalesce(p_note, '')), ''), v_title),
    null,
    p_project_id
  );

  v_payload := jsonb_build_object(
    'amount_minor', p_amount_minor,
    'entry_type', 'transfer_out',
    'project_id', p_project_id,
    'wallet_id', p_wallet_id
  );
  v_hash := private.payload_hash(v_payload);

  insert into public.project_cash_entries (
    workspace_id, project_id, entry_type, amount_minor, currency_code,
    title, note, wallet_id, financial_event_id, occurred_on,
    created_by, client_id, operation, payload_hash
  ) values (
    p_workspace_id, p_project_id, 'transfer_out', p_amount_minor,
    v_workspace.default_currency_code, v_title,
    nullif(btrim(coalesce(p_note, '')), ''),
    p_wallet_id, v_event_id, (timezone('utc', now()))::date,
    v_user_id, p_client_id, 'transfer_project_cash_to_wallet', v_hash
  )
  on conflict (workspace_id, client_id, operation) do update
    set title = excluded.title
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.create_income_source(
  p_workspace_id uuid,
  p_name text,
  p_pay_kind public.income_pay_kind,
  p_default_daily_wage_minor bigint default 0,
  p_monthly_salary_minor bigint default 0,
  p_place_label text default null,
  p_notes text default null
)
returns public.income_sources
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_workspace public.workspaces%rowtype;
  v_row public.income_sources%rowtype;
  v_name text := btrim(p_name);
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 160 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if coalesce(p_default_daily_wage_minor, 0) < 0
     or coalesce(p_monthly_salary_minor, 0) < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select * into v_workspace from public.workspaces where id = p_workspace_id;

  insert into public.income_sources (
    workspace_id, name, place_label, pay_kind,
    default_daily_wage_minor, monthly_salary_minor,
    currency_code, notes, created_by
  ) values (
    p_workspace_id, v_name,
    nullif(btrim(coalesce(p_place_label, '')), ''),
    p_pay_kind,
    coalesce(p_default_daily_wage_minor, 0),
    coalesce(p_monthly_salary_minor, 0),
    v_workspace.default_currency_code,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_user_id
  )
  returning * into v_row;
  return v_row;
end;
$fn$;

create or replace function public.post_income_entry(
  p_workspace_id uuid,
  p_source_id uuid,
  p_client_id uuid,
  p_entry_type public.income_entry_type,
  p_amount_minor bigint,
  p_work_on date default null,
  p_period_key text default null,
  p_reason text default null,
  p_note text default null,
  p_wallet_id uuid default null
)
returns public.income_entries
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_source public.income_sources%rowtype;
  v_row public.income_entries%rowtype;
  v_payload jsonb;
  v_hash bytea;
  v_event_id uuid;
  v_outstanding bigint;
  v_amount bigint := p_amount_minor;
  v_reason text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_client_id is null then
    raise exception 'client_id_required' using errcode = '22023';
  end if;

  select * into v_source
  from public.income_sources
  where workspace_id = p_workspace_id and id = p_source_id and status = 'active'
  for update;
  if not found then
    raise exception 'income_source_not_found' using errcode = 'P0002';
  end if;

  if p_entry_type = 'daily_wage' then
    if p_work_on is null then
      raise exception 'work_on_required' using errcode = '22023';
    end if;
    if v_amount is null or v_amount <= 0 then
      v_amount := nullif(v_source.default_daily_wage_minor, 0);
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
    v_reason := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'يومية');
  elsif p_entry_type = 'salary_accrual' then
    if v_amount is null or v_amount <= 0 then
      v_amount := nullif(v_source.monthly_salary_minor, 0);
    end if;
    if v_amount is null or v_amount <= 0 then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
    v_reason := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'استحقاق راتب');
  elsif p_entry_type in ('bonus', 'deduction') then
    if v_amount is null or v_amount <= 0 then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
    v_reason := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), p_entry_type::text);
  elsif p_entry_type = 'withdrawal' then
    if v_amount is null or v_amount <= 0 then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
    if p_wallet_id is null then
      raise exception 'wallet_required' using errcode = '22023';
    end if;
    select coalesce(outstanding_minor, 0) into v_outstanding
    from public.income_source_balances
    where workspace_id = p_workspace_id and source_id = p_source_id;
    if coalesce(v_outstanding, 0) < v_amount then
      raise exception 'insufficient_outstanding' using errcode = 'PT409';
    end if;
    v_reason := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'قبض مستحقات');
    v_event_id := public.post_transaction(
      p_workspace_id,
      p_client_id,
      p_wallet_id,
      'income',
      v_amount,
      null,
      v_reason || ' · ' || v_source.name,
      null,
      null
    );
  else
    raise exception 'invalid_entry_type' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'amount_minor', v_amount,
    'entry_type', p_entry_type,
    'source_id', p_source_id,
    'work_on', p_work_on,
    'period_key', p_period_key,
    'wallet_id', p_wallet_id
  );
  v_hash := private.payload_hash(v_payload);

  insert into public.income_entries (
    workspace_id, source_id, entry_type, amount_minor, currency_code,
    work_on, period_key, reason, note, wallet_id, financial_event_id,
    created_by, client_id, operation, payload_hash
  ) values (
    p_workspace_id, p_source_id, p_entry_type, v_amount, v_source.currency_code,
    p_work_on, nullif(btrim(coalesce(p_period_key, '')), ''),
    v_reason, nullif(btrim(coalesce(p_note, '')), ''),
    p_wallet_id, v_event_id,
    v_user_id, p_client_id, 'post_income_entry', v_hash
  )
  on conflict (workspace_id, client_id, operation) do update
    set reason = excluded.reason
  returning * into v_row;

  return v_row;
end;
$fn$;

revoke all on function public.upsert_client(uuid, text, text, text, uuid) from public;
revoke all on function public.set_project_cash_mode(uuid, uuid, public.project_cash_mode) from public;
revoke all on function public.open_or_link_project_wallet(uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.post_project_cash_entry(uuid, uuid, uuid, public.project_cash_entry_type, bigint, text, text, uuid, uuid, date) from public;
revoke all on function public.transfer_project_cash_to_wallet(uuid, uuid, uuid, bigint, uuid, text) from public;
revoke all on function public.create_income_source(uuid, text, public.income_pay_kind, bigint, bigint, text, text) from public;
revoke all on function public.post_income_entry(uuid, uuid, uuid, public.income_entry_type, bigint, date, text, text, text, uuid) from public;

grant execute on function public.upsert_client(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.set_project_cash_mode(uuid, uuid, public.project_cash_mode) to authenticated;
grant execute on function public.open_or_link_project_wallet(uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.post_project_cash_entry(uuid, uuid, uuid, public.project_cash_entry_type, bigint, text, text, uuid, uuid, date) to authenticated;
grant execute on function public.transfer_project_cash_to_wallet(uuid, uuid, uuid, bigint, uuid, text) to authenticated;
grant execute on function public.create_income_source(uuid, text, public.income_pay_kind, bigint, bigint, text, text) to authenticated;
grant execute on function public.post_income_entry(uuid, uuid, uuid, public.income_entry_type, bigint, date, text, text, text, uuid) to authenticated;
