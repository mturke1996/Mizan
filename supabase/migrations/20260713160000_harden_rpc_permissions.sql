-- Close PostgreSQL's default PUBLIC execute privilege on privileged RPCs,
-- then grant only the authenticated application role.

revoke all on function public.create_project(
  uuid,
  text,
  text,
  bigint,
  text,
  public.project_status,
  uuid
) from public, anon, authenticated;
revoke all on function public.update_project(
  uuid,
  uuid,
  text,
  text,
  bigint,
  text,
  public.project_status
) from public, anon, authenticated;
revoke all on function public.create_project_worker(
  uuid,
  uuid,
  text,
  bigint,
  text
) from public, anon, authenticated;
revoke all on function public.record_daily_work(
  uuid,
  uuid,
  uuid,
  date,
  bigint,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.post_wage_movement(
  uuid,
  uuid,
  uuid,
  public.work_log_entry_type,
  bigint,
  date,
  uuid,
  text,
  uuid
) from public, anon, authenticated;
revoke all on function public.supervisor_freeze_workspace(uuid, text)
  from public, anon, authenticated;
revoke all on function public.supervisor_unfreeze_workspace(uuid, text)
  from public, anon, authenticated;
revoke all on function public.supervisor_extend_trial(uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.supervisor_set_account_status(
  uuid,
  public.account_status,
  text
) from public, anon, authenticated;

grant execute on function public.create_project(
  uuid,
  text,
  text,
  bigint,
  text,
  public.project_status,
  uuid
) to authenticated;
grant execute on function public.update_project(
  uuid,
  uuid,
  text,
  text,
  bigint,
  text,
  public.project_status
) to authenticated;
grant execute on function public.create_project_worker(
  uuid,
  uuid,
  text,
  bigint,
  text
) to authenticated;
grant execute on function public.record_daily_work(
  uuid,
  uuid,
  uuid,
  date,
  bigint,
  text,
  uuid
) to authenticated;
grant execute on function public.post_wage_movement(
  uuid,
  uuid,
  uuid,
  public.work_log_entry_type,
  bigint,
  date,
  uuid,
  text,
  uuid
) to authenticated;
grant execute on function public.supervisor_freeze_workspace(uuid, text)
  to authenticated;
grant execute on function public.supervisor_unfreeze_workspace(uuid, text)
  to authenticated;
grant execute on function public.supervisor_extend_trial(uuid, integer, text)
  to authenticated;
grant execute on function public.supervisor_set_account_status(
  uuid,
  public.account_status,
  text
) to authenticated;

-- Cache auth.uid() once per statement in high-frequency RLS policies.
drop policy if exists profiles_select_self_or_supervisor on public.profiles;
create policy profiles_select_self_or_supervisor
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or private.is_supervisor());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()) and account_status = 'active')
with check (id = (select auth.uid()) and account_status = 'active');

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists projects_insert_writer on public.projects;
create policy projects_insert_writer
on public.projects
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_write_workspace(workspace_id)
);

drop policy if exists categories_insert_writer on public.categories;
create policy categories_insert_writer
on public.categories
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and not is_system
  and private.can_write_workspace(workspace_id)
);

drop policy if exists project_workers_insert_writer on public.project_workers;
create policy project_workers_insert_writer
on public.project_workers
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_write_workspace(workspace_id)
);

-- Target only relationship indexes used by the new daily-work and notification flows.
create index if not exists notifications_workspace_idx
  on public.notifications (workspace_id)
  where workspace_id is not null;
create index if not exists project_workers_workspace_creator_idx
  on public.project_workers (workspace_id, created_by);
create index if not exists project_work_logs_workspace_creator_idx
  on public.project_work_logs (workspace_id, created_by);
create index if not exists project_work_logs_workspace_event_idx
  on public.project_work_logs (workspace_id, financial_event_id)
  where financial_event_id is not null;
