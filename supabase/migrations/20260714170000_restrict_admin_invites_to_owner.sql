-- Only workspace owners may invite someone as admin.
-- Admins may still invite as member or viewer.

create or replace function public.create_workspace_invite(
  p_workspace_id uuid,
  p_email text,
  p_role public.workspace_role default 'member',
  p_client_id text default null
)
returns public.workspace_invites
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(pg_catalog.btrim(p_email));
  v_row public.workspace_invites%rowtype;
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
  if p_role not in ('admin', 'member', 'viewer') then
    raise exception 'invalid_invite_role' using errcode = '22023';
  end if;
  if p_role = 'admin'
    and not private.has_workspace_role(
      p_workspace_id,
      array['owner']::public.workspace_role[]
    )
  then
    raise exception 'admin_invite_owner_only' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.workspace_members as member
    join auth.users as auth_user on auth_user.id = member.user_id
    where member.workspace_id = p_workspace_id
      and lower(coalesce(auth_user.email, '')) = v_email
  ) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  insert into public.workspace_invites (
    workspace_id,
    email,
    role,
    token,
    invited_by,
    expires_at
  ) values (
    p_workspace_id,
    v_email,
    p_role,
    encode(extensions.gen_random_bytes(24), 'hex'),
    v_user_id,
    clock_timestamp() + interval '7 days'
  )
  returning * into v_row;

  return v_row;
end;
$$;
