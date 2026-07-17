-- After categories_workspace_kind_name_unique became a partial unique index
-- (WHERE is_active), INSERT ... ON CONFLICT without the matching predicate
-- fails with 42P10 and breaks create_project / post_wage_movement.
-- Rebuild those functions with ON CONFLICT (... ) WHERE (is_active).

create or replace function public.create_project(
  p_workspace_id uuid,
  p_name text,
  p_project_type text,
  p_modules jsonb,
  p_description text default null,
  p_goal_minor bigint default null,
  p_color_token text default 'primary',
  p_status public.project_status default 'active',
  p_client_id uuid default extensions.gen_random_uuid(),
  p_opening_capital_minor bigint default null,
  p_seed_categories jsonb default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := pg_catalog.btrim(p_name);
  v_description text := nullif(
    pg_catalog.btrim(coalesce(p_description, '')),
    ''
  );
  v_project_type text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_project_type, 'general'))
  );
  v_modules jsonb := coalesce(
    p_modules,
    '{
      "transactions": true,
      "goal": false,
      "workers": false,
      "capital": false,
      "inventory": false,
      "livestock": false
    }'::jsonb
  );
  v_color_token text := coalesce(
    nullif(pg_catalog.btrim(coalesce(p_color_token, '')), ''),
    'primary'
  );
  v_status public.project_status := coalesce(p_status, 'active');
  v_workspace public.workspaces%rowtype;
  v_project public.projects%rowtype;
  v_seed jsonb;
  v_seed_name text;
  v_seed_kind text;
  v_seed_category_id uuid;
  v_seed_is_system boolean;
  v_seed_is_active boolean;
  v_canonical_seed_categories jsonb := '[]'::jsonb;
  v_creation_payload jsonb;
  v_creation_payload_hash bytea;
  v_stored_payload_hash bytea;
  v_stored_project_id uuid;
  v_occurred_on date := (
    pg_catalog.timezone('utc', pg_catalog.now())
  )::date;
  v_opening_payload jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_name is null
     or pg_catalog.char_length(v_name) not between 1 and 160
  then
    raise exception 'invalid_project_name' using errcode = '22023';
  end if;

  if v_description is not null
     and pg_catalog.char_length(v_description) > 500
  then
    raise exception 'invalid_project_description' using errcode = '22023';
  end if;

  if p_goal_minor is not null and p_goal_minor < 0 then
    raise exception 'invalid_project_goal' using errcode = '22023';
  end if;

  if not private.project_type_is_valid(v_project_type) then
    raise exception 'invalid_project_type' using errcode = '22023';
  end if;

  if not private.project_modules_are_valid(v_modules) then
    raise exception 'invalid_project_modules' using errcode = '22023';
  end if;

  if p_goal_minor is not null then
    if p_modules is null then
      v_modules := pg_catalog.jsonb_set(
        v_modules,
        '{goal}',
        'true'::jsonb
      );
    elsif v_modules -> 'goal' is distinct from 'true'::jsonb then
      raise exception 'module_disabled' using errcode = 'PT409';
    end if;
  end if;

  if v_color_token not in (
    'primary',
    'success',
    'warning',
    'danger',
    'info'
  ) then
    raise exception 'invalid_color_token' using errcode = '22023';
  end if;

  if p_client_id is null then
    raise exception 'client_id_required' using errcode = '22023';
  end if;

  if p_opening_capital_minor is not null then
    if v_modules -> 'capital' is distinct from 'true'::jsonb then
      raise exception 'module_disabled' using errcode = 'PT409';
    end if;

    if p_opening_capital_minor <= 0 then
      raise exception 'invalid_opening_capital' using errcode = '22023';
    end if;

    if v_status <> 'active' then
      raise exception 'project_not_active' using errcode = 'PT409';
    end if;
  end if;

  if p_seed_categories is not null then
    if pg_catalog.jsonb_typeof(p_seed_categories) <> 'array' then
      raise exception 'invalid_seed_categories' using errcode = '22023';
    end if;

    for v_seed in
      select seed.value
      from pg_catalog.jsonb_array_elements(p_seed_categories)
        as seed(value)
    loop
      if pg_catalog.jsonb_typeof(v_seed) <> 'object' then
        raise exception 'invalid_seed_category' using errcode = '22023';
      end if;

      if not (v_seed ?& array['name', 'kind']::text[])
         or (v_seed - array['name', 'kind']::text[]) <> '{}'::jsonb
      then
        raise exception 'invalid_seed_category' using errcode = '22023';
      end if;

      if pg_catalog.jsonb_typeof(v_seed -> 'name') <> 'string'
         or pg_catalog.jsonb_typeof(v_seed -> 'kind') <> 'string'
      then
        raise exception 'invalid_seed_category' using errcode = '22023';
      end if;

      v_seed_name := pg_catalog.btrim(v_seed ->> 'name');
      v_seed_kind := pg_catalog.lower(
        pg_catalog.btrim(v_seed ->> 'kind')
      );

      if v_seed_name is null
         or pg_catalog.char_length(v_seed_name) not between 1 and 120
         or v_seed_kind not in ('income', 'expense')
      then
        raise exception 'invalid_seed_category' using errcode = '22023';
      end if;
    end loop;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'kind',
          seed.kind,
          'name',
          seed.name
        )
        order by seed.kind, seed.name_key, seed.name
      ),
      '[]'::jsonb
    )
      into v_canonical_seed_categories
      from (
        select distinct
          pg_catalog.lower(
            pg_catalog.btrim(category.value ->> 'kind')
          ) as kind,
          pg_catalog.btrim(category.value ->> 'name') as name,
          pg_catalog.lower(
            pg_catalog.btrim(category.value ->> 'name')
          ) as name_key
        from pg_catalog.jsonb_array_elements(p_seed_categories)
          as category(value)
      ) as seed;
  end if;

  v_creation_payload := pg_catalog.jsonb_build_object(
    'color_token',
    v_color_token,
    'description',
    v_description,
    'goal_minor',
    p_goal_minor,
    'modules',
    v_modules,
    'name',
    v_name,
    'opening_capital_minor',
    p_opening_capital_minor,
    'project_type',
    v_project_type,
    'seed_categories',
    v_canonical_seed_categories,
    'status',
    v_status
  );
  v_creation_payload_hash := private.payload_hash(v_creation_payload);

  insert into private.project_creation_idempotency (
    workspace_id,
    client_id,
    operation,
    payload_hash
  )
  values (
    p_workspace_id,
    p_client_id,
    'create_project',
    v_creation_payload_hash
  )
  on conflict (workspace_id, client_id, operation) do nothing;

  select creation.payload_hash, creation.project_id
    into v_stored_payload_hash, v_stored_project_id
    from private.project_creation_idempotency as creation
   where creation.workspace_id = p_workspace_id
     and creation.client_id = p_client_id
     and creation.operation = 'create_project'
   for update;

  if not found then
    raise exception 'idempotency_state_missing' using errcode = 'XX000';
  end if;

  if v_stored_payload_hash is distinct from v_creation_payload_hash then
    raise exception 'idempotency_conflict' using errcode = 'PT409';
  end if;

  if v_stored_project_id is not null then
    select project.*
      into v_project
      from public.projects as project
     where project.workspace_id = p_workspace_id
       and project.id = v_stored_project_id;

    if not found then
      raise exception 'idempotency_result_missing' using errcode = 'XX000';
    end if;

    return v_project;
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select workspace.*
    into v_workspace
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
     and workspace.status = 'active';

  if not found then
    raise exception 'workspace_not_found' using errcode = 'P0002';
  end if;

  if p_opening_capital_minor is not null
     and not exists (
       select 1
       from public.currencies as currency
       where currency.code = v_workspace.default_currency_code
         and currency.is_active
     )
  then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;

  insert into public.projects (
    workspace_id,
    name,
    description,
    goal_minor,
    color_token,
    status,
    project_type,
    modules,
    created_by
  )
  values (
    p_workspace_id,
    v_name,
    v_description,
    p_goal_minor,
    v_color_token,
    v_status,
    v_project_type,
    v_modules,
    v_user_id
  )
  returning * into v_project;

  if p_seed_categories is not null then
    for v_seed in
      select seed.value
      from pg_catalog.jsonb_array_elements(v_canonical_seed_categories)
        as seed(value)
    loop
      v_seed_name := pg_catalog.btrim(v_seed ->> 'name');
      v_seed_kind := pg_catalog.lower(
        pg_catalog.btrim(v_seed ->> 'kind')
      );

      insert into public.categories as existing_category (
        workspace_id,
        name,
        kind,
        is_system,
        is_active,
        created_by
      )
      values (
        p_workspace_id,
        v_seed_name,
        v_seed_kind::public.category_kind,
        false,
        true,
        v_user_id
      )
      on conflict (
        workspace_id,
        kind,
        (pg_catalog.lower(pg_catalog.btrim(name)))
      ) where (is_active)
      do nothing
      returning id into v_seed_category_id;

      if not found then
        select
          category.id,
          category.is_system,
          category.is_active
          into
            v_seed_category_id,
            v_seed_is_system,
            v_seed_is_active
          from public.categories as category
         where category.workspace_id = p_workspace_id
           and category.kind = v_seed_kind::public.category_kind
           and pg_catalog.lower(pg_catalog.btrim(category.name)) =
             pg_catalog.lower(v_seed_name)
         for update;

        if not found then
          raise exception 'seed_category_conflict' using errcode = 'PT409';
        end if;

        if v_seed_is_system and not v_seed_is_active then
          raise exception 'seed_category_conflict' using errcode = 'PT409';
        end if;

        if not v_seed_is_system and not v_seed_is_active then
          update public.categories
             set is_active = true
           where id = v_seed_category_id
             and workspace_id = p_workspace_id
             and not is_system;

          if not found then
            raise exception 'seed_category_conflict' using errcode = 'PT409';
          end if;
        end if;
      end if;
    end loop;
  end if;

  if p_opening_capital_minor is not null then
    v_opening_payload := pg_catalog.jsonb_build_object(
      'amount_minor',
      p_opening_capital_minor,
      'currency_code',
      v_workspace.default_currency_code,
      'entry_type',
      'opening',
      'occurred_on',
      v_occurred_on,
      'project_id',
      v_project.id
    );

    insert into public.project_capital_entries (
      workspace_id,
      project_id,
      entry_type,
      amount_minor,
      currency_code,
      note,
      occurred_on,
      created_by,
      client_id,
      operation,
      payload_hash
    )
    values (
      p_workspace_id,
      v_project.id,
      'opening',
      p_opening_capital_minor,
      v_workspace.default_currency_code,
      'Opening capital',
      v_occurred_on,
      v_user_id,
      p_client_id,
      'create_project_opening_capital',
      private.payload_hash(v_opening_payload)
    );
  end if;

  update private.project_creation_idempotency
     set project_id = v_project.id,
         updated_at = pg_catalog.clock_timestamp()
   where workspace_id = p_workspace_id
     and client_id = p_client_id
     and operation = 'create_project'
     and payload_hash = v_creation_payload_hash
     and project_id is null;

  if not found then
    raise exception 'idempotency_state_conflict' using errcode = 'XX000';
  end if;

  return v_project;
end;
$$;

-- Patch post_wage_movement category upsert (same partial-index issue).
-- Only the ON CONFLICT predicate changes; body otherwise matches remote.
do $patch$
declare
  v_def text;
  v_patched text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'post_wage_movement'
   limit 1;

  if v_def is null then
    raise exception 'post_wage_movement_not_found';
  end if;

  v_patched := replace(
    v_def,
    $old$on conflict (
      workspace_id,
      kind,
      (pg_catalog.lower(pg_catalog.btrim(name)))
    )
    do nothing$old$,
    $new$on conflict (
      workspace_id,
      kind,
      (pg_catalog.lower(pg_catalog.btrim(name)))
    ) where (is_active)
    do nothing$new$
  );

  if v_patched = v_def then
    raise exception 'post_wage_movement_conflict_clause_not_found';
  end if;

  execute v_patched;
end;
$patch$;
