-- Allow project cash expenses even when the treasury balance is insufficient.
-- Balance may go negative; later income covers the deficit via project_cash_balances.
-- transfer_project_cash_to_wallet still requires sufficient balance.

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

  -- Expense may overdraw project cash; income later restores the balance.
  -- Wallet transfers still enforce sufficient cash separately.

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
