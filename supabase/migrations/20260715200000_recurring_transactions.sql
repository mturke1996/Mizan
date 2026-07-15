-- Recurring / scheduled transactions.
--
-- A recurring transaction is a template that the app posts automatically when its
-- next_date falls due. The posting reuses public.post_transaction so the same
-- double-entry, idempotency, and entitlement rules apply. Each generated
-- occurrence is keyed by a deterministic client_id derived from
-- (recurring_id, occurrence_date), so re-running the due poster never duplicates
-- a posting even if it is invoked more than once for the same date.

create type public.recurring_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');

create table public.recurring_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  kind public.transaction_kind not null,
  amount_minor bigint not null,
  currency_code text not null references public.currencies (code),
  wallet_id uuid not null,
  category_id uuid,
  project_id uuid,
  frequency public.recurring_frequency not null default 'monthly',
  interval_steps int not null default 1 check (interval_steps > 0),
  next_date date not null,
  last_posted_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint recurring_workspace_id_id unique (workspace_id, id),
  constraint recurring_amount_positive check (amount_minor > 0),
  constraint recurring_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint recurring_wallet_fk
    foreign key (workspace_id, wallet_id)
    references public.wallets (workspace_id, id) on delete cascade,
  constraint recurring_category_fk
    foreign key (workspace_id, category_id)
    references public.categories (workspace_id, id) on delete set null,
  constraint recurring_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id) on delete set null,
  constraint recurring_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id)
);

create index recurring_workspace_active_next_idx
  on public.recurring_transactions (workspace_id, is_active, next_date);

create trigger recurring_set_updated_at
before update on public.recurring_transactions
for each row execute function private.set_updated_at();

alter table public.recurring_transactions enable row level security;

create policy recurring_select_member
on public.recurring_transactions
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy recurring_insert_writer
on public.recurring_transactions
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_write_workspace(workspace_id)
);

create policy recurring_update_writer
on public.recurring_transactions
for update
to authenticated
using (private.can_write_workspace(workspace_id))
with check (private.can_write_workspace(workspace_id));

create policy recurring_delete_writer
on public.recurring_transactions
for delete
to authenticated
using (private.can_write_workspace(workspace_id));

grant select on public.recurring_transactions to authenticated;
grant insert (
  workspace_id, title, kind, amount_minor, currency_code, wallet_id,
  category_id, project_id, frequency, interval_steps, next_date, is_active, created_by
) on public.recurring_transactions to authenticated;
grant update (
  title, amount_minor, currency_code, wallet_id, category_id, project_id,
  frequency, interval_steps, next_date, is_active
) on public.recurring_transactions to authenticated;
grant delete on public.recurring_transactions to authenticated;

-- Upsert a recurring template. p_recurring_id null => create. The wallet must be
-- active and its currency must match p_currency_code. An optional category must be
-- active and match the kind; an optional project must be active.
create or replace function public.upsert_recurring(
  p_workspace_id uuid,
  p_recurring_id uuid default null,
  p_title text,
  p_kind public.transaction_kind,
  p_amount_minor bigint,
  p_currency_code text,
  p_wallet_id uuid,
  p_category_id uuid default null,
  p_project_id uuid default null,
  p_frequency public.recurring_frequency default 'monthly',
  p_interval_steps int default 1,
  p_next_date date,
  p_is_active boolean default true
)
returns public.recurring_transactions
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_row public.recurring_transactions%rowtype;
  v_wallet_status public.wallet_status;
  v_wallet_currency text;
  v_category_kind public.category_kind;
  v_category_active boolean;
  v_project_active boolean;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_interval_steps is null or p_interval_steps <= 0 then
    raise exception 'invalid_interval' using errcode = '22023';
  end if;
  if p_next_date is null then
    raise exception 'invalid_next_date' using errcode = '22023';
  end if;

  select wallet.status, wallet.currency_code
    into v_wallet_status, v_wallet_currency
    from public.wallets wallet
   where wallet.workspace_id = p_workspace_id
     and wallet.id = p_wallet_id;
  if not found then
    raise exception 'wallet_not_found' using errcode = 'P0002';
  end if;
  if v_wallet_status <> 'active' then
    raise exception 'wallet_not_active' using errcode = '22023';
  end if;
  if v_wallet_currency <> p_currency_code then
    raise exception 'wallet_currency_mismatch' using errcode = '22023';
  end if;

  if p_category_id is not null then
    select category.kind, category.is_active
      into v_category_kind, v_category_active
      from public.categories category
     where category.workspace_id = p_workspace_id
       and category.id = p_category_id;
    if not found or not v_category_active or v_category_kind <> p_kind then
      raise exception 'category_not_found' using errcode = 'P0002';
    end if;
  end if;

  if p_project_id is not null then
    select project.status = 'active'
      into v_project_active
      from public.projects project
     where project.workspace_id = p_workspace_id
       and project.id = p_project_id;
    if not found or not v_project_active then
      raise exception 'project_not_found' using errcode = 'P0002';
    end if;
  end if;

  if p_recurring_id is not null then
    update public.recurring_transactions
       set title = p_title,
           kind = p_kind,
           amount_minor = p_amount_minor,
           currency_code = p_currency_code,
           wallet_id = p_wallet_id,
           category_id = p_category_id,
           project_id = p_project_id,
           frequency = p_frequency,
           interval_steps = p_interval_steps,
           next_date = p_next_date,
           is_active = p_is_active,
           updated_at = clock_timestamp()
     where workspace_id = p_workspace_id
       and id = p_recurring_id
    returning * into v_row;
    if not found then
      raise exception 'recurring_not_found' using errcode = 'P0002';
    end if;
    return v_row;
  end if;

  insert into public.recurring_transactions (
    workspace_id, title, kind, amount_minor, currency_code, wallet_id,
    category_id, project_id, frequency, interval_steps, next_date, is_active, created_by
  )
  values (
    p_workspace_id, p_title, p_kind, p_amount_minor, p_currency_code, p_wallet_id,
    p_category_id, p_project_id, p_frequency, p_interval_steps, p_next_date, p_is_active, v_user_id
  )
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.delete_recurring(
  p_workspace_id uuid,
  p_recurring_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.recurring_transactions
   where workspace_id = p_workspace_id
     and id = p_recurring_id;
end;
$fn$;

-- Post every active recurring template whose next_date is due. Each occurrence is
-- posted via public.post_transaction with a deterministic client_id, so the
-- operation is idempotent across re-runs. A single failing occurrence (e.g.
-- insufficient funds) stops that template but never aborts the whole batch.
create or replace function public.post_all_recurring_due(
  p_workspace_id uuid,
  p_now timestamptz default clock_timestamp()
)
returns int
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_today date := p_now::date;
  v_row record;
  v_next date;
  v_occ date;
  v_client uuid;
  v_event uuid;
  v_count int := 0;
  v_max int;
  v_failed boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin', 'member']::public.workspace_role[]
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_row in
    select r.id, r.wallet_id, r.kind, r.amount_minor, r.title,
           r.category_id, r.project_id, r.frequency, r.interval_steps, r.next_date
      from public.recurring_transactions r
     where r.workspace_id = p_workspace_id
       and r.is_active
       and r.next_date <= v_today
     order by r.next_date
     for update of r
  loop
    begin
      v_next := v_row.next_date;
      v_max := 60;
      v_failed := false;
      while v_next <= v_today and v_max > 0 loop
        v_occ := v_next;
        v_client := md5(v_row.id::text || ':' || v_occ::text)::uuid;
        begin
          v_event := public.post_transaction(
            p_workspace_id,
            v_client,
            v_row.wallet_id,
            v_row.kind,
            v_row.amount_minor,
            v_occ::timestamptz,
            v_row.title,
            v_row.category_id,
            v_row.project_id
          );
          v_count := v_count + 1;
        exception when others then
          v_failed := true;
        end;
        if v_failed then
          exit;
        end if;
        v_next := case v_row.frequency
          when 'daily' then (v_next + v_row.interval_steps)::date
          when 'weekly' then (v_next + v_row.interval_steps * 7)::date
          when 'monthly' then (v_next + make_interval(months => v_row.interval_steps))::date
          when 'yearly' then (v_next + make_interval(years => v_row.interval_steps))::date
          else (v_next + interval '1 month')::date
        end;
        v_max := v_max - 1;
      end loop;
      update public.recurring_transactions
         set next_date = v_next,
             last_posted_at = clock_timestamp(),
             updated_at = clock_timestamp()
       where id = v_row.id;
    exception when others then
      null;
    end;
  end loop;

  return v_count;
end;
$fn$;

revoke all on function public.upsert_recurring(
  uuid, uuid, text, public.transaction_kind, bigint, text, uuid, uuid, uuid,
  public.recurring_frequency, int, date, boolean
) from public;
revoke all on function public.delete_recurring(uuid, uuid) from public;
revoke all on function public.post_all_recurring_due(uuid, timestamptz) from public;
grant execute on function public.upsert_recurring(
  uuid, uuid, text, public.transaction_kind, bigint, text, uuid, uuid, uuid,
  public.recurring_frequency, int, date, boolean
) to authenticated;
grant execute on function public.delete_recurring(uuid, uuid) to authenticated;
grant execute on function public.post_all_recurring_due(uuid, timestamptz) to authenticated;
