-- Local-only reference data used by payment workflow tests and manual QA.
-- Production pricing remains an explicit product/operations decision.

insert into public.subscription_plans (
  id,
  code,
  name,
  price_minor,
  currency_code,
  billing_interval,
  interval_count,
  trial_days,
  is_public,
  is_active,
  features
)
values
  (
    '00000000-0000-0000-0000-000000000101'::uuid,
    'local-test-monthly',
    'Local test monthly plan',
    10000,
    'LYD',
    'monthly',
    1,
    0,
    true,
    true,
    '{"environment":"local"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000102'::uuid,
    'monthly',
    'Monthly',
    50000000,
    'LYD',
    'monthly',
    1,
    0,
    true,
    true,
    '{"manual_payment":true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000103'::uuid,
    'yearly',
    'Yearly',
    500000000,
    'LYD',
    'yearly',
    1,
    0,
    true,
    true,
    '{"manual_payment":true}'::jsonb
  )
on conflict (code) do update
set
  name = excluded.name,
  price_minor = excluded.price_minor,
  currency_code = excluded.currency_code,
  billing_interval = excluded.billing_interval,
  interval_count = excluded.interval_count,
  trial_days = excluded.trial_days,
  is_public = excluded.is_public,
  is_active = excluded.is_active,
  features = excluded.features;
