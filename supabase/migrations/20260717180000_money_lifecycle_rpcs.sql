-- Money lifecycle: update/archive for debts, wallets, and income sources.

alter table public.debts
  add column if not exists archived_at timestamptz;

create index if not exists debts_workspace_active_idx
  on public.debts (workspace_id, created_at desc)
  where archived_at is null;

-- Recreate debt projections so summaries ignore archived debts.
drop view if exists public.debt_summaries;
drop view if exists public.debt_balances;

create view public.debt_balances
with (security_invoker = true)
as
select
  debt.id,
  debt.workspace_id,
  debt.party_id,
  party.name as party_name,
  party.phone as party_phone,
  debt.direction,
  debt.principal_minor::numeric::text as principal_minor,
  totals.balance_minor::text as balance_minor,
  totals.paid_minor::text as paid_minor,
  totals.adjusted_minor::text as adjusted_minor,
  totals.written_off_minor::text as written_off_minor,
  debt.currency_code,
  case
    when totals.balance_minor = 0
     and debt.status = 'written_off'
      then 'written_off'::public.debt_status
    when totals.balance_minor = 0
      then 'settled'::public.debt_status
    when totals.non_open_count = 0
      then 'open'::public.debt_status
    else 'partial'::public.debt_status
  end as status,
  debt.due_on,
  debt.project_id,
  project.name as project_name,
  debt.note,
  debt.archived_at,
  debt.created_by,
  debt.created_at,
  debt.updated_at
from public.debts as debt
join public.debt_parties as party
  on party.workspace_id = debt.workspace_id
 and party.id = debt.party_id
left join public.projects as project
  on project.workspace_id = debt.workspace_id
 and project.id = debt.project_id
left join lateral (
  select
    coalesce(
      pg_catalog.sum(entry.amount_minor::numeric),
      0::numeric
    ) as balance_minor,
    coalesce(
      -pg_catalog.sum(entry.amount_minor::numeric)
        filter (where entry.entry_type = 'payment'),
      0::numeric
    ) as paid_minor,
    coalesce(
      pg_catalog.sum(entry.amount_minor::numeric)
        filter (where entry.entry_type = 'adjustment'),
      0::numeric
    ) as adjusted_minor,
    coalesce(
      -pg_catalog.sum(entry.amount_minor::numeric)
        filter (where entry.entry_type = 'write_off'),
      0::numeric
    ) as written_off_minor,
    pg_catalog.count(*)
      filter (where entry.entry_type <> 'open') as non_open_count
  from public.debt_entries as entry
  where entry.workspace_id = debt.workspace_id
    and entry.debt_id = debt.id
) as totals on true;

create view public.debt_summaries
with (security_invoker = true)
as
select
  balance.workspace_id,
  balance.currency_code,
  coalesce(
    pg_catalog.sum(balance.balance_minor::numeric)
      filter (
        where balance.direction = 'receivable'
          and balance.balance_minor::numeric > 0
      ),
    0::numeric
  )::text as receivable_minor,
  coalesce(
    pg_catalog.sum(balance.balance_minor::numeric)
      filter (
        where balance.direction = 'payable'
          and balance.balance_minor::numeric > 0
      ),
    0::numeric
  )::text as payable_minor,
  (
    coalesce(
      pg_catalog.sum(balance.balance_minor::numeric)
        filter (
          where balance.direction = 'receivable'
            and balance.balance_minor::numeric > 0
        ),
      0::numeric
    )
    -
    coalesce(
      pg_catalog.sum(balance.balance_minor::numeric)
        filter (
          where balance.direction = 'payable'
            and balance.balance_minor::numeric > 0
        ),
      0::numeric
    )
  )::text as net_minor,
  pg_catalog.count(*)
    filter (
      where balance.balance_minor::numeric > 0
        and balance.status in ('open', 'partial')
    ) as open_count,
  pg_catalog.count(*)
    filter (
      where balance.balance_minor::numeric > 0
        and balance.status in ('open', 'partial')
        and balance.due_on < current_date
    ) as overdue_count,
  pg_catalog.count(*)
    filter (
      where balance.balance_minor::numeric > 0
        and balance.status in ('open', 'partial')
        and balance.due_on between current_date and current_date + 7
    ) as due_soon_count
from public.debt_balances as balance
where balance.archived_at is null
group by balance.workspace_id, balance.currency_code;

comment on view public.debt_balances is
  'RLS-aware debt list/detail projection with exact monetary values returned as text.';
comment on view public.debt_summaries is
  'RLS-aware outstanding receivable/payable totals by workspace and currency (active debts only).';

revoke all on table public.debt_balances from public, anon;
revoke all on table public.debt_summaries from public, anon;
grant select on public.debt_balances to authenticated;
grant select on public.debt_summaries to authenticated;

-- ─── Debts ────────────────────────────────────────────────────

create or replace function public.update_debt(
  p_workspace_id uuid,
  p_debt_id uuid,
  p_party_name text default null,
  p_party_phone text default null,
  p_due_on date default null,
  p_note text default null,
  p_clear_due_on boolean default false
)
returns public.debts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_party public.debt_parties%rowtype;
  v_name text;
  v_phone text;
  v_note text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_debt
  from public.debts
  where workspace_id = p_workspace_id
    and id = p_debt_id
    and archived_at is null
  for update;

  if not found then
    raise exception 'debt_not_found' using errcode = 'P0002';
  end if;

  select * into v_party
  from public.debt_parties
  where workspace_id = p_workspace_id
    and id = v_debt.party_id
  for update;

  if p_party_name is not null then
    v_name := pg_catalog.btrim(p_party_name);
    if pg_catalog.char_length(v_name) not between 1 and 160 then
      raise exception 'invalid_party_name' using errcode = '22023';
    end if;
    update public.debt_parties
       set name = v_name,
           updated_at = pg_catalog.clock_timestamp()
     where workspace_id = p_workspace_id
       and id = v_party.id;
  end if;

  if p_party_phone is not null then
    v_phone := nullif(pg_catalog.btrim(p_party_phone), '');
    if v_phone is not null
       and pg_catalog.char_length(v_phone) > 50 then
      raise exception 'invalid_party_phone' using errcode = '22023';
    end if;
    update public.debt_parties
       set phone = v_phone,
           updated_at = pg_catalog.clock_timestamp()
     where workspace_id = p_workspace_id
       and id = v_party.id;
  end if;

  if p_note is not null then
    v_note := nullif(pg_catalog.btrim(p_note), '');
    if v_note is not null and pg_catalog.char_length(v_note) > 1000 then
      raise exception 'invalid_note' using errcode = '22023';
    end if;
  end if;

  update public.debts
     set due_on = case
           when p_clear_due_on then null
           when p_due_on is not null then p_due_on
           else due_on
         end,
         note = case
           when p_note is not null then v_note
           else note
         end,
         updated_at = pg_catalog.clock_timestamp()
   where workspace_id = p_workspace_id
     and id = p_debt_id
  returning * into v_debt;

  return v_debt;
end;
$$;

create or replace function public.archive_debt(
  p_workspace_id uuid,
  p_debt_id uuid
)
returns public.debts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_debt
  from public.debts
  where workspace_id = p_workspace_id
    and id = p_debt_id
  for update;

  if not found then
    raise exception 'debt_not_found' using errcode = 'P0002';
  end if;

  if v_debt.archived_at is null then
    update public.debts
       set archived_at = pg_catalog.clock_timestamp(),
           updated_at = pg_catalog.clock_timestamp()
     where workspace_id = p_workspace_id
       and id = p_debt_id
    returning * into v_debt;
  end if;

  return v_debt;
end;
$$;

-- ─── Wallets ──────────────────────────────────────────────────

create or replace function public.rename_wallet(
  p_workspace_id uuid,
  p_wallet_id uuid,
  p_name text
)
returns public.wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_name text := pg_catalog.btrim(p_name);
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_name is null or pg_catalog.char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_wallet_name' using errcode = '22023';
  end if;

  select * into v_wallet
  from public.wallets
  where workspace_id = p_workspace_id
    and id = p_wallet_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'wallet_not_found' using errcode = 'P0002';
  end if;

  update public.wallets
     set name = v_name,
         updated_at = pg_catalog.clock_timestamp()
   where workspace_id = p_workspace_id
     and id = p_wallet_id
  returning * into v_wallet;

  return v_wallet;
end;
$$;

create or replace function public.archive_wallet(
  p_workspace_id uuid,
  p_wallet_id uuid
)
returns public.wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_balance numeric;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_wallet
  from public.wallets
  where workspace_id = p_workspace_id
    and id = p_wallet_id
  for update;

  if not found then
    raise exception 'wallet_not_found' using errcode = 'P0002';
  end if;

  if v_wallet.status = 'archived' then
    return v_wallet;
  end if;

  select coalesce(balance.balance_minor::numeric, 0)
    into v_balance
  from public.wallet_balances as balance
  where balance.workspace_id = p_workspace_id
    and balance.id = p_wallet_id;

  if coalesce(v_balance, 0) <> 0 then
    raise exception 'wallet_balance_not_zero' using errcode = 'P0001';
  end if;

  update public.wallets
     set status = 'archived',
         updated_at = pg_catalog.clock_timestamp()
   where workspace_id = p_workspace_id
     and id = p_wallet_id
  returning * into v_wallet;

  return v_wallet;
end;
$$;

-- ─── Income sources ───────────────────────────────────────────

create or replace function public.update_income_source(
  p_workspace_id uuid,
  p_source_id uuid,
  p_name text default null,
  p_place_label text default null,
  p_pay_kind public.income_pay_kind default null,
  p_default_daily_wage_minor bigint default null,
  p_monthly_salary_minor bigint default null
)
returns public.income_sources
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_row public.income_sources%rowtype;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row
  from public.income_sources
  where workspace_id = p_workspace_id
    and id = p_source_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'income_source_not_found' using errcode = 'P0002';
  end if;

  if p_name is not null then
    v_name := btrim(p_name);
    if v_name is null or char_length(v_name) not between 1 and 160 then
      raise exception 'invalid_name' using errcode = '22023';
    end if;
  end if;

  if p_default_daily_wage_minor is not null and p_default_daily_wage_minor < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_monthly_salary_minor is not null and p_monthly_salary_minor < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  update public.income_sources
     set name = coalesce(v_name, name),
         place_label = case
           when p_place_label is null then place_label
           else nullif(btrim(p_place_label), '')
         end,
         pay_kind = coalesce(p_pay_kind, pay_kind),
         default_daily_wage_minor = coalesce(
           p_default_daily_wage_minor,
           default_daily_wage_minor
         ),
         monthly_salary_minor = coalesce(
           p_monthly_salary_minor,
           monthly_salary_minor
         ),
         updated_at = clock_timestamp()
   where workspace_id = p_workspace_id
     and id = p_source_id
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.archive_income_source(
  p_workspace_id uuid,
  p_source_id uuid
)
returns public.income_sources
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_row public.income_sources%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row
  from public.income_sources
  where workspace_id = p_workspace_id
    and id = p_source_id
  for update;

  if not found then
    raise exception 'income_source_not_found' using errcode = 'P0002';
  end if;

  if v_row.status <> 'archived' then
    update public.income_sources
       set status = 'archived',
           updated_at = clock_timestamp()
     where workspace_id = p_workspace_id
       and id = p_source_id
    returning * into v_row;
  end if;

  return v_row;
end;
$fn$;

revoke all on function public.update_debt(uuid, uuid, text, text, date, text, boolean) from public, anon;
revoke all on function public.archive_debt(uuid, uuid) from public, anon;
revoke all on function public.rename_wallet(uuid, uuid, text) from public, anon;
revoke all on function public.archive_wallet(uuid, uuid) from public, anon;
revoke all on function public.update_income_source(
  uuid, uuid, text, text, public.income_pay_kind, bigint, bigint
) from public, anon;
revoke all on function public.archive_income_source(uuid, uuid) from public, anon;

grant execute on function public.update_debt(uuid, uuid, text, text, date, text, boolean) to authenticated;
grant execute on function public.archive_debt(uuid, uuid) to authenticated;
grant execute on function public.rename_wallet(uuid, uuid, text) to authenticated;
grant execute on function public.archive_wallet(uuid, uuid) to authenticated;
grant execute on function public.update_income_source(
  uuid, uuid, text, text, public.income_pay_kind, bigint, bigint
) to authenticated;
grant execute on function public.archive_income_source(uuid, uuid) to authenticated;
