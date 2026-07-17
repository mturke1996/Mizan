-- Allow users to delete their own inbox notifications.
-- Inserts remain server/supervisor-only; users may only select, mark read, or delete own rows.

grant delete on public.notifications to authenticated;

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
on public.notifications
for delete
to authenticated
using (user_id = (select auth.uid()));
