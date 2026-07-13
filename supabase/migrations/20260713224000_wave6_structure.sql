-- Wave 6: parent projects, project members, stored achievement unlocks.

alter table public.projects
  add column if not exists parent_project_id uuid;

alter table public.projects
  drop constraint if exists projects_parent_fk;

alter table public.projects
  add constraint projects_parent_fk
  foreign key (workspace_id, parent_project_id)
  references public.projects (workspace_id, id);

create or replace function private.enforce_project_parent_depth()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.parent_project_id is null then
    return new;
  end if;
  if new.parent_project_id = new.id then
    raise exception 'invalid_parent_project' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.projects as parent
    where parent.workspace_id = new.workspace_id
      and parent.id = new.parent_project_id
      and parent.parent_project_id is not null
  ) then
    raise exception 'parent_project_depth_exceeded' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.projects as child
    where child.workspace_id = new.workspace_id
      and child.parent_project_id = new.id
  ) and new.parent_project_id is not null then
    raise exception 'parent_project_depth_exceeded' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_parent_depth on public.projects;
create trigger projects_parent_depth
before insert or update of parent_project_id
on public.projects
for each row execute function private.enforce_project_parent_depth();

create type public.project_member_role as enum (
  'manager',
  'contributor',
  'viewer'
);

create table public.project_members (
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  user_id uuid not null references public.profiles (id),
  role public.project_member_role not null default 'contributor',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, project_id, user_id),
  constraint project_members_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_members_member_fk
    foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id),
  constraint project_members_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id)
);

alter table public.project_members enable row level security;

create policy project_members_select_member
on public.project_members for select to authenticated
using (private.is_workspace_member(workspace_id));

create table public.workspace_achievement_unlocks (
  workspace_id uuid not null references public.workspaces (id),
  achievement_id text not null,
  unlocked_at timestamptz not null default clock_timestamp(),
  evidence jsonb not null default '{}'::jsonb,
  primary key (workspace_id, achievement_id),
  constraint workspace_achievement_unlocks_id_shape
    check (
      achievement_id = pg_catalog.btrim(achievement_id)
      and pg_catalog.char_length(achievement_id) between 2 and 80
    )
);

create table public.project_achievement_unlocks (
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null,
  achievement_id text not null,
  unlocked_at timestamptz not null default clock_timestamp(),
  evidence jsonb not null default '{}'::jsonb,
  primary key (workspace_id, project_id, achievement_id),
  constraint project_achievement_unlocks_project_fk
    foreign key (workspace_id, project_id)
    references public.projects (workspace_id, id),
  constraint project_achievement_unlocks_id_shape
    check (
      achievement_id = pg_catalog.btrim(achievement_id)
      and pg_catalog.char_length(achievement_id) between 2 and 80
    )
);

alter table public.workspace_achievement_unlocks enable row level security;
alter table public.project_achievement_unlocks enable row level security;

create policy workspace_achievement_unlocks_select_member
on public.workspace_achievement_unlocks for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy project_achievement_unlocks_select_member
on public.project_achievement_unlocks for select to authenticated
using (private.is_workspace_member(workspace_id));

create or replace function public.unlock_workspace_achievement(
  p_workspace_id uuid,
  p_achievement_id text,
  p_evidence jsonb default '{}'::jsonb
)
returns public.workspace_achievement_unlocks
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.workspace_achievement_unlocks%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  insert into public.workspace_achievement_unlocks (
    workspace_id, achievement_id, evidence
  ) values (
    p_workspace_id,
    pg_catalog.btrim(p_achievement_id),
    coalesce(p_evidence, '{}'::jsonb)
  )
  on conflict (workspace_id, achievement_id) do update
    set evidence = excluded.evidence
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.unlock_project_achievement(
  p_workspace_id uuid,
  p_project_id uuid,
  p_achievement_id text,
  p_evidence jsonb default '{}'::jsonb
)
returns public.project_achievement_unlocks
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.project_achievement_unlocks%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  insert into public.project_achievement_unlocks (
    workspace_id, project_id, achievement_id, evidence
  ) values (
    p_workspace_id,
    p_project_id,
    pg_catalog.btrim(p_achievement_id),
    coalesce(p_evidence, '{}'::jsonb)
  )
  on conflict (workspace_id, project_id, achievement_id) do update
    set evidence = excluded.evidence
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.upsert_project_member(
  p_workspace_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_role public.project_member_role
)
returns public.project_members
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.project_members%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_workspace_role(
    p_workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  ) then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  insert into public.project_members (
    workspace_id, project_id, user_id, role, created_by
  ) values (
    p_workspace_id, p_project_id, p_user_id, p_role, v_user_id
  )
  on conflict (workspace_id, project_id, user_id) do update
    set role = excluded.role
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.unlock_workspace_achievement(uuid, text, jsonb)
  from public, anon;
revoke all on function public.unlock_project_achievement(uuid, uuid, text, jsonb)
  from public, anon;
revoke all on function public.upsert_project_member(
  uuid, uuid, uuid, public.project_member_role
) from public, anon;

grant execute on function public.unlock_workspace_achievement(uuid, text, jsonb)
  to authenticated;
grant execute on function public.unlock_project_achievement(uuid, uuid, text, jsonb)
  to authenticated;
grant execute on function public.upsert_project_member(
  uuid, uuid, uuid, public.project_member_role
) to authenticated;
