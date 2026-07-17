-- Category management: user-editable chart of categories.
--
-- Categories already exist in the schema but had no management surface. This
-- migration (1) makes the name uniqueness constraint partial to active rows so
-- that archiving a category frees its name for reuse, and (2) adds an
-- upsert_category RPC that the app uses to create, rename, archive, and
-- restore categories. System categories remain immutable.

-- 1) Partial unique index: only one *active* category per (workspace, kind, name).
-- NOTE: any INSERT ... ON CONFLICT targeting this index must include
-- `WHERE (is_active)` (see 20260717160000_fix_category_on_conflict_partial.sql).
drop index if exists public.categories_workspace_kind_name_unique;
create unique index categories_workspace_kind_name_unique
  on public.categories (workspace_id, kind, lower(btrim(name)))
  where is_active;

-- 2) Upsert RPC. p_category_id null => create; otherwise update name/active.
--    kind is immutable after creation; system categories cannot be touched.
create or replace function public.upsert_category(
  p_workspace_id uuid,
  p_name text,
  p_kind public.category_kind,
  p_category_id uuid default null,
  p_is_active boolean default true
)
returns public.categories
language plpgsql
security definer
set search_path = public, private, pg_temp
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_row public.categories%rowtype;
  v_name text := btrim(p_name);
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;

  if p_category_id is not null then
    select * into v_row
      from public.categories
     where workspace_id = p_workspace_id
       and id = p_category_id
       and is_system = false
     for update;

    if not found then
      raise exception 'category_not_found' using errcode = 'P0002';
    end if;

    if exists (
      select 1 from public.categories
       where workspace_id = p_workspace_id
         and kind = v_row.kind
         and is_active
         and lower(btrim(name)) = lower(v_name)
         and id <> p_category_id
    ) then
      raise exception 'category_name_in_use' using errcode = '23505';
    end if;

    update public.categories
       set name = v_name,
           is_active = p_is_active,
           updated_at = clock_timestamp()
     where id = p_category_id
    returning * into v_row;

    return v_row;
  end if;

  -- Create path.
  if exists (
    select 1 from public.categories
     where workspace_id = p_workspace_id
       and kind = p_kind
       and is_active
       and lower(btrim(name)) = lower(v_name)
  ) then
    raise exception 'category_name_in_use' using errcode = '23505';
  end if;

  insert into public.categories (workspace_id, name, kind, is_system, is_active, created_by)
  values (p_workspace_id, v_name, p_kind, false, p_is_active, v_user_id)
  returning * into v_row;

  return v_row;
end;
$fn$;

revoke all on function public.upsert_category(uuid, text, public.category_kind, uuid, boolean) from public;
grant execute on function public.upsert_category(uuid, text, public.category_kind, uuid, boolean) to authenticated;
