-- Wave 4: trust platform — attachments, goals, member invites.

alter type private.idempotency_operation
  add value if not exists 'create_workspace_invite';
alter type private.idempotency_operation
  add value if not exists 'accept_workspace_invite';
alter type private.idempotency_operation
  add value if not exists 'upsert_workspace_goal';

create table public.financial_event_attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  financial_event_id uuid not null,
  object_path text not null,
  file_name text not null,
  content_type text not null,
  byte_size integer not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint financial_event_attachments_workspace_id_id
    unique (workspace_id, id),
  constraint financial_event_attachments_event_fk
    foreign key (workspace_id, financial_event_id)
    references public.financial_events (workspace_id, id),
  constraint financial_event_attachments_creator_member_fk
    foreign key (workspace_id, created_by)
    references public.workspace_members (workspace_id, user_id),
  constraint financial_event_attachments_path_shape
    check (
      object_path = pg_catalog.btrim(object_path)
      and pg_catalog.char_length(object_path) between 8 and 512
    ),
  constraint financial_event_attachments_file_name_shape
    check (
      file_name = pg_catalog.btrim(file_name)
      and pg_catalog.char_length(file_name) between 1 and 180
    ),
  constraint financial_event_attachments_content_type_shape
    check (
      content_type = pg_catalog.btrim(content_type)
      and pg_catalog.char_length(content_type) between 3 and 120
    ),
  constraint financial_event_attachments_byte_size_range
    check (byte_size > 0 and byte_size <= 10485760)
);

create unique index financial_event_attachments_object_path_unique
  on public.financial_event_attachments (object_path);

create index financial_event_attachments_event_idx
  on public.financial_event_attachments (workspace_id, financial_event_id);

alter table public.financial_event_attachments enable row level security;

create policy financial_event_attachments_select_member
on public.financial_event_attachments
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create table public.workspace_goals (
  workspace_id uuid primary key references public.workspaces (id),
  month_key text not null,
  income_goal_minor bigint not null,
  currency_code text not null references public.currencies (code),
  note text,
  updated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint workspace_goals_month_key_shape
    check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint workspace_goals_income_positive
    check (income_goal_minor > 0),
  constraint workspace_goals_note_length
    check (note is null or pg_catalog.char_length(note) <= 500),
  constraint workspace_goals_updater_member_fk
    foreign key (workspace_id, updated_by)
    references public.workspace_members (workspace_id, user_id)
);

alter table public.workspace_goals enable row level security;

create policy workspace_goals_select_member
on public.workspace_goals
for select
to authenticated
using (private.is_workspace_member(workspace_id));

create trigger workspace_goals_set_updated_at
before update on public.workspace_goals
for each row execute function private.set_updated_at();

create table public.workspace_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id),
  email text not null,
  role public.workspace_role not null default 'member',
  token text not null,
  invited_by uuid not null references public.profiles (id),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint workspace_invites_workspace_id_id unique (workspace_id, id),
  constraint workspace_invites_email_shape
    check (
      email = lower(pg_catalog.btrim(email))
      and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    ),
  constraint workspace_invites_role_allowed
    check (role in ('admin', 'member', 'viewer')),
  constraint workspace_invites_token_shape
    check (pg_catalog.char_length(token) between 20 and 128),
  constraint workspace_invites_inviter_member_fk
    foreign key (workspace_id, invited_by)
    references public.workspace_members (workspace_id, user_id)
);

create unique index workspace_invites_token_unique
  on public.workspace_invites (token);

create unique index workspace_invites_open_email_unique
  on public.workspace_invites (workspace_id, email)
  where accepted_at is null;

alter table public.workspace_invites enable row level security;

create policy workspace_invites_select_admin
on public.workspace_invites
for select
to authenticated
using (
  private.has_workspace_role(
    workspace_id,
    array['owner', 'admin']::public.workspace_role[]
  )
  or (
    accepted_at is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

create or replace function public.upsert_workspace_goal(
  p_workspace_id uuid,
  p_month_key text,
  p_income_goal_minor bigint,
  p_currency_code text,
  p_note text default null,
  p_client_id text default null
)
returns public.workspace_goals
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.workspace_goals%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;
  if p_month_key is null or p_month_key !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid_month_key' using errcode = '22023';
  end if;
  if p_income_goal_minor is null or p_income_goal_minor <= 0 then
    raise exception 'invalid_goal_amount' using errcode = '22023';
  end if;

  insert into public.workspace_goals (
    workspace_id,
    month_key,
    income_goal_minor,
    currency_code,
    note,
    updated_by
  ) values (
    p_workspace_id,
    p_month_key,
    p_income_goal_minor,
    upper(p_currency_code),
    nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
    v_user_id
  )
  on conflict (workspace_id) do update
    set month_key = excluded.month_key,
        income_goal_minor = excluded.income_goal_minor,
        currency_code = excluded.currency_code,
        note = excluded.note,
        updated_by = excluded.updated_by,
        updated_at = clock_timestamp()
  returning * into v_row;

  return v_row;
end;
$$;

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

create or replace function public.accept_workspace_invite(
  p_token text,
  p_client_id text default null
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.workspace_invites%rowtype;
  v_member public.workspace_members%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select *
  into v_invite
  from public.workspace_invites
  where token = p_token
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite_already_accepted' using errcode = '23505';
  end if;
  if v_invite.expires_at <= clock_timestamp() then
    raise exception 'invite_expired' using errcode = '22023';
  end if;
  if v_invite.email <> v_email then
    raise exception 'invite_email_mismatch' using errcode = '42501';
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role
  ) values (
    v_invite.workspace_id,
    v_user_id,
    v_invite.role
  )
  on conflict (workspace_id, user_id) do update
    set role = excluded.role
  returning * into v_member;

  update public.workspace_invites
  set accepted_at = clock_timestamp(),
      accepted_by = v_user_id
  where id = v_invite.id;

  return v_member;
end;
$$;

create or replace function public.attach_financial_event_proof(
  p_workspace_id uuid,
  p_event_id uuid,
  p_object_path text,
  p_file_name text,
  p_content_type text,
  p_byte_size integer
)
returns public.financial_event_attachments
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.financial_event_attachments%rowtype;
  v_prefix text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  v_prefix := p_workspace_id::text || '/' || p_event_id::text || '/';
  if left(p_object_path, length(v_prefix)) <> v_prefix then
    raise exception 'invalid_attachment_path' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.financial_events as event
    where event.workspace_id = p_workspace_id
      and event.id = p_event_id
  ) then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;

  insert into public.financial_event_attachments (
    workspace_id,
    financial_event_id,
    object_path,
    file_name,
    content_type,
    byte_size,
    created_by
  ) values (
    p_workspace_id,
    p_event_id,
    p_object_path,
    pg_catalog.btrim(p_file_name),
    pg_catalog.btrim(p_content_type),
    p_byte_size,
    v_user_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-attachments',
  'event-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create or replace function private.can_access_event_attachment(
  p_name text,
  p_write boolean
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/.+'
    and private.is_workspace_member((split_part(p_name, '/', 1))::uuid)
    and (
      not p_write
      or private.can_write_workspace((split_part(p_name, '/', 1))::uuid)
    );
$$;

create policy event_attachments_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'event-attachments'
  and private.can_access_event_attachment(name, false)
);

create policy event_attachments_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-attachments'
  and private.can_access_event_attachment(name, true)
);

revoke all on function public.upsert_workspace_goal(uuid, text, bigint, text, text, text)
  from public, anon;
revoke all on function public.create_workspace_invite(uuid, text, public.workspace_role, text)
  from public, anon;
revoke all on function public.accept_workspace_invite(text, text)
  from public, anon;
revoke all on function public.attach_financial_event_proof(uuid, uuid, text, text, text, integer)
  from public, anon;

grant execute on function public.upsert_workspace_goal(uuid, text, bigint, text, text, text)
  to authenticated;
grant execute on function public.create_workspace_invite(uuid, text, public.workspace_role, text)
  to authenticated;
grant execute on function public.accept_workspace_invite(text, text)
  to authenticated;
grant execute on function public.attach_financial_event_proof(uuid, uuid, text, text, text, integer)
  to authenticated;
