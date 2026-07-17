-- Invoice estimate status + payment attribution (project / category)

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'invoice_status'
      and e.enumlabel = 'estimate'
  ) then
    alter type public.invoice_status add value 'estimate';
  end if;
end $$;

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
  if p_current = 'estimate' then
    return 'estimate';
  end if;
  if p_paid_minor >= p_total_minor and p_total_minor > 0 then
    return 'paid';
  end if;
  if p_paid_minor > 0 then
    return 'partially_paid';
  end if;
  if p_due_on is not null and p_due_on < (timezone('utc', now()))::date then
    return 'overdue';
  end if;
  if p_current = 'draft' then
    return 'draft';
  end if;
  return 'sent';
end;
$fn$;

create or replace function public.record_invoice_payment(
  p_workspace_id uuid,
  p_invoice_id uuid,
  p_client_id uuid,
  p_amount_minor bigint,
  p_wallet_id uuid,
  p_method text default 'cash',
  p_notes text default null,
  p_paid_on date default null,
  p_category_id uuid default null,
  p_project_id uuid default null
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

  if p_category_id is not null then
    if not exists (
      select 1 from public.categories
      where workspace_id = p_workspace_id and id = p_category_id
    ) then
      raise exception 'category_not_found' using errcode = 'P0002';
    end if;
  end if;

  if p_project_id is not null then
    if not exists (
      select 1 from public.projects
      where workspace_id = p_workspace_id and id = p_project_id
    ) then
      raise exception 'project_not_found' using errcode = 'P0002';
    end if;
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
  if v_invoice.status in ('draft', 'estimate') then
    raise exception 'invoice_not_collectable' using errcode = '22023';
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
    'paid_on', v_paid_on,
    'category_id', p_category_id,
    'project_id', p_project_id
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
    p_category_id,
    p_project_id,
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

revoke all on function public.record_invoice_payment(uuid, uuid, uuid, bigint, uuid, text, text, date, uuid, uuid) from public;
grant execute on function public.record_invoice_payment(uuid, uuid, uuid, bigint, uuid, text, text, date, uuid, uuid) to authenticated;

-- Keep old 8-arg signature callable by wrapping via default args — Postgres
-- treats added defaults as a new signature; drop ambiguous overload if present.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'record_invoice_payment'
      and pg_get_function_identity_arguments(p.oid) =
        'p_workspace_id uuid, p_invoice_id uuid, p_client_id uuid, p_amount_minor bigint, p_wallet_id uuid, p_method text, p_notes text, p_paid_on date'
  ) then
    drop function public.record_invoice_payment(uuid, uuid, uuid, bigint, uuid, text, text, date);
  end if;
exception when others then
  null;
end $$;
