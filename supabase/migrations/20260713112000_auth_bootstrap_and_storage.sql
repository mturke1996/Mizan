-- Auth bootstrap and private payment-proof storage.

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_workspace_name text;
  v_workspace_id uuid;
  v_subscription_id uuid;
  v_trial_plan_id uuid;
  v_asset_account_id uuid;
  v_wallet_id uuid;
  v_started_at timestamptz := pg_catalog.clock_timestamp();
  v_trial_ends_at timestamptz;
begin
  -- raw_user_meta_data is never trusted for authorization. The only accepted
  -- metadata field is the optional display name.
  v_display_name := nullif(
    pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'),
    ''
  );

  if v_display_name is not null
     and pg_catalog.char_length(v_display_name) > 120
  then
    raise exception using
      errcode = '22023',
      message = 'display_name cannot exceed 120 characters';
  end if;

  v_workspace_name := coalesce(v_display_name, 'My workspace');
  v_trial_ends_at := v_started_at + interval '14 days';

  insert into public.profiles (
    id,
    system_role,
    account_status,
    display_name
  )
  values (
    new.id,
    'user',
    'active',
    v_display_name
  );

  insert into public.workspaces (
    name,
    default_currency_code,
    status,
    created_by
  )
  values (
    v_workspace_name,
    'LYD',
    'active',
    new.id
  )
  returning id into v_workspace_id;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    status
  )
  values (
    v_workspace_id,
    new.id,
    'owner',
    'active'
  );

  select plan.id
    into v_trial_plan_id
    from public.subscription_plans as plan
   where plan.code = 'trial'
     and plan.trial_days = 14
     and plan.is_active;

  if v_trial_plan_id is null then
    raise exception using
      errcode = '55000',
      message = '14-day trial plan is unavailable';
  end if;

  insert into public.workspace_subscriptions (
    workspace_id,
    plan_id,
    status,
    starts_at,
    trial_ends_at,
    current_period_ends_at
  )
  values (
    v_workspace_id,
    v_trial_plan_id,
    'trialing',
    v_started_at,
    v_trial_ends_at,
    v_trial_ends_at
  )
  returning id into v_subscription_id;

  insert into public.subscription_events (
    workspace_id,
    subscription_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    metadata
  )
  values (
    v_workspace_id,
    v_subscription_id,
    new.id,
    'trial_started',
    null,
    'trialing',
    pg_catalog.jsonb_build_object(
      'trial_ends_at', v_trial_ends_at
    )
  );

  insert into public.categories (
    workspace_id,
    name,
    kind,
    is_system,
    created_by
  )
  values
    (
      v_workspace_id,
      'General income',
      'income',
      true,
      new.id
    ),
    (
      v_workspace_id,
      'General expense',
      'expense',
      true,
      new.id
    );

  perform private.ensure_system_accounts(
    v_workspace_id,
    'LYD',
    new.id
  );

  insert into public.ledger_accounts (
    workspace_id,
    currency_code,
    account_type,
    name,
    created_by
  )
  values (
    v_workspace_id,
    'LYD',
    'asset',
    'Cash',
    new.id
  )
  returning id into v_asset_account_id;

  insert into public.wallets (
    workspace_id,
    ledger_account_id,
    currency_code,
    name,
    status,
    created_by
  )
  values (
    v_workspace_id,
    v_asset_account_id,
    'LYD',
    'Cash',
    'active',
    new.id
  )
  returning id into v_wallet_id;

  insert into public.notifications (
    user_id,
    workspace_id,
    kind,
    title,
    body,
    metadata
  )
  values (
    new.id,
    v_workspace_id,
    'billing',
    'Trial started',
    'Your 14-day workspace trial is active.',
    pg_catalog.jsonb_build_object(
      'trial_ends_at', v_trial_ends_at
    )
  );

  perform private.write_audit(
    v_workspace_id,
    new.id,
    'workspace.bootstrapped',
    'workspaces',
    v_workspace_id,
    pg_catalog.jsonb_build_object(
      'subscription_id', v_subscription_id,
      'wallet_id', v_wallet_id
    )
  );

  return new;
end;
$$;

revoke all on function private.handle_new_user()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function private.payment_proof_path_is_valid(p_name text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    p_name !~ '[[:cntrl:]]'
    and p_name ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|pdf)$'
$$;

create function private.payment_proof_path_matches(
  p_name text,
  p_workspace_id uuid,
  p_payment_request_id uuid
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    coalesce(private.payment_proof_path_is_valid(p_name), false)
    and pg_catalog.split_part(p_name, '/', 1) = p_workspace_id::text
    and pg_catalog.split_part(p_name, '/', 2) = p_payment_request_id::text
$$;

create function private.can_access_payment_proof(
  p_name text,
  p_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(private.payment_proof_path_is_valid(p_name), false)
    and exists (
      select 1
        from public.payment_requests as request
       where request.workspace_id::text
               = pg_catalog.split_part(p_name, '/', 1)
         and request.id::text
               = pg_catalog.split_part(p_name, '/', 2)
         and (
           private.is_supervisor()
           or (
             private.is_workspace_member(request.workspace_id)
             and (
               request.requested_by = auth.uid()
               or private.has_workspace_role(
                 request.workspace_id,
                 array['owner', 'admin']::public.workspace_role[]
               )
             )
             and (not p_write or request.status = 'pending')
           )
         )
    )
$$;

create function public.attach_payment_proof(
  p_payment_request_id uuid,
  p_object_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.payment_requests%rowtype;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'authentication required';
  end if;

  select request.*
    into v_request
    from public.payment_requests as request
   where request.id = p_payment_request_id
   for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'payment request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception using
      errcode = '55000',
      message = 'only pending requests accept payment proofs';
  end if;

  if not private.payment_proof_path_matches(
    p_object_path,
    v_request.workspace_id,
    v_request.id
  ) then
    raise exception using
      errcode = '22023',
      message = 'payment proof path is malformed or belongs to another request';
  end if;

  if not private.can_access_payment_proof(p_object_path, true) then
    raise exception using
      errcode = '42501',
      message = 'payment proof access denied';
  end if;

  if not exists (
    select 1
      from storage.objects as object
     where object.bucket_id = 'payment-proofs'
       and object.name = p_object_path
  ) then
    raise exception using
      errcode = '22023',
      message = 'uploaded payment proof object not found';
  end if;

  update public.payment_requests as request
     set proof_object_path = p_object_path
   where request.id = p_payment_request_id;

  perform private.write_audit(
    v_request.workspace_id,
    v_user_id,
    'payment_request.proof_attached',
    'payment_requests',
    v_request.id,
    pg_catalog.jsonb_build_object('object_path', p_object_path)
  );

  return v_request.id;
end;
$$;

comment on function public.attach_payment_proof(uuid, text) is
  'Attaches a strictly shaped private Storage object to a pending request.';

revoke all on function private.payment_proof_path_is_valid(text)
  from public, anon, authenticated;
revoke all on function private.payment_proof_path_matches(text, uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_access_payment_proof(text, boolean)
  from public, anon, authenticated;
revoke all on function public.attach_payment_proof(uuid, text)
  from public, anon, authenticated;

grant execute on function private.can_access_payment_proof(text, boolean)
  to authenticated;
grant execute on function public.attach_payment_proof(uuid, text)
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy payment_proofs_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and private.can_access_payment_proof(name, false)
);

create policy payment_proofs_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and private.can_access_payment_proof(name, true)
);

create policy payment_proofs_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'payment-proofs'
  and private.can_access_payment_proof(name, true)
)
with check (
  bucket_id = 'payment-proofs'
  and private.can_access_payment_proof(name, true)
);

create policy payment_proofs_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and private.can_access_payment_proof(name, true)
);
