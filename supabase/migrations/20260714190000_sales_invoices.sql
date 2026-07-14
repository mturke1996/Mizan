-- Sales invoices linked to business clients + line items

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'invoice_status'
  ) then
    create type public.invoice_status as enum (
      'draft',
      'sent',
      'paid',
      'partially_paid',
      'overdue',
      'cancelled'
    );
  end if;
end $$;

create table if not exists public.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  invoice_number text not null,
  business_client_id uuid,
  client_name text not null,
  client_phone text,
  status public.invoice_status not null default 'draft',
  issue_on date not null default (timezone('utc', now()))::date,
  due_on date,
  notes text,
  tax_rate_percent numeric(7, 3) not null default 0
    check (tax_rate_percent >= 0 and tax_rate_percent <= 100),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  currency_code text not null references public.currencies (code),
  created_by uuid not null references public.profiles (id),
  client_id uuid not null,
  operation text not null default 'create_invoice',
  payload_hash bytea not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint invoices_workspace_id_id unique (workspace_id, id),
  constraint invoices_workspace_number unique (workspace_id, invoice_number),
  constraint invoices_client_unique unique (workspace_id, client_id, operation),
  constraint invoices_name_shape check (char_length(btrim(client_name)) between 1 and 160),
  constraint invoices_number_shape check (char_length(btrim(invoice_number)) between 1 and 40),
  constraint invoices_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint invoices_business_client_fk
    foreign key (workspace_id, business_client_id)
    references public.clients (workspace_id, id)
);

create table if not exists public.invoice_items (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null,
  invoice_id uuid not null,
  sort_order int not null default 0,
  description text not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  created_at timestamptz not null default clock_timestamp(),
  constraint invoice_items_workspace_id_id unique (workspace_id, id),
  constraint invoice_items_invoice_fk
    foreign key (workspace_id, invoice_id)
    references public.invoices (workspace_id, id)
    on delete cascade,
  constraint invoice_items_description_shape
    check (char_length(btrim(description)) between 1 and 300)
);

create index if not exists invoices_workspace_created_idx
  on public.invoices (workspace_id, created_at desc);

create index if not exists invoice_items_invoice_idx
  on public.invoice_items (workspace_id, invoice_id, sort_order);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists invoices_select_member on public.invoices;
create policy invoices_select_member on public.invoices
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

drop policy if exists invoice_items_select_member on public.invoice_items;
create policy invoice_items_select_member on public.invoice_items
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

grant select on public.invoices to authenticated;
grant select on public.invoice_items to authenticated;

create or replace function public.next_invoice_number(p_workspace_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_max int := 0;
  v_num text;
begin
  select coalesce(max(
    case
      when invoice_number ~ '^INV-[0-9]+$'
        then substring(invoice_number from 5)::int
      else 0
    end
  ), 0)
    into v_max
  from public.invoices
  where workspace_id = p_workspace_id;

  v_num := 'INV-' || (v_max + 1)::text;
  return v_num;
end;
$fn$;

create or replace function public.create_invoice(
  p_workspace_id uuid,
  p_client_id uuid,
  p_items jsonb,
  p_business_client_id uuid default null,
  p_client_name text default null,
  p_client_phone text default null,
  p_issue_on date default null,
  p_due_on date default null,
  p_tax_rate_percent numeric default 0,
  p_notes text default null,
  p_status public.invoice_status default 'draft'
)
returns public.invoices
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_workspace public.workspaces%rowtype;
  v_client public.clients%rowtype;
  v_name text;
  v_phone text;
  v_invoice public.invoices%rowtype;
  v_payload jsonb;
  v_hash bytea;
  v_existing jsonb;
  v_item jsonb;
  v_subtotal bigint := 0;
  v_tax bigint := 0;
  v_total bigint := 0;
  v_qty numeric;
  v_unit bigint;
  v_line bigint;
  v_ord int := 0;
  v_desc text;
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
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required' using errcode = '22023';
  end if;
  if coalesce(p_tax_rate_percent, 0) < 0 or coalesce(p_tax_rate_percent, 0) > 100 then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;

  select * into v_workspace from public.workspaces where id = p_workspace_id;
  if not found then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  if p_business_client_id is not null then
    select * into v_client
    from public.clients
    where workspace_id = p_workspace_id and id = p_business_client_id;
    if not found then
      raise exception 'business_client_not_found' using errcode = 'P0002';
    end if;
    v_name := coalesce(nullif(btrim(coalesce(p_client_name, '')), ''), v_client.name);
    v_phone := coalesce(nullif(btrim(coalesce(p_client_phone, '')), ''), v_client.phone);
  else
    v_name := nullif(btrim(coalesce(p_client_name, '')), '');
    v_phone := nullif(btrim(coalesce(p_client_phone, '')), '');
  end if;

  if v_name is null or char_length(v_name) not between 1 and 160 then
    raise exception 'invalid_client_name' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'business_client_id', p_business_client_id,
    'client_name', v_name,
    'items', p_items,
    'tax_rate_percent', coalesce(p_tax_rate_percent, 0),
    'issue_on', coalesce(p_issue_on, (timezone('utc', now()))::date),
    'due_on', p_due_on,
    'status', coalesce(p_status, 'draft')
  );
  v_hash := private.payload_hash(v_payload);
  v_existing := private.begin_idempotent_operation(
    p_workspace_id, p_client_id, 'create_invoice', v_hash
  );
  if v_existing is not null then
    select * into v_invoice
    from public.invoices
    where workspace_id = p_workspace_id
      and id = (v_existing ->> 'invoice_id')::uuid;
    return v_invoice;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_desc := nullif(btrim(coalesce(v_item ->> 'description', '')), '');
    v_qty := coalesce((v_item ->> 'quantity')::numeric, 0);
    v_unit := coalesce((v_item ->> 'unit_price_minor')::bigint, 0);
    if v_desc is null or v_qty <= 0 or v_unit < 0 then
      raise exception 'invalid_item' using errcode = '22023';
    end if;
    v_line := round(v_qty * v_unit)::bigint;
    v_subtotal := v_subtotal + v_line;
  end loop;

  v_tax := round(v_subtotal * coalesce(p_tax_rate_percent, 0) / 100.0)::bigint;
  v_total := v_subtotal + v_tax;

  insert into public.invoices (
    workspace_id, invoice_number, business_client_id, client_name, client_phone,
    status, issue_on, due_on, notes, tax_rate_percent,
    subtotal_minor, tax_minor, total_minor, currency_code,
    created_by, client_id, operation, payload_hash
  ) values (
    p_workspace_id,
    public.next_invoice_number(p_workspace_id),
    p_business_client_id,
    v_name,
    v_phone,
    coalesce(p_status, 'draft'),
    coalesce(p_issue_on, (timezone('utc', now()))::date),
    p_due_on,
    nullif(btrim(coalesce(p_notes, '')), ''),
    coalesce(p_tax_rate_percent, 0),
    v_subtotal,
    v_tax,
    v_total,
    v_workspace.default_currency_code,
    v_user_id,
    p_client_id,
    'create_invoice',
    v_hash
  )
  returning * into v_invoice;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_ord := v_ord + 1;
    v_desc := btrim(v_item ->> 'description');
    v_qty := (v_item ->> 'quantity')::numeric;
    v_unit := (v_item ->> 'unit_price_minor')::bigint;
    v_line := round(v_qty * v_unit)::bigint;
    insert into public.invoice_items (
      workspace_id, invoice_id, sort_order, description,
      quantity, unit_price_minor, line_total_minor
    ) values (
      p_workspace_id, v_invoice.id, v_ord, v_desc,
      v_qty, v_unit, v_line
    );
  end loop;

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'create_invoice',
    jsonb_build_object('invoice_id', v_invoice.id)
  );

  return v_invoice;
end;
$fn$;

create or replace function public.set_invoice_status(
  p_workspace_id uuid,
  p_invoice_id uuid,
  p_status public.invoice_status
)
returns public.invoices
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_row public.invoices%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.invoices
     set status = p_status,
         updated_at = clock_timestamp()
   where workspace_id = p_workspace_id
     and id = p_invoice_id
  returning * into v_row;

  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$fn$;

revoke all on function public.next_invoice_number(uuid) from public;
revoke all on function public.create_invoice(uuid, uuid, jsonb, uuid, text, text, date, date, numeric, text, public.invoice_status) from public;
revoke all on function public.set_invoice_status(uuid, uuid, public.invoice_status) from public;

grant execute on function public.next_invoice_number(uuid) to authenticated;
grant execute on function public.create_invoice(uuid, uuid, jsonb, uuid, text, text, date, date, numeric, text, public.invoice_status) to authenticated;
grant execute on function public.set_invoice_status(uuid, uuid, public.invoice_status) to authenticated;
