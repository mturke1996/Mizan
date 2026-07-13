-- Wave 5 follow-up: location create + inventory upsert fields (barcode/location).

create or replace function public.create_inventory_location(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text
)
returns public.project_inventory_locations
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_row public.project_inventory_locations%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  select * into v_project
  from public.projects
  where workspace_id = p_workspace_id and id = p_project_id;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  if not coalesce((v_project.modules ->> 'inventory')::boolean, false) then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  insert into public.project_inventory_locations (
    workspace_id, project_id, name, created_by
  ) values (
    p_workspace_id,
    p_project_id,
    pg_catalog.btrim(p_name),
    v_user_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Extend upsert to accept optional barcode + location without breaking callers.
create or replace function public.upsert_inventory_item(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text,
  p_quantity numeric,
  p_unit_label text,
  p_currency_code text,
  p_unit_cost_minor bigint default null,
  p_item_id uuid default null,
  p_barcode text default null,
  p_location_id uuid default null
)
returns public.project_inventory_items
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_item public.project_inventory_items%rowtype;
  v_name text := pg_catalog.btrim(p_name);
  v_barcode text := nullif(pg_catalog.btrim(coalesce(p_barcode, '')), '');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  select * into v_project
  from public.projects
  where workspace_id = p_workspace_id and id = p_project_id
  for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  if not coalesce((v_project.modules ->> 'inventory')::boolean, false) then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;
  if pg_catalog.char_length(v_name) < 2 then
    raise exception 'invalid_item_name' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  if p_item_id is not null then
    update public.project_inventory_items
    set name = v_name,
        quantity = p_quantity,
        unit_label = pg_catalog.btrim(p_unit_label),
        unit_cost_minor = p_unit_cost_minor,
        currency_code = upper(p_currency_code),
        barcode = v_barcode,
        location_id = p_location_id,
        updated_at = clock_timestamp()
    where workspace_id = p_workspace_id
      and project_id = p_project_id
      and id = p_item_id
      and status = 'active'
    returning * into v_item;
    if not found then
      raise exception 'inventory_item_not_found' using errcode = 'P0002';
    end if;
    return v_item;
  end if;

  insert into public.project_inventory_items (
    workspace_id, project_id, name, quantity, unit_label,
    unit_cost_minor, currency_code, barcode, location_id, created_by
  ) values (
    p_workspace_id, p_project_id, v_name, p_quantity,
    pg_catalog.btrim(p_unit_label), p_unit_cost_minor, upper(p_currency_code),
    v_barcode, p_location_id, v_user_id
  )
  returning * into v_item;

  return v_item;
end;
$$;

revoke all on function public.create_inventory_location(uuid, uuid, text)
  from public, anon;
grant execute on function public.create_inventory_location(uuid, uuid, text)
  to authenticated;

revoke all on function public.upsert_inventory_item(
  uuid, uuid, text, numeric, text, text, bigint, uuid, text, uuid
) from public, anon;
grant execute on function public.upsert_inventory_item(
  uuid, uuid, text, numeric, text, text, bigint, uuid, text, uuid
) to authenticated;

-- Expose parent + inventory barcode/location through existing detail views.
create or replace view public.project_summaries
with (security_invoker = true)
as
select
  project.id,
  project.workspace_id,
  project.name,
  project.description,
  project.goal_minor::text as goal_minor,
  project.color_token,
  project.status,
  project.project_type,
  project.modules,
  project.parent_project_id,
  project.created_by,
  project.created_at,
  project.updated_at
from public.projects as project;

create or replace view public.project_inventory_item_details
with (security_invoker = true)
as
select
  item.id,
  item.workspace_id,
  item.project_id,
  item.name,
  item.quantity,
  item.unit_label,
  item.unit_cost_minor::text as unit_cost_minor,
  item.currency_code,
  item.status,
  item.barcode,
  item.location_id,
  item.created_by,
  item.created_at,
  item.updated_at
from public.project_inventory_items as item;

grant select on public.project_summaries to authenticated;
grant select on public.project_inventory_item_details to authenticated;
