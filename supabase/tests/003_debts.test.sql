begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select no_plan();

select has_table('public', 'debt_parties', 'debt parties table exists');
select has_table('public', 'debts', 'debts table exists');
select has_table('public', 'debt_entries', 'debt entries table exists');

select has_view('public', 'debt_balances', 'debt balances view exists');
select has_view('public', 'debt_summaries', 'debt summaries view exists');
select has_view(
  'public',
  'debt_entry_details',
  'exact-money debt entry detail view exists'
);

select col_type_is(
  'public',
  'debts',
  'principal_minor',
  'bigint',
  'debt principals use bigint minor units'
);
select col_type_is(
  'public',
  'debt_entries',
  'amount_minor',
  'bigint',
  'debt entries use bigint minor units'
);
select results_eq(
  $$select table_name || '.' || column_name || ':' || data_type
      from information_schema.columns
     where table_schema = 'public'
       and (table_name, column_name) in (
         ('debt_balances', 'principal_minor'),
         ('debt_balances', 'balance_minor'),
         ('debt_balances', 'paid_minor'),
         ('debt_balances', 'adjusted_minor'),
         ('debt_balances', 'written_off_minor'),
         ('debt_summaries', 'receivable_minor'),
         ('debt_summaries', 'payable_minor'),
         ('debt_summaries', 'net_minor'),
         ('debt_entry_details', 'amount_minor')
       )
     order by table_name, column_name$$,
  array[
    'debt_balances.adjusted_minor:text',
    'debt_balances.balance_minor:text',
    'debt_balances.paid_minor:text',
    'debt_balances.principal_minor:text',
    'debt_balances.written_off_minor:text',
    'debt_entry_details.amount_minor:text',
    'debt_summaries.net_minor:text',
    'debt_summaries.payable_minor:text',
    'debt_summaries.receivable_minor:text'
  ]::text[],
  'debt API views expose exact monetary values as text'
);

select ok(
  c.relrowsecurity,
  format('RLS enabled on public.%I', expected.table_name)
)
from (
  values
    ('debt_parties'),
    ('debts'),
    ('debt_entries')
) as expected(table_name)
join pg_catalog.pg_class as c
  on c.relname = expected.table_name
join pg_catalog.pg_namespace as n
  on n.oid = c.relnamespace
 and n.nspname = 'public';

select ok(
  'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])),
  format('public.%I invokes caller RLS', expected.view_name)
)
from (
  values
    ('debt_balances'),
    ('debt_summaries'),
    ('debt_entry_details')
) as expected(view_name)
join pg_catalog.pg_class as c
  on c.relname = expected.view_name
join pg_catalog.pg_namespace as n
  on n.oid = c.relnamespace
 and n.nspname = 'public';

select ok(
  exists (
    select 1
      from pg_catalog.pg_trigger as trigger
     where trigger.tgrelid = 'public.debt_entries'::regclass
       and trigger.tgname = 'debt_entries_immutable'
       and not trigger.tgisinternal
  ),
  'debt entries are append-only'
);

select has_function(
  'public',
  'create_debt',
  array[
    'uuid',
    'uuid',
    'public.debt_direction',
    'bigint',
    'text',
    'text',
    'text',
    'text',
    'date',
    'uuid',
    'text'
  ],
  'create debt RPC exists'
);
select has_function(
  'public',
  'post_debt_entry',
  array[
    'uuid',
    'uuid',
    'public.debt_entry_type',
    'bigint',
    'date',
    'uuid',
    'text',
    'uuid'
  ],
  'post debt entry RPC exists'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_debt(uuid,uuid,public.debt_direction,bigint,text,text,text,text,date,uuid,text)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_debt(uuid,uuid,public.debt_direction,bigint,text,text,text,text,date,uuid,text)',
    'EXECUTE'
  ),
  'only authenticated clients can create debts'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.post_debt_entry(uuid,uuid,public.debt_entry_type,bigint,date,uuid,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.post_debt_entry(uuid,uuid,public.debt_entry_type,bigint,date,uuid,text,uuid)',
    'EXECUTE'
  ),
  'only authenticated clients can post debt entries'
);

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.debt_entries',
    'INSERT'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.debt_entries',
    'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.debt_entries',
    'DELETE'
  ),
  'authenticated clients cannot directly mutate debt entries'
);

select * from finish();
rollback;
