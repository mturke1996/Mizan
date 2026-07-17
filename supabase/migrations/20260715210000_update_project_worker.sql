-- Update / deactivate project workers (name, phone, daily wage, status).

create or replace function public.update_project_worker(
  p_workspace_id uuid,
  p_project_id uuid,
  p_worker_id uuid,
  p_name text default null,
  p_phone text default null,
  p_daily_wage_minor bigint default null,
  p_status public.worker_status default null,
  p_clear_phone boolean default false
)
returns public.project_workers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_worker public.project_workers%rowtype;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not private.can_write_workspace(p_workspace_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select project.*
    into v_project
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.id = p_project_id
   for share;

  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  if v_project.modules -> 'workers' is distinct from 'true'::jsonb then
    raise exception 'module_disabled' using errcode = 'PT409';
  end if;

  select worker.*
    into v_worker
    from public.project_workers as worker
   where worker.workspace_id = p_workspace_id
     and worker.project_id = p_project_id
     and worker.id = p_worker_id
   for update;

  if not found then
    raise exception 'worker_not_found' using errcode = 'P0002';
  end if;

  if p_name is not null then
    v_name := pg_catalog.btrim(p_name);
    if v_name is null
       or pg_catalog.char_length(v_name) not between 1 and 120
    then
      raise exception 'invalid_worker_name' using errcode = '22023';
    end if;
  end if;

  if p_daily_wage_minor is not null and p_daily_wage_minor < 0 then
    raise exception 'invalid_daily_wage' using errcode = '22023';
  end if;

  update public.project_workers
     set name = coalesce(v_name, name),
         phone = case
           when p_clear_phone then null
           when p_phone is not null then nullif(pg_catalog.btrim(p_phone), '')
           else phone
         end,
         daily_wage_minor = coalesce(p_daily_wage_minor, daily_wage_minor),
         status = coalesce(p_status, status),
         updated_at = clock_timestamp()
   where id = p_worker_id
  returning * into v_worker;

  return v_worker;
end;
$$;

revoke all on function public.update_project_worker(
  uuid, uuid, uuid, text, text, bigint, public.worker_status, boolean
) from public;
grant execute on function public.update_project_worker(
  uuid, uuid, uuid, text, text, bigint, public.worker_status, boolean
) to authenticated;
