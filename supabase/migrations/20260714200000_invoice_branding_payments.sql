-- Workspace invoice branding + invoice payments + edit + overdue alerts

-- ─── Workspace branding ───────────────────────────────────────
alter table public.workspaces
  add column if not exists legal_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists tax_id text,
  add column if not exists invoice_footer text,
  add column if not exists logo_path text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspaces_legal_name_length'
  ) then
    alter table public.workspaces
      add constraint workspaces_legal_name_length
      check (legal_name is null or char_length(btrim(legal_name)) between 1 and 160);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspaces_phone_length'
  ) then
    alter table public.workspaces
      add constraint workspaces_phone_length
      check (phone is null or char_length(btrim(phone)) between 1 and 40);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspaces_address_length'
  ) then
    alter table public.workspaces
      add constraint workspaces_address_length
      check (address is null or char_length(btrim(address)) between 1 and 240);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspaces_tax_id_length'
  ) then
    alter table public.workspaces
      add constraint workspaces_tax_id_length
      check (tax_id is null or char_length(btrim(tax_id)) between 1 and 80);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'workspaces_invoice_footer_length'
  ) then
    alter table public.workspaces
      add constraint workspaces_invoice_footer_length
      check (invoice_footer is null or char_length(btrim(invoice_footer)) <= 500);
  end if;
end $$;

-- ─── Invoice paid tracking ────────────────────────────────────
alter table public.invoices
  add column if not exists paid_minor bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_paid_nonneg'
  ) then
    alter table public.invoices
      add constraint invoices_paid_nonneg check (paid_minor >= 0);
  end if;
end $$;

-- ─── Invoice payments ─────────────────────────────────────────
create table if not exists public.invoice_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null,
  invoice_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  method text not null default 'cash'
    check (method in ('cash', 'bank_transfer', 'check', 'mobile_payment', 'other')),
  notes text,
  wallet_id uuid,
  financial_event_id uuid,
  paid_on date not null default (timezone('utc', now()))::date,
  created_by uuid not null references public.profiles (id),
  client_id uuid not null,
  operation text not null default 'record_invoice_payment',
  payload_hash bytea not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint invoice_payments_workspace_id_id unique (workspace_id, id),
  constraint invoice_payments_client_unique unique (workspace_id, client_id, operation),
  constraint invoice_payments_invoice_fk
    foreign key (workspace_id, invoice_id)
    references public.invoices (workspace_id, id)
    on delete cascade,
  constraint invoice_payments_wallet_fk
    foreign key (workspace_id, wallet_id)
    references public.wallets (workspace_id, id),
  constraint invoice_payments_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint invoice_payments_notes_shape
    check (notes is null or char_length(btrim(notes)) <= 500)
);

create index if not exists invoice_payments_invoice_idx
  on public.invoice_payments (workspace_id, invoice_id, created_at desc);

alter table public.invoice_payments enable row level security;

drop policy if exists invoice_payments_select_member on public.invoice_payments;
create policy invoice_payments_select_member on public.invoice_payments
  for select to authenticated
  using (private.is_workspace_member(workspace_id));

grant select on public.invoice_payments to authenticated;

-- ─── Storage: workspace logos (public for PDF fetch) ──────────
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'workspace-logos',
  'workspace-logos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_manage_workspace_logo(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select private.has_workspace_role(
    (split_part(object_name, '/', 1))::uuid,
    array['owner', 'admin']::public.workspace_role[]
  );
$$;

drop policy if exists workspace_logos_select on storage.objects;
create policy workspace_logos_select
on storage.objects for select to public
using (bucket_id = 'workspace-logos');

drop policy if exists workspace_logos_insert on storage.objects;
create policy workspace_logos_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'workspace-logos'
  and private.can_manage_workspace_logo(name)
);

drop policy if exists workspace_logos_update on storage.objects;
create policy workspace_logos_update
on storage.objects for update to authenticated
using (
  bucket_id = 'workspace-logos'
  and private.can_manage_workspace_logo(name)
)
with check (
  bucket_id = 'workspace-logos'
  and private.can_manage_workspace_logo(name)
);

drop policy if exists workspace_logos_delete on storage.objects;
create policy workspace_logos_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'workspace-logos'
  and private.can_manage_workspace_logo(name)
);

-- ─── Derive invoice status from paid amount ───────────────────
create or replace function private.derive_invoice_status(
  p_current public.invoice_status,
  p_total_minor bigint,
  p_paid_minor bigint,
  p_due_on date
)
returns public.invoice_status
language plpgsql
immutable
set search_path = public, pg_temp
as $fn$
begin
  if p_current = 'cancelled' then
    return 'cancelled';
  end if;
  if p_current = 'draft' and coalesce(p_paid_minor, 0) = 0 then
    return 'draft';
  end if;
  if p_total_minor > 0 and coalesce(p_paid_minor, 0) >= p_total_minor then
    return 'paid';
  end if;
  if coalesce(p_paid_minor, 0) > 0 then
    return 'partially_paid';
  end if;
  if p_due_on is not null
     and p_due_on < (timezone('utc', now()))::date
     and p_current in ('sent', 'overdue', 'partially_paid')
  then
    return 'overdue';
  end if;
  if p_current = 'draft' then
    return 'sent';
  end if;
  return coalesce(p_current, 'sent');
end;
$fn$;

-- ─── Update workspace branding ────────────────────────────────
create or replace function public.update_workspace_branding(
  p_workspace_id uuid,
  p_name text default null,
  p_legal_name text default null,
  p_phone text default null,
  p_address text default null,
  p_tax_id text default null,
  p_invoice_footer text default null,
  p_logo_path text default null,
  p_clear_logo boolean default false
)
returns public.workspaces
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_row public.workspaces%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.workspaces
     set name = coalesce(nullif(btrim(p_name), ''), name),
         legal_name = case
           when p_legal_name is null then legal_name
           else nullif(btrim(p_legal_name), '')
         end,
         phone = case
           when p_phone is null then phone
           else nullif(btrim(p_phone), '')
         end,
         address = case
           when p_address is null then address
           else nullif(btrim(p_address), '')
         end,
         tax_id = case
           when p_tax_id is null then tax_id
           else nullif(btrim(p_tax_id), '')
         end,
         invoice_footer = case
           when p_invoice_footer is null then invoice_footer
           else nullif(btrim(p_invoice_footer), '')
         end,
         logo_path = case
           when p_clear_logo then null
           when p_logo_path is null then logo_path
           else nullif(btrim(p_logo_path), '')
         end,
         updated_at = clock_timestamp()
   where id = p_workspace_id
  returning * into v_row;

  if not found then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$fn$;

-- ─── Update invoice (draft/sent/overdue with no payments) ─────
create or replace function public.update_invoice(
  p_workspace_id uuid,
  p_invoice_id uuid,
  p_client_id uuid,
  p_items jsonb,
  p_business_client_id uuid default null,
  p_client_name text default null,
  p_client_phone text default null,
  p_issue_on date default null,
  p_due_on date default null,
  p_tax_rate_percent numeric default null,
  p_notes text default null
)
returns public.invoices
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_invoice public.invoices%rowtype;
  v_client public.clients%rowtype;
  v_name text;
  v_phone text;
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
  v_tax_rate numeric;
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

  select * into v_invoice
  from public.invoices
  where workspace_id = p_workspace_id and id = p_invoice_id
  for update;
  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;
  if v_invoice.status = 'cancelled' then
    raise exception 'invoice_cancelled' using errcode = '22023';
  end if;
  if v_invoice.status = 'paid' or coalesce(v_invoice.paid_minor, 0) > 0 then
    raise exception 'invoice_has_payments' using errcode = '22023';
  end if;
  if v_invoice.status not in ('draft', 'sent', 'overdue') then
    raise exception 'invoice_not_editable' using errcode = '22023';
  end if;

  v_tax_rate := coalesce(p_tax_rate_percent, v_invoice.tax_rate_percent);
  if v_tax_rate < 0 or v_tax_rate > 100 then
    raise exception 'invalid_tax_rate' using errcode = '22023';
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
    v_name := coalesce(
      nullif(btrim(coalesce(p_client_name, '')), ''),
      v_invoice.client_name
    );
    v_phone := case
      when p_client_phone is null then v_invoice.client_phone
      else nullif(btrim(p_client_phone), '')
    end;
  end if;

  if v_name is null or char_length(v_name) not between 1 and 160 then
    raise exception 'invalid_client_name' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'invoice_id', p_invoice_id,
    'business_client_id', p_business_client_id,
    'client_name', v_name,
    'items', p_items,
    'tax_rate_percent', v_tax_rate,
    'issue_on', coalesce(p_issue_on, v_invoice.issue_on),
    'due_on', coalesce(p_due_on, v_invoice.due_on)
  );
  v_hash := private.payload_hash(v_payload);
  v_existing := private.begin_idempotent_operation(
    p_workspace_id, p_client_id, 'update_invoice', v_hash
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

  v_tax := round(v_subtotal * v_tax_rate / 100.0)::bigint;
  v_total := v_subtotal + v_tax;

  delete from public.invoice_items
  where workspace_id = p_workspace_id and invoice_id = p_invoice_id;

  update public.invoices
     set business_client_id = p_business_client_id,
         client_name = v_name,
         client_phone = v_phone,
         issue_on = coalesce(p_issue_on, issue_on),
         due_on = case when p_due_on is null then due_on else p_due_on end,
         notes = case
           when p_notes is null then notes
           else nullif(btrim(p_notes), '')
         end,
         tax_rate_percent = v_tax_rate,
         subtotal_minor = v_subtotal,
         tax_minor = v_tax,
         total_minor = v_total,
         updated_at = clock_timestamp()
   where workspace_id = p_workspace_id and id = p_invoice_id
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
    'update_invoice',
    jsonb_build_object('invoice_id', v_invoice.id)
  );

  return v_invoice;
end;
$fn$;

-- ─── Record invoice payment (+ wallet income) ─────────────────
create or replace function public.record_invoice_payment(
  p_workspace_id uuid,
  p_invoice_id uuid,
  p_client_id uuid,
  p_amount_minor bigint,
  p_wallet_id uuid,
  p_method text default 'cash',
  p_notes text default null,
  p_paid_on date default null
)
returns public.invoice_payments
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_invoice public.invoices%rowtype;
  v_payment public.invoice_payments%rowtype;
  v_payload jsonb;
  v_hash bytea;
  v_existing jsonb;
  v_remaining bigint;
  v_event_id uuid;
  v_tx_client uuid := extensions.gen_random_uuid();
  v_method text := coalesce(nullif(btrim(p_method), ''), 'cash');
  v_paid_on date := coalesce(p_paid_on, (timezone('utc', now()))::date);
  v_new_paid bigint;
  v_next_status public.invoice_status;
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
  if p_wallet_id is null then
    raise exception 'wallet_required' using errcode = '22023';
  end if;
  if v_method not in ('cash', 'bank_transfer', 'check', 'mobile_payment', 'other') then
    raise exception 'invalid_method' using errcode = '22023';
  end if;

  select * into v_invoice
  from public.invoices
  where workspace_id = p_workspace_id and id = p_invoice_id
  for update;
  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;
  if v_invoice.status = 'cancelled' then
    raise exception 'invoice_cancelled' using errcode = '22023';
  end if;
  if v_invoice.status = 'draft' then
    raise exception 'invoice_still_draft' using errcode = '22023';
  end if;

  v_remaining := greatest(v_invoice.total_minor - coalesce(v_invoice.paid_minor, 0), 0);
  if p_amount_minor > v_remaining then
    raise exception 'amount_exceeds_remaining' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'invoice_id', p_invoice_id,
    'amount_minor', p_amount_minor,
    'wallet_id', p_wallet_id,
    'method', v_method,
    'paid_on', v_paid_on
  );
  v_hash := private.payload_hash(v_payload);
  v_existing := private.begin_idempotent_operation(
    p_workspace_id, p_client_id, 'record_invoice_payment', v_hash
  );
  if v_existing is not null then
    select * into v_payment
    from public.invoice_payments
    where workspace_id = p_workspace_id
      and id = (v_existing ->> 'payment_id')::uuid;
    return v_payment;
  end if;

  v_event_id := public.post_transaction(
    p_workspace_id,
    v_tx_client,
    p_wallet_id,
    'income'::public.transaction_kind,
    p_amount_minor,
    (v_paid_on::timestamptz),
    format('تحصيل فاتورة %s — %s', v_invoice.invoice_number, v_invoice.client_name),
    null,
    null,
    v_invoice.business_client_id
  );

  insert into public.invoice_payments (
    workspace_id, invoice_id, amount_minor, method, notes,
    wallet_id, financial_event_id, paid_on, created_by,
    client_id, operation, payload_hash
  ) values (
    p_workspace_id, p_invoice_id, p_amount_minor, v_method,
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_wallet_id, v_event_id, v_paid_on, v_user_id,
    p_client_id, 'record_invoice_payment', v_hash
  )
  returning * into v_payment;

  v_new_paid := coalesce(v_invoice.paid_minor, 0) + p_amount_minor;
  v_next_status := private.derive_invoice_status(
    v_invoice.status, v_invoice.total_minor, v_new_paid, v_invoice.due_on
  );

  update public.invoices
     set paid_minor = v_new_paid,
         status = v_next_status,
         updated_at = clock_timestamp()
   where workspace_id = p_workspace_id and id = p_invoice_id;

  perform private.finish_idempotent_operation(
    p_workspace_id,
    p_client_id,
    'record_invoice_payment',
    jsonb_build_object('payment_id', v_payment.id, 'event_id', v_event_id)
  );

  return v_payment;
end;
$fn$;

-- ─── Mark overdue invoices ────────────────────────────────────
create or replace function public.refresh_overdue_invoices(
  p_workspace_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with updated as (
    update public.invoices
       set status = 'overdue',
           updated_at = clock_timestamp()
     where workspace_id = p_workspace_id
       and status in ('sent', 'partially_paid')
       and due_on is not null
       and due_on < (timezone('utc', now()))::date
       and coalesce(paid_minor, 0) < total_minor
    returning 1
  )
  select count(*)::integer into v_count from updated;

  return coalesce(v_count, 0);
end;
$fn$;

-- ─── Extend operational notifications for overdue invoices ────
create or replace function public.refresh_operational_notifications(
  p_workspace_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
  v_member record;
  v_title text;
  v_body text;
  v_key text;
  v_low_wallet record;
  v_uncovered bigint;
  v_overdue_count integer;
  v_overdue_invoices integer;
  v_inactive record;
  v_subscription record;
  v_days_left numeric;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  -- Keep overdue invoice statuses fresh before alerting.
  perform public.refresh_overdue_invoices(p_workspace_id);

  for v_low_wallet in
    select
      wallet.id,
      wallet.name,
      wallet.currency_code,
      private.wallet_balance(p_workspace_id, wallet.id) as balance_minor,
      currency.minor_unit
    from public.wallets as wallet
    join public.currencies as currency
      on currency.code = wallet.currency_code
    where wallet.workspace_id = p_workspace_id
      and wallet.status = 'active'
      and private.wallet_balance(p_workspace_id, wallet.id)
        < (100::numeric * power(10::numeric, currency.minor_unit))
  loop
    v_key := 'low_wallet:' || v_low_wallet.id::text;
    v_title := 'رصيد محفظة منخفض';
    v_body := format(
      'المحفظة «%s» رصيدها منخفض (%s). راجع التدفقات القادمة.',
      v_low_wallet.name,
      v_low_wallet.balance_minor::text
    );
    for v_member in
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not exists (
        select 1 from public.notifications as notification
        where notification.user_id = v_member.user_id
          and notification.workspace_id = p_workspace_id
          and notification.kind = 'operational'
          and notification.read_at is null
          and notification.metadata ->> 'dedupe_key' = v_key
          and notification.created_at > clock_timestamp() - interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'low_wallet', 'wallet_id', v_low_wallet.id)
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

  select coalesce(sum(greatest(detail.balance_minor::numeric, 0)), 0)::bigint
  into v_uncovered
  from public.project_worker_balance_details as detail
  join public.projects as project
    on project.id = detail.project_id
   and project.workspace_id = detail.workspace_id
  where detail.workspace_id = p_workspace_id
    and project.status = 'active'
    and coalesce((project.modules ->> 'workers')::boolean, false);

  if v_uncovered > 0 then
    v_key := 'uncovered_labor';
    v_title := 'مستحقات عمال غير مغطاة';
    v_body := format(
      'يوجد مستحقات عمال مفتوحة بمقدار %s. راجع تبويب العمال قبل الدفع.',
      v_uncovered::text
    );
    for v_member in
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not exists (
        select 1 from public.notifications as notification
        where notification.user_id = v_member.user_id
          and notification.workspace_id = p_workspace_id
          and notification.kind = 'operational'
          and notification.read_at is null
          and notification.metadata ->> 'dedupe_key' = v_key
          and notification.created_at > clock_timestamp() - interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'uncovered_labor')
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  select count(*)::integer into v_overdue_count
  from public.debt_balances as debt
  where debt.workspace_id = p_workspace_id
    and debt.status in ('open', 'partial')
    and debt.due_on is not null
    and debt.due_on < (timezone('utc', now()))::date
    and debt.balance_minor::bigint > 0;

  if coalesce(v_overdue_count, 0) > 0 then
    v_key := 'overdue_debts';
    v_title := 'ديون متأخرة';
    v_body := format('لديك %s دينًا متأخرًا. راجع تبويب الديون.', v_overdue_count::text);
    for v_member in
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not exists (
        select 1 from public.notifications as notification
        where notification.user_id = v_member.user_id
          and notification.workspace_id = p_workspace_id
          and notification.kind = 'operational'
          and notification.read_at is null
          and notification.metadata ->> 'dedupe_key' = v_key
          and notification.created_at > clock_timestamp() - interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'overdue_debts')
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  -- Overdue sales invoices
  select count(*)::integer into v_overdue_invoices
  from public.invoices as invoice
  where invoice.workspace_id = p_workspace_id
    and invoice.status = 'overdue';

  if coalesce(v_overdue_invoices, 0) > 0 then
    v_key := 'overdue_invoices';
    v_title := 'فواتير متأخرة';
    v_body := format(
      'لديك %s فاتورة متأخرة عن الاستحقاق. راجع التحصيل.',
      v_overdue_invoices::text
    );
    for v_member in
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not exists (
        select 1 from public.notifications as notification
        where notification.user_id = v_member.user_id
          and notification.workspace_id = p_workspace_id
          and notification.kind = 'operational'
          and notification.read_at is null
          and notification.metadata ->> 'dedupe_key' = v_key
          and notification.created_at > clock_timestamp() - interval '24 hours'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object('dedupe_key', v_key, 'alert', 'overdue_invoices')
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end if;

  for v_inactive in
    select project.id, project.name
    from public.projects as project
    where project.workspace_id = p_workspace_id
      and project.status = 'active'
      and not exists (
        select 1 from public.financial_events as event
        where event.workspace_id = project.workspace_id
          and event.project_id = project.id
          and event.occurred_at > clock_timestamp() - interval '14 days'
      )
  loop
    v_key := 'inactive_project:' || v_inactive.id::text;
    v_title := 'مشروع بلا نشاط';
    v_body := format(
      'المشروع «%s» بلا حركات منذ أسبوعين. سجّل نشاطًا أو راجع حالته.',
      v_inactive.name
    );
    for v_member in
      select user_id from public.workspace_members
      where workspace_id = p_workspace_id
    loop
      if not exists (
        select 1 from public.notifications as notification
        where notification.user_id = v_member.user_id
          and notification.workspace_id = p_workspace_id
          and notification.kind = 'operational'
          and notification.read_at is null
          and notification.metadata ->> 'dedupe_key' = v_key
          and notification.created_at > clock_timestamp() - interval '7 days'
      ) then
        insert into public.notifications (
          user_id, workspace_id, kind, title, body, metadata
        ) values (
          v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
          jsonb_build_object(
            'dedupe_key', v_key, 'alert', 'inactive_project', 'project_id', v_inactive.id
          )
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;
  end loop;

  select
    subscription.status,
    subscription.current_period_ends_at,
    subscription.trial_ends_at,
    subscription.grace_ends_at
  into v_subscription
  from public.workspace_subscriptions as subscription
  where subscription.workspace_id = p_workspace_id;

  if found then
    v_days_left := null;
    if v_subscription.current_period_ends_at is not null then
      v_days_left := extract(
        epoch from (v_subscription.current_period_ends_at - clock_timestamp())
      ) / 86400.0;
    elsif v_subscription.trial_ends_at is not null then
      v_days_left := extract(
        epoch from (v_subscription.trial_ends_at - clock_timestamp())
      ) / 86400.0;
    elsif v_subscription.grace_ends_at is not null then
      v_days_left := extract(
        epoch from (v_subscription.grace_ends_at - clock_timestamp())
      ) / 86400.0;
    end if;

    if v_days_left is not null and v_days_left >= 0 and v_days_left <= 7 then
      v_key := 'subscription_nearing_end';
      v_title := 'الاشتراك يقترب من الانتهاء';
      v_body := format(
        'يتبقى حوالي %s يومًا على نهاية فترة الاشتراك الحالية.',
        ceil(v_days_left)::text
      );
      for v_member in
        select user_id from public.workspace_members
        where workspace_id = p_workspace_id
          and role in ('owner', 'admin')
      loop
        if not exists (
          select 1 from public.notifications as notification
          where notification.user_id = v_member.user_id
            and notification.workspace_id = p_workspace_id
            and notification.kind = 'operational'
            and notification.read_at is null
            and notification.metadata ->> 'dedupe_key' = v_key
            and notification.created_at > clock_timestamp() - interval '3 days'
        ) then
          insert into public.notifications (
            user_id, workspace_id, kind, title, body, metadata
          ) values (
            v_member.user_id, p_workspace_id, 'operational', v_title, v_body,
            jsonb_build_object('dedupe_key', v_key, 'alert', 'subscription_nearing_end')
          );
          v_inserted := v_inserted + 1;
        end if;
      end loop;
    end if;
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.update_workspace_branding(uuid, text, text, text, text, text, text, text, boolean) from public;
revoke all on function public.update_invoice(uuid, uuid, uuid, jsonb, uuid, text, text, date, date, numeric, text) from public;
revoke all on function public.record_invoice_payment(uuid, uuid, uuid, bigint, uuid, text, text, date) from public;
revoke all on function public.refresh_overdue_invoices(uuid) from public;

grant execute on function public.update_workspace_branding(uuid, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.update_invoice(uuid, uuid, uuid, jsonb, uuid, text, text, date, date, numeric, text) to authenticated;
grant execute on function public.record_invoice_payment(uuid, uuid, uuid, bigint, uuid, text, text, date) to authenticated;
grant execute on function public.refresh_overdue_invoices(uuid) to authenticated;
