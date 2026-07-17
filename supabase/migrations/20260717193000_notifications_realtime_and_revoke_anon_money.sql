-- Enable realtime delivery for inbox inserts (device notification bridge).
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- Harden money RPC: authenticated-only (drop accidental anon execute).
do $$
declare
  v_oid oid;
begin
  for v_oid in
    select p.oid
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'post_transaction'
  loop
    execute format('revoke execute on function %s from anon, public', v_oid::regprocedure);
    execute format('grant execute on function %s to authenticated', v_oid::regprocedure);
  end loop;
end;
$$;
