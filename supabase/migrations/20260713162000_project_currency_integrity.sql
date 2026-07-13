-- Project goals and labor liabilities are denominated in the workspace base
-- currency. Prevent mixed-currency ledger events from silently corrupting
-- project profit, margin, and worker-coverage analytics.

create or replace function private.enforce_project_base_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default_currency text;
begin
  if new.project_id is null then
    return new;
  end if;

  select workspace.default_currency_code
    into v_default_currency
    from public.workspaces as workspace
   where workspace.id = new.workspace_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'workspace not found for project-linked financial event';
  end if;

  if new.currency_code <> v_default_currency then
    raise exception using
      errcode = '22023',
      message = 'project-linked transactions must use the workspace default currency';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_project_base_currency() from public;
revoke all on function private.enforce_project_base_currency() from anon;
revoke all on function private.enforce_project_base_currency() from authenticated;

drop trigger if exists financial_events_project_currency_guard
  on public.financial_events;

create trigger financial_events_project_currency_guard
before insert or update of workspace_id, project_id, currency_code
on public.financial_events
for each row
execute function private.enforce_project_base_currency();

comment on function private.enforce_project_base_currency() is
  'Rejects project-linked financial events outside the workspace base currency so project and labor analytics remain comparable.';
