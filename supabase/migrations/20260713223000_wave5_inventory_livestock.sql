-- Wave 5: inventory movements/locations/barcode + livestock module.

create type public.inventory_movement_type as enum (
  'in',
  'out',
  'adjust',
  'transfer'
);

create type public.livestock_event_type as enum (
  'hatch',
  'birth',
  'death',
  'sale',
  'transfer'
);

alter type private.idempotency_operation
  add value if not exists 'post_inventory_movement';
alter type private.idempotency_operation
  add value if not exists 'create_livestock_batch';
alter type private.idempotency_operation
  add value if not exists 'post_livestock_event';

create or replace function private.project_modules_are_valid(p_modules jsonb)
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_modules) <> 'object' then false
    else
      p_modules ?& array[
        'transactions',
        'goal',
        'workers',
        'capital',
        'inventory',
        'livestock'
      ]::text[]
      and (
        p_modules - array[
          'transactions',
          'goal',
          'workers',
          'capital',
          'inventory',
          'livestock'
        ]::text[]
      ) = '{}'::jsonb
      and pg_catalog.jsonb_typeof(p_modules -> 'transactions') = 'boolean'
      and pg_catalog.jsonb_typeof(p_modules -> 'goal') = 'boolean'
      and pg_catalog.jsonb_typeof(p_modules -> 'workers') = 'boolean'
      and pg_catalog.jsonb_typeof(p_modules -> 'capital') = 'boolean'
      and pg_catalog.jsonb_typeof(p_modules -> 'inventory') = 'boolean'
      and pg_catalog.jsonb_typeof(p_modules -> 'livestock') = 'boolean'
      and p_modules -> 'transactions' = 'true'::jsonb
  end
$$;

update public.projects
set modules = coalesce(modules, '{}'::jsonb) || jsonb_build_object(
  'livestock',
  case
    when project_type in ('birds', 'animals') then true
    else false
  end
)
where modules is null
   or not (modules ? 'livestock');

alter table public.projects
  alter column modules set default '{
    "transactions": true,
    "goal": false,
    "workers": false,
    "capital": false,
    "inventory": false,
    "livestock": false
  }'::jsonb;

create table public.project_inventory_locations (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint project_inventory_locations_workspace_id_id
    unique (workspace_id, id),
  constraint project_inventory_locations_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_inventory_locations_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint project_inventory_locations_name_shape
    check (
      name = pg_catalog.btrim(name)
      and pg_catalog.char_length(name) between 1 and 120
    )
);

create unique index project_inventory_locations_name_unique
  on public.project_inventory_locations (
    workspace_id,
    project_id,
    lower(name)
  );

alter table public.project_inventory_items
  add column if not exists location_id uuid,
  add column if not exists barcode text;

alter table public.project_inventory_items
  drop constraint if exists project_inventory_items_location_fk;

alter table public.project_inventory_items
  add constraint project_inventory_items_location_fk
  foreign key (workspace_id, location_id)
  references public.project_inventory_locations (workspace_id, id);

create unique index if not exists project_inventory_items_barcode_unique
  on public.project_inventory_items (workspace_id, project_id, barcode)
  where barcode is not null and status = 'active';

create table public.project_inventory_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  item_id uuid not null,
  movement_type public.inventory_movement_type not null,
  quantity numeric(18, 4) not null,
  from_location_id uuid,
  to_location_id uuid,
  note text,
  occurred_on date not null default (timezone('utc', now()))::date,
  created_by uuid not null references public.profiles (id),
  client_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint project_inventory_movements_workspace_id_id
    unique (workspace_id, id),
  constraint project_inventory_movements_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_inventory_movements_item_fk
    foreign key (workspace_id, item_id)
    references public.project_inventory_items (workspace_id, id),
  constraint project_inventory_movements_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint project_inventory_movements_quantity_nonzero
    check (quantity <> 0),
  constraint project_inventory_movements_client_id_shape
    check (pg_catalog.char_length(pg_catalog.btrim(client_id)) between 8 and 128)
);

create unique index project_inventory_movements_client_unique
  on public.project_inventory_movements (workspace_id, client_id);

create table public.livestock_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  name text not null,
  species text,
  head_count integer not null default 0,
  opened_on date not null default (timezone('utc', now()))::date,
  status text not null default 'active',
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint livestock_batches_workspace_id_id unique (workspace_id, id),
  constraint livestock_batches_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint livestock_batches_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint livestock_batches_name_shape
    check (
      name = pg_catalog.btrim(name)
      and pg_catalog.char_length(name) between 1 and 160
    ),
  constraint livestock_batches_head_count_nonnegative
    check (head_count >= 0),
  constraint livestock_batches_status_allowed
    check (status in ('active', 'closed'))
);

create table public.livestock_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  batch_id uuid not null,
  event_type public.livestock_event_type not null,
  quantity integer not null,
  occurred_on date not null default (timezone('utc', now()))::date,
  note text,
  created_by uuid not null references public.profiles (id),
  client_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint livestock_events_workspace_id_id unique (workspace_id, id),
  constraint livestock_events_batch_fk
    foreign key (workspace_id, batch_id)
    references public.livestock_batches (workspace_id, id),
  constraint livestock_events_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint livestock_events_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint livestock_events_quantity_positive
    check (quantity > 0),
  constraint livestock_events_client_id_shape
    check (pg_catalog.char_length(pg_catalog.btrim(client_id)) between 8 and 128)
);

create unique index livestock_events_client_unique
  on public.livestock_events (workspace_id, client_id);

alter table public.project_inventory_locations enable row level security;
alter table public.project_inventory_movements enable row level security;
alter table public.livestock_batches enable row level security;
alter table public.livestock_events enable row level security;

create policy project_inventory_locations_select_member
on public.project_inventory_locations for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy project_inventory_movements_select_member
on public.project_inventory_movements for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy livestock_batches_select_member
on public.livestock_batches for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy livestock_events_select_member
on public.livestock_events for select to authenticated
using (private.is_workspace_member(workspace_id));

create or replace function public.post_inventory_movement(
  p_workspace_id uuid,
  p_project_id uuid,
  p_item_id uuid,
  p_movement_type public.inventory_movement_type,
  p_quantity numeric,
  p_client_id text,
  p_from_location_id uuid default null,
  p_to_location_id uuid default null,
  p_note text default null,
  p_occurred_on date default null
)
returns public.project_inventory_movements
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_item public.project_inventory_items%rowtype;
  v_existing public.project_inventory_movements%rowtype;
  v_delta numeric;
  v_row public.project_inventory_movements%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  select * into v_existing
  from public.project_inventory_movements
  where workspace_id = p_workspace_id and client_id = p_client_id;
  if found then
    return v_existing;
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

  select * into v_item
  from public.project_inventory_items
  where workspace_id = p_workspace_id
    and project_id = p_project_id
    and id = p_item_id
    and status = 'active'
  for update;
  if not found then
    raise exception 'inventory_item_not_found' using errcode = 'P0002';
  end if;
  if p_quantity is null or p_quantity = 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  v_delta := case p_movement_type
    when 'in' then abs(p_quantity)
    when 'out' then -abs(p_quantity)
    when 'adjust' then p_quantity
    when 'transfer' then 0
  end;

  if p_movement_type = 'transfer' then
    if p_from_location_id is null or p_to_location_id is null then
      raise exception 'transfer_locations_required' using errcode = '22023';
    end if;
  end if;

  if v_item.quantity + v_delta < 0 then
    raise exception 'insufficient_inventory' using errcode = '22023';
  end if;

  insert into public.project_inventory_movements (
    workspace_id, project_id, item_id, movement_type, quantity,
    from_location_id, to_location_id, note, occurred_on, created_by, client_id
  ) values (
    p_workspace_id, p_project_id, p_item_id, p_movement_type, p_quantity,
    p_from_location_id, p_to_location_id,
    nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
    coalesce(p_occurred_on, (timezone('utc', now()))::date),
    v_user_id, p_client_id
  )
  returning * into v_row;

  update public.project_inventory_items
  set quantity = quantity + v_delta,
      location_id = coalesce(p_to_location_id, location_id),
      updated_at = clock_timestamp()
  where workspace_id = p_workspace_id and id = p_item_id;

  return v_row;
end;
$$;

create or replace function public.create_livestock_batch(
  p_workspace_id uuid,
  p_project_id uuid,
  p_name text,
  p_head_count integer default 0,
  p_species text default null,
  p_note text default null,
  p_client_id text default null
)
returns public.livestock_batches
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_row public.livestock_batches%rowtype;
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
  if not coalesce((v_project.modules ->> 'livestock')::boolean, false) then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  insert into public.livestock_batches (
    workspace_id, project_id, name, species, head_count, note, created_by
  ) values (
    p_workspace_id,
    p_project_id,
    pg_catalog.btrim(p_name),
    nullif(pg_catalog.btrim(coalesce(p_species, '')), ''),
    greatest(coalesce(p_head_count, 0), 0),
    nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
    v_user_id
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.post_livestock_event(
  p_workspace_id uuid,
  p_project_id uuid,
  p_batch_id uuid,
  p_event_type public.livestock_event_type,
  p_quantity integer,
  p_client_id text,
  p_note text default null,
  p_occurred_on date default null
)
returns public.livestock_events
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_batch public.livestock_batches%rowtype;
  v_existing public.livestock_events%rowtype;
  v_delta integer;
  v_row public.livestock_events%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  select * into v_existing
  from public.livestock_events
  where workspace_id = p_workspace_id and client_id = p_client_id;
  if found then
    return v_existing;
  end if;

  select * into v_project
  from public.projects
  where workspace_id = p_workspace_id and id = p_project_id;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;
  if not coalesce((v_project.modules ->> 'livestock')::boolean, false) then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  select * into v_batch
  from public.livestock_batches
  where workspace_id = p_workspace_id
    and project_id = p_project_id
    and id = p_batch_id
  for update;
  if not found then
    raise exception 'livestock_batch_not_found' using errcode = 'P0002';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;

  v_delta := case p_event_type
    when 'hatch' then p_quantity
    when 'birth' then p_quantity
    when 'death' then -p_quantity
    when 'sale' then -p_quantity
    when 'transfer' then -p_quantity
  end;

  if v_batch.head_count + v_delta < 0 then
    raise exception 'insufficient_livestock' using errcode = '22023';
  end if;

  insert into public.livestock_events (
    workspace_id, project_id, batch_id, event_type, quantity,
    occurred_on, note, created_by, client_id
  ) values (
    p_workspace_id, p_project_id, p_batch_id, p_event_type, p_quantity,
    coalesce(p_occurred_on, (timezone('utc', now()))::date),
    nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
    v_user_id, p_client_id
  )
  returning * into v_row;

  update public.livestock_batches
  set head_count = head_count + v_delta,
      updated_at = clock_timestamp()
  where workspace_id = p_workspace_id and id = p_batch_id;

  return v_row;
end;
$$;

revoke all on function public.post_inventory_movement(
  uuid, uuid, uuid, public.inventory_movement_type, numeric, text, uuid, uuid, text, date
) from public, anon;
revoke all on function public.create_livestock_batch(
  uuid, uuid, text, integer, text, text, text
) from public, anon;
revoke all on function public.post_livestock_event(
  uuid, uuid, uuid, public.livestock_event_type, integer, text, text, date
) from public, anon;

grant execute on function public.post_inventory_movement(
  uuid, uuid, uuid, public.inventory_movement_type, numeric, text, uuid, uuid, text, date
) to authenticated;
grant execute on function public.create_livestock_batch(
  uuid, uuid, text, integer, text, text, text
) to authenticated;
grant execute on function public.post_livestock_event(
  uuid, uuid, uuid, public.livestock_event_type, integer, text, text, date
) to authenticated;
