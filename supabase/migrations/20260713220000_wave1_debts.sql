-- Wave 1: workspace-scoped receivables and payables.
-- Debt balances are derived from immutable signed entries. Wallet-backed
-- payments post a matching income/expense event in the same transaction.

create type public.debt_direction as enum ('receivable', 'payable');
create type public.debt_status as enum (
  'open',
  'partial',
  'settled',
  'written_off'
);
create type public.debt_entry_type as enum (
  'open',
  'payment',
  'adjustment',
  'write_off'
);

alter type private.idempotency_operation
  add value if not exists 'create_debt';
alter type private.idempotency_operation
  add value if not exists 'post_debt_entry';

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
      'post_debt_payment'
    )
  );

create table public.debt_parties (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  name text not null,
  phone text,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint debt_parties_workspace_id_id unique (workspace_id, id),
  constraint debt_parties_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint debt_parties_name_shape
    check (
      name = pg_catalog.btrim(name)
      and pg_catalog.char_length(name) between 1 and 160
    ),
  constraint debt_parties_phone_shape
    check (
      phone is null
      or (
        phone = pg_catalog.btrim(phone)
        and pg_catalog.char_length(phone) between 1 and 50
      )
    ),
  constraint debt_parties_notes_length
    check (notes is null or pg_catalog.char_length(notes) <= 1000)
);

create unique index debt_parties_workspace_identity_unique
  on public.debt_parties (
    workspace_id,
    pg_catalog.lower(name),
    coalesce(phone, '')
  );

create table public.debts (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  party_id uuid not null,
  direction public.debt_direction not null,
  principal_minor bigint not null,
  currency_code text not null references public.currencies (code),
  status public.debt_status not null default 'open',
  due_on date,
  project_id uuid,
  note text,
  created_by uuid not null references public.profiles (id),
  client_id uuid not null,
  payload_hash bytea not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint debts_workspace_id_id unique (workspace_id, id),
  constraint debts_workspace_id_currency unique (
    workspace_id,
    id,
    currency_code
  ),
  constraint debts_party_fk
    foreign key (workspace_id, party_id)
    references public.debt_parties (workspace_id, id),
  constraint debts_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint debts_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint debts_idempotency_unique
    unique (workspace_id, client_id),
  constraint debts_positive_principal
    check (principal_minor > 0),
  constraint debts_payload_hash_length
    check (pg_catalog.octet_length(payload_hash) = 32),
  constraint debts_note_length
    check (note is null or pg_catalog.char_length(note) <= 1000)
);

create table public.debt_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  debt_id uuid not null,
  entry_type public.debt_entry_type not null,
  amount_minor bigint not null,
  currency_code text not null references public.currencies (code),
  occurred_on date not null,
  note text,
  financial_event_id uuid,
  created_by uuid not null references public.profiles (id),
  client_id uuid not null,
  operation text not null,
  payload_hash bytea not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint debt_entries_workspace_id_id unique (workspace_id, id),
  constraint debt_entries_debt_currency_fk
    foreign key (workspace_id, debt_id, currency_code)
    references public.debts (workspace_id, id, currency_code),
  constraint debt_entries_financial_event_fk
    foreign key (workspace_id, financial_event_id, currency_code)
    references public.financial_events (workspace_id, id, currency_code),
  constraint debt_entries_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint debt_entries_idempotency_unique
    unique (workspace_id, client_id, operation),
  constraint debt_entries_signed_amount
    check (
      (entry_type = 'open' and amount_minor > 0)
      or (entry_type = 'payment' and amount_minor < 0)
      or (entry_type = 'adjustment' and amount_minor <> 0)
      or (entry_type = 'write_off' and amount_minor < 0)
    ),
  constraint debt_entries_operation_shape
    check (
      (entry_type = 'open' and operation = 'create_debt_open')
      or (entry_type = 'payment' and operation = 'post_debt_payment')
      or (entry_type = 'adjustment' and operation = 'post_debt_adjustment')
      or (entry_type = 'write_off' and operation = 'post_debt_write_off')
    ),
  constraint debt_entries_payload_hash_length
    check (pg_catalog.octet_length(payload_hash) = 32),
  constraint debt_entries_note_length
    check (note is null or pg_catalog.char_length(note) <= 1000),
  constraint debt_entries_wallet_event_shape
    check (
      financial_event_id is null
      or entry_type = 'payment'
    )
);

comment on table public.debt_entries is
  'Append-only signed debt ledger: opening/positive adjustments increase balances; payments, write-offs, and negative adjustments reduce them.';
comment on column public.debt_entries.amount_minor is
  'Signed bigint minor units. Payments and write-offs are negative.';
comment on column public.debts.status is
  'Closure marker maintained atomically by debt RPCs; list balances remain derived from immutable entries.';

create unique index debt_entries_one_opening
  on public.debt_entries (workspace_id, debt_id)
  where entry_type = 'open';
create unique index debt_entries_one_financial_event
  on public.debt_entries (workspace_id, financial_event_id)
  where financial_event_id is not null;
create index debt_parties_workspace_name_idx
  on public.debt_parties (workspace_id, name, id);
create index debts_workspace_status_due_idx
  on public.debts (workspace_id, status, due_on, created_at desc);
create index debts_workspace_direction_status_idx
  on public.debts (workspace_id, direction, status, created_at desc);
create index debts_workspace_party_idx
  on public.debts (workspace_id, party_id, created_at desc);
create index debts_workspace_project_idx
  on public.debts (workspace_id, project_id, created_at desc)
  where project_id is not null;
create index debt_entries_debt_occurred_idx
  on public.debt_entries (
    workspace_id,
    debt_id,
    occurred_on desc,
    created_at desc
  );

create trigger debt_parties_set_updated_at
before update on public.debt_parties
for each row execute function private.set_updated_at();

create trigger debts_set_updated_at
before update on public.debts
for each row execute function private.set_updated_at();

create trigger debt_entries_immutable
before update or delete on public.debt_entries
for each row execute function private.reject_row_mutation();

alter table public.debt_parties enable row level security;
alter table public.debts enable row level security;
alter table public.debt_entries enable row level security;

create policy debt_parties_select_member
on public.debt_parties
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy debts_select_member
on public.debts
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy debt_entries_select_member
on public.debt_entries
for select
to authenticated
using (private.is_workspace_member(workspace_id));

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
group by balance.workspace_id, balance.currency_code;

create view public.debt_entry_details
with (security_invoker = true)
as
select
  entry.id,
  entry.workspace_id,
  entry.debt_id,
  entry.entry_type,
  entry.amount_minor::numeric::text as amount_minor,
  entry.currency_code,
  entry.occurred_on,
  entry.note,
  entry.financial_event_id,
  entry.created_by,
  entry.client_id,
  entry.operation,
  entry.created_at
from public.debt_entries as entry;

comment on view public.debt_balances is
  'RLS-aware debt list/detail projection with exact monetary values returned as text.';
comment on view public.debt_summaries is
  'RLS-aware outstanding receivable/payable totals by workspace and currency.';
comment on view public.debt_entry_details is
  'RLS-aware append-only debt timeline with exact monetary values returned as text.';

create function public.create_debt(
  p_workspace_id uuid,
  p_client_id uuid,
  p_direction public.debt_direction,
  p_principal_minor bigint,
  p_currency_code text,
  p_party_name text,
  p_party_phone text default null,
  p_party_notes text default null,
  p_due_on date default null,
  p_project_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := pg_catalog.upper(
    pg_catalog.btrim(coalesce(p_currency_code, ''))
  );
  v_party_name text := pg_catalog.btrim(coalesce(p_party_name, ''));
  v_party_phone text := nullif(
    pg_catalog.btrim(coalesce(p_party_phone, '')),
    ''
  );
  v_party_notes text := nullif(
    pg_catalog.btrim(coalesce(p_party_notes, '')),
    ''
  );
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_workspace public.workspaces%rowtype;
  v_party_id uuid;
  v_debt_id uuid;
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

  if p_direction is null then
    raise exception using
      errcode = '22023',
      message = 'debt direction is required';
  end if;

  if p_principal_minor is null or p_principal_minor <= 0 then
    raise exception using
      errcode = '22023',
      message = 'debt principal must be positive';
  end if;

  if pg_catalog.char_length(v_party_name) not between 1 and 160 then
    raise exception using
      errcode = '22023',
      message = 'debt party name must contain 1 to 160 characters';
  end if;

  if v_party_phone is not null
     and pg_catalog.char_length(v_party_phone) > 50
  then
    raise exception using
      errcode = '22023',
      message = 'debt party phone cannot exceed 50 characters';
  end if;

  if v_party_notes is not null
     and pg_catalog.char_length(v_party_notes) > 1000
  then
    raise exception using
      errcode = '22023',
      message = 'debt party notes cannot exceed 1000 characters';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'debt note cannot exceed 1000 characters';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'currency_code', v_currency_code,
    'direction', p_direction::text,
    'due_on', p_due_on,
    'note', v_note,
    'party_name', v_party_name,
    'party_notes', v_party_notes,
    'party_phone', v_party_phone,
    'principal_minor', p_principal_minor,
    'project_id', p_project_id
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'create_debt',
    v_payload_hash
  );

  if v_existing_result is not null then
    return (v_existing_result ->> 'debt_id')::uuid;
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'workspace writes are unavailable for the current entitlement';
  end if;

  select workspace.*
    into v_workspace
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
      message = 'active debt currency not found';
  end if;

  if p_project_id is not null then
    perform 1
      from public.projects as project
     where project.workspace_id = p_workspace_id
       and project.id = p_project_id
       and project.status = 'active';

    if not found then
      raise exception using
        errcode = '22023',
        message = 'project must be active and in the workspace';
    end if;

    if v_currency_code <> v_workspace.default_currency_code then
      raise exception using
        errcode = '22023',
        message = 'project-linked debts must use the workspace default currency';
    end if;
  end if;

  insert into public.debt_parties (
    workspace_id,
    name,
    phone,
    notes,
    created_by
  )
  values (
    p_workspace_id,
    v_party_name,
    v_party_phone,
    v_party_notes,
    v_user_id
  )
  on conflict do nothing
  returning id into v_party_id;

  if v_party_id is null then
    select party.id
      into v_party_id
      from public.debt_parties as party
     where party.workspace_id = p_workspace_id
       and pg_catalog.lower(party.name) = pg_catalog.lower(v_party_name)
       and coalesce(party.phone, '') = coalesce(v_party_phone, '');
  end if;

  if v_party_id is null then
    raise exception using
      errcode = '55000',
      message = 'debt party could not be resolved';
  end if;

  v_debt_id := extensions.gen_random_uuid();

  insert into public.debts (
    id,
    workspace_id,
    party_id,
    direction,
    principal_minor,
    currency_code,
    status,
    due_on,
    project_id,
    note,
    created_by,
    client_id,
    payload_hash
  )
  values (
    v_debt_id,
    p_workspace_id,
    v_party_id,
    p_direction,
    p_principal_minor,
    v_currency_code,
    'open',
    p_due_on,
    p_project_id,
    v_note,
    v_user_id,
    p_client_id,
    v_payload_hash
  );

  insert into public.debt_entries (
    workspace_id,
    debt_id,
    entry_type,
    amount_minor,
    currency_code,
    occurred_on,
    note,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    p_workspace_id,
    v_debt_id,
    'open',
    p_principal_minor,
    v_currency_code,
    current_date,
    v_note,
    v_user_id,
    p_client_id,
    'create_debt_open',
    v_payload_hash
  );

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'create_debt',
    pg_catalog.jsonb_build_object('debt_id', v_debt_id)
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'debt.created',
    'debts',
    v_debt_id,
    pg_catalog.jsonb_build_object(
      'currency_code', v_currency_code,
      'direction', p_direction::text,
      'principal_minor', p_principal_minor,
      'project_id', p_project_id
    )
  );

  return v_debt_id;
end;
$$;

create function public.post_debt_entry(
  p_workspace_id uuid,
  p_debt_id uuid,
  p_entry_type public.debt_entry_type,
  p_amount_minor bigint,
  p_occurred_on date,
  p_wallet_id uuid,
  p_note text,
  p_client_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  v_operation text;
  v_payload jsonb;
  v_payload_hash bytea;
  v_existing_result jsonb;
  v_debt public.debts%rowtype;
  v_wallet public.wallets%rowtype;
  v_balance numeric;
  v_next_balance numeric;
  v_entry_id uuid;
  v_event_id uuid;
  v_offset_account_id uuid;
  v_transaction_kind public.transaction_kind;
  v_wallet_amount bigint;
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

  if p_entry_type is null or p_entry_type = 'open' then
    raise exception using
      errcode = '22023',
      message = 'debt entry type must be payment, adjustment, or write_off';
  end if;

  if p_amount_minor is null or p_amount_minor = 0 then
    raise exception using
      errcode = '22023',
      message = 'debt entry amount cannot be zero';
  end if;

  if p_entry_type in ('payment', 'write_off') and p_amount_minor >= 0 then
    raise exception using
      errcode = '22023',
      message = 'debt payments and write-offs must be negative';
  end if;

  if p_occurred_on is null then
    raise exception using
      errcode = '22023',
      message = 'debt entry date is required';
  end if;

  if v_note is not null and pg_catalog.char_length(v_note) > 1000 then
    raise exception using
      errcode = '22023',
      message = 'debt entry note cannot exceed 1000 characters';
  end if;

  if p_wallet_id is not null and p_entry_type <> 'payment' then
    raise exception using
      errcode = '22023',
      message = 'a wallet can only be linked to a debt payment';
  end if;

  v_operation := case p_entry_type
    when 'payment' then 'post_debt_payment'
    when 'adjustment' then 'post_debt_adjustment'
    when 'write_off' then 'post_debt_write_off'
  end;

  v_payload := pg_catalog.jsonb_build_object(
    'amount_minor', p_amount_minor,
    'debt_id', p_debt_id,
    'entry_type', p_entry_type::text,
    'note', v_note,
    'occurred_on', p_occurred_on,
    'wallet_id', p_wallet_id
  );
  v_payload_hash := private.payload_hash(v_payload);
  v_existing_result := private.begin_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'post_debt_entry',
    v_payload_hash
  );

  if v_existing_result is not null then
    return (v_existing_result ->> 'entry_id')::uuid;
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception using
      errcode = '42501',
      message = 'workspace writes are unavailable for the current entitlement';
  end if;

  select debt.*
    into v_debt
    from public.debts as debt
   where debt.workspace_id = p_workspace_id
     and debt.id = p_debt_id
   for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'debt not found in workspace';
  end if;

  if v_debt.status in ('settled', 'written_off') then
    raise exception using
      errcode = '55000',
      message = 'closed debt cannot receive new entries';
  end if;

  select coalesce(
           pg_catalog.sum(entry.amount_minor::numeric),
           0::numeric
         )
    into v_balance
    from public.debt_entries as entry
   where entry.workspace_id = p_workspace_id
     and entry.debt_id = p_debt_id;

  v_next_balance := v_balance + p_amount_minor::numeric;

  if v_next_balance < 0 then
    raise exception using
      errcode = '22003',
      message = 'debt entry cannot exceed the outstanding balance';
  end if;

  if p_entry_type = 'write_off'
     and -(p_amount_minor::numeric) <> v_balance
  then
    raise exception using
      errcode = '22023',
      message = 'write-off must equal the full outstanding balance';
  end if;

  if p_entry_type = 'payment' and p_wallet_id is not null then
    if -(p_amount_minor::numeric) > 9223372036854775807::numeric then
      raise exception using
        errcode = '22003',
        message = 'wallet-backed debt payment is outside bigint range';
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

    if v_wallet.currency_code <> v_debt.currency_code then
      raise exception using
        errcode = '22023',
        message = 'wallet currency must match debt currency';
    end if;

    if v_debt.direction = 'payable'
       and private.wallet_balance(p_workspace_id, p_wallet_id)
         < -(p_amount_minor::numeric)
    then
      raise exception using
        errcode = '22003',
        message = 'insufficient wallet funds';
    end if;

    perform private.ensure_system_accounts(
      p_workspace_id,
      v_debt.currency_code,
      v_user_id
    );

    v_transaction_kind := case
      when v_debt.direction = 'receivable'
        then 'income'::public.transaction_kind
      else 'expense'::public.transaction_kind
    end;

    select account.id
      into v_offset_account_id
      from public.ledger_accounts as account
     where account.workspace_id = p_workspace_id
       and account.currency_code = v_debt.currency_code
       and account.system_key::text = v_transaction_kind::text;

    if v_offset_account_id is null then
      raise exception using
        errcode = '55000',
        message = 'debt payment offset account is unavailable';
    end if;

    v_event_id := extensions.gen_random_uuid();
    v_event_time := p_occurred_on::timestamp
      at time zone 'Africa/Tripoli';
    v_wallet_amount := case
      when v_transaction_kind = 'income'
        then (-(p_amount_minor::numeric))::bigint
      else p_amount_minor
    end;

    insert into public.financial_events (
      id,
      workspace_id,
      event_type,
      currency_code,
      occurred_at,
      description,
      project_id,
      created_by,
      client_id,
      operation,
      payload_hash
    )
    values (
      v_event_id,
      p_workspace_id,
      v_transaction_kind::text::public.financial_event_type,
      v_debt.currency_code,
      v_event_time,
      coalesce(v_note, 'Debt payment'),
      v_debt.project_id,
      v_user_id,
      p_client_id,
      'post_debt_payment',
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
        v_debt.currency_code,
        1,
        v_wallet_amount
      ),
      (
        p_workspace_id,
        v_event_id,
        v_offset_account_id,
        v_debt.currency_code,
        2,
        -v_wallet_amount
      );
  end if;

  v_entry_id := extensions.gen_random_uuid();

  insert into public.debt_entries (
    id,
    workspace_id,
    debt_id,
    entry_type,
    amount_minor,
    currency_code,
    occurred_on,
    note,
    financial_event_id,
    created_by,
    client_id,
    operation,
    payload_hash
  )
  values (
    v_entry_id,
    p_workspace_id,
    p_debt_id,
    p_entry_type,
    p_amount_minor,
    v_debt.currency_code,
    p_occurred_on,
    v_note,
    v_event_id,
    v_user_id,
    p_client_id,
    v_operation,
    v_payload_hash
  );

  update public.debts as debt
     set status = case
           when v_next_balance = 0 and p_entry_type = 'write_off'
             then 'written_off'::public.debt_status
           when v_next_balance = 0
             then 'settled'::public.debt_status
           else 'partial'::public.debt_status
         end
   where debt.workspace_id = p_workspace_id
     and debt.id = p_debt_id;

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'post_debt_entry',
    pg_catalog.jsonb_build_object(
      'entry_id', v_entry_id,
      'financial_event_id', v_event_id
    )
  );

  perform private.write_audit(
    p_workspace_id,
    v_user_id,
    'debt.entry_posted',
    'debt_entries',
    v_entry_id,
    pg_catalog.jsonb_build_object(
      'amount_minor', p_amount_minor,
      'debt_id', p_debt_id,
      'entry_type', p_entry_type::text,
      'financial_event_id', v_event_id
    )
  );

  return v_entry_id;
end;
$$;

revoke all on table public.debt_parties
  from public, anon, authenticated;
revoke all on table public.debts
  from public, anon, authenticated;
revoke all on table public.debt_entries
  from public, anon, authenticated;
revoke all on table public.debt_balances
  from public, anon, authenticated;
revoke all on table public.debt_summaries
  from public, anon, authenticated;
revoke all on table public.debt_entry_details
  from public, anon, authenticated;

grant select on public.debt_parties to authenticated;
grant select on public.debts to authenticated;
grant select on public.debt_entries to authenticated;
grant select on public.debt_balances to authenticated;
grant select on public.debt_summaries to authenticated;
grant select on public.debt_entry_details to authenticated;

revoke all on function public.create_debt(
  uuid,
  uuid,
  public.debt_direction,
  bigint,
  text,
  text,
  text,
  text,
  date,
  uuid,
  text
) from public, anon, authenticated;

revoke all on function public.post_debt_entry(
  uuid,
  uuid,
  public.debt_entry_type,
  bigint,
  date,
  uuid,
  text,
  uuid
) from public, anon, authenticated;

grant execute on function public.create_debt(
  uuid,
  uuid,
  public.debt_direction,
  bigint,
  text,
  text,
  text,
  text,
  date,
  uuid,
  text
) to authenticated;

grant execute on function public.post_debt_entry(
  uuid,
  uuid,
  public.debt_entry_type,
  bigint,
  date,
  uuid,
  text,
  uuid
) to authenticated;

comment on function public.create_debt(
  uuid,
  uuid,
  public.debt_direction,
  bigint,
  text,
  text,
  text,
  text,
  date,
  uuid,
  text
) is
  'Idempotently creates a debt party, debt, and immutable opening entry.';

comment on function public.post_debt_entry(
  uuid,
  uuid,
  public.debt_entry_type,
  bigint,
  date,
  uuid,
  text,
  uuid
) is
  'Idempotently posts a signed debt movement and optionally an atomic wallet-backed payment.';

create or replace function private.reject_debt_linked_event_reversal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_type = 'reversal'::public.financial_event_type
     and new.reversal_of_event_id is not null
     and exists (
       select 1
         from public.debt_entries as entry
        where entry.workspace_id = new.workspace_id
          and entry.financial_event_id = new.reversal_of_event_id
     ) then
    raise exception using
      errcode = '22023',
      message = 'debt_event_managed',
      detail = 'Debt-linked wallet events must be managed through debt RPCs';
  end if;

  return new;
end;
$$;

drop trigger if exists financial_events_reject_debt_linked_reversal
  on public.financial_events;

create trigger financial_events_reject_debt_linked_reversal
before insert on public.financial_events
for each row
execute function private.reject_debt_linked_event_reversal();

comment on function private.reject_debt_linked_event_reversal() is
  'Blocks reverse/replace of wallet events that are linked to debt_entries.';
