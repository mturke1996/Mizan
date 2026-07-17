-- Per-category monthly budgets with burn alerts.
--
-- A budget is a monthly spending limit per expense category. It is not tied to
-- a specific calendar month: the app compares the limit to the current month's
-- spend for that category. One budget per (workspace, category). Only expense
-- categories may have budgets (enforced in the RPC).

create table public.budgets (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  category_id uuid not null,
  currency_code text not null references public.currencies (code),
  limit_minor bigint not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint budgets_workspace_id_id unique (workspace_id, id),
  constraint budgets_category_fk
    foreign key (workspace_id, category_id)
    references public.categories (workspace_id, id),
  constraint budgets_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint budgets_limit_positive check (limit_minor > 0)
);

create unique index budgets_workspace_category_unique
  on public.budgets (workspace_id, category_id);
create index budgets_workspace_idx on public.budgets (workspace_id);

create trigger budgets_set_updated_at
before update on public.budgets
for each row execute function private.set_updated_at();

alter table public.budgets enable row level security;

create policy budgets_select_member
on public.budgets
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create policy budgets_insert_writer
on public.budgets
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_write_workspace(workspace_id)
);

create policy budgets_update_writer
on public.budgets
for update
to authenticated
using (private.can_write_workspace(workspace_id))
with check (private.can_write_workspace(workspace_id));

create policy budgets_delete_writer
on public.budgets
for delete
to authenticated
using (private.can_write_workspace(workspace_id));

grant select on public.budgets to authenticated;
grant insert (workspace_id, category_id, currency_code, limit_minor, created_by)
  on public.budgets to authenticated;
grant update (limit_minor) on public.budgets to authenticated;
grant delete on public.budgets to authenticated;

-- Upsert: p_budget_id null => create, otherwise update the limit. The category
-- must be an active expense category in the workspace.
create or replace function public.upsert_budget(
  p_workspace_id uuid,
  p_category_id uuid,
  p_currency_code text,
  p_limit_minor bigint,
  p_budget_id uuid default null
)
returns public.budgets
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_row public.budgets%rowtype;
  v_kind public.category_kind;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_limit_minor is null or p_limit_minor <= 0 then
    raise exception 'invalid_budget_limit' using errcode = '22023';
  end if;

  select kind into v_kind
    from public.categories
   where workspace_id = p_workspace_id
     and id = p_category_id
     and is_active;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
  if v_kind <> 'expense' then
    raise exception 'budget_expense_category_only' using errcode = '22023';
  end if;

  if p_budget_id is not null then
    update public.budgets
       set limit_minor = p_limit_minor,
           updated_at = clock_timestamp()
     where workspace_id = p_workspace_id
       and id = p_budget_id
    returning * into v_row;
    if not found then
      raise exception 'budget_not_found' using errcode = 'P0002';
    end if;
    return v_row;
  end if;

  insert into public.budgets (workspace_id, category_id, currency_code, limit_minor, created_by)
  values (p_workspace_id, p_category_id, p_currency_code, p_limit_minor, v_user_id)
  on conflict (workspace_id, category_id) do update
    set limit_minor = excluded.limit_minor,
        updated_at = clock_timestamp()
  returning * into v_row;

  return v_row;
end;
$fn$;

create or replace function public.delete_budget(
  p_workspace_id uuid,
  p_budget_id uuid
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
  delete from public.budgets
   where workspace_id = p_workspace_id
     and id = p_budget_id;
end;
$fn$;

revoke all on function public.upsert_budget(uuid, uuid, text, bigint, uuid) from public;
revoke all on function public.delete_budget(uuid, uuid) from public;
grant execute on function public.upsert_budget(uuid, uuid, text, bigint, uuid) to authenticated;
grant execute on function public.delete_budget(uuid, uuid) to authenticated;
