# Supervisor Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** بناء طبقة آمنة لإنشاء العملاء وإدارة الخطط والاشتراكات دون كشف مفاتيح Supabase الإدارية للمتصفح.

**Architecture:** تنشئ Edge Function نية إعداد قصيرة العمر بهوية المدير، ثم تستخدم Auth Admin API للدعوة أو الإنشاء. يستهلك `private.handle_new_user` النية داخل معاملة إنشاء المستخدم، بينما تنفذ كل تغييرات الخطط والاشتراكات عبر RPCs مدققة وidempotent.

**Tech Stack:** Supabase Auth Admin API، Edge Functions (Deno)، PostgreSQL/PLpgSQL، pgTAP، TypeScript.

---

## خريطة الملفات

- Create: `supabase/migrations/<generated>_supervisor_control_plane.sql`
- Create: `supabase/tests/002_supervisor_control_plane.test.sql`
- Create: `supabase/functions/supervisor-customer-admin/index.ts`
- Create: `supabase/functions/supervisor-customer-admin/index.test.ts`
- Modify: `supabase/config.toml`
- Regenerate: `src/types/database.ts`
- Modify: `src/lib/user-error.ts`
- Modify: `src/lib/user-error.test.ts`

> لا توجد مستودع Git مهيأ في مساحة العمل الحالية؛ لذلك نقاط التحقق أدناه لا تنشئ commits.

### Task 1: تثبيت عقد الاختبارات الأمنية

**Files:**
- Create: `supabase/tests/002_supervisor_control_plane.test.sql`

- [ ] **Step 1: اكتب اختبارات pgTAP الفاشلة**

يجب أن يغطي الملف على الأقل:

```sql
begin;
select plan(28);

select has_table('private', 'customer_onboarding_intents');
select has_column('public', 'profiles', 'must_change_password');
select has_function('public', 'supervisor_prepare_customer_onboarding');
select has_function('public', 'supervisor_create_plan');
select has_function('public', 'supervisor_renew_subscription');
select has_function('public', 'supervisor_set_subscription_state');
select has_function('public', 'supervisor_send_notification');

select function_privs_are(
  'public',
  'supervisor_create_plan',
  array['text','text','bigint','text','billing_interval','smallint','smallint','boolean','jsonb','text','uuid'],
  'authenticated',
  array['EXECUTE']
);

-- SET LOCAL ROLE authenticated + request.jwt.claim.sub:
-- regular user => throws 42501
-- active supervisor => succeeds
-- suspended supervisor => throws 42501
-- duplicate p_client_id with identical payload => same result
-- duplicate p_client_id with different payload => idempotency_conflict
-- invalid transition => invalid_subscription_transition
-- renewal extends from max(now, current_period_ends_at)
-- archived plan cannot be selected for a new renewal
-- onboarding intent expires and cannot be consumed
-- notification writes recipient, actor and metadata
-- supervisor direct UPDATE on workspaces is denied; RPC path succeeds and audits

select * from finish();
rollback;
```

- [ ] **Step 2: شغّل الاختبار وأثبت الفشل**

Run:

```powershell
npm run supabase:start
npm run supabase:reset
npm run supabase:test
```

Expected: FAIL لأن الجدول والدوال الجديدة غير موجودة. إذا كان Docker Desktop متوقفًا، شغّله أولًا ولا تطبق SQL على الإنتاج كبديل للاختبار المحلي.

### Task 2: إنشاء نوايا إعداد العملاء وتوسيع bootstrap

**Files:**
- Create: `supabase/migrations/<generated>_supervisor_control_plane.sql`

- [ ] **Step 1: أنشئ اسم migration عبر CLI**

Run:

```powershell
npx supabase migration new supervisor_control_plane
```

Expected: مسار جديد تحت `supabase/migrations/`.

- [ ] **Step 2: أضف حالة تغيير كلمة المرور وجدول النوايا الخاص**

أضف:

```sql
alter table public.profiles
  add column must_change_password boolean not null default false;

alter table public.workspace_subscriptions
  add column scheduled_status public.subscription_status,
  add column scheduled_status_at timestamptz,
  add constraint workspace_subscriptions_scheduled_state_shape check (
    (scheduled_status is null and scheduled_status_at is null)
    or (
      scheduled_status in ('cancelled', 'expired')
      and scheduled_status_at is not null
    )
  );

create table private.customer_onboarding_intents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  workspace_name text not null,
  currency_code text not null references public.currencies(code),
  plan_id uuid not null references public.subscription_plans(id),
  subscription_status public.subscription_status not null,
  starts_at timestamptz not null,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  must_change_password boolean not null,
  delivery_mode text not null check (
    delivery_mode in ('invite', 'temporary_password', 'password_setup_email')
  ),
  created_by uuid not null references public.profiles(id),
  note text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_user_id uuid references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  unique (email)
);

revoke all on private.customer_onboarding_intents
  from public, anon, authenticated;
```

البريد المخزن يكون دائمًا `lower(btrim(email))`، و`expires_at` لا يتجاوز 15 دقيقة.

- [ ] **Step 3: أضف RPC تجهيز وإلغاء النية**

العقد:

```sql
public.supervisor_prepare_customer_onboarding(
  p_email text,
  p_display_name text,
  p_workspace_name text,
  p_currency_code text,
  p_plan_id uuid,
  p_subscription_status public.subscription_status,
  p_starts_at timestamptz,
  p_trial_ends_at timestamptz,
  p_current_period_ends_at timestamptz,
  p_must_change_password boolean,
  p_delivery_mode text,
  p_note text,
  p_client_id uuid
) returns uuid
```

داخل الدالة:

```sql
if auth.uid() is null or not private.is_supervisor() then
  raise exception 'forbidden' using errcode = '42501';
end if;
```

تحقق من البريد، الخطة النشطة، العملة، اتساق التواريخ والحالة، ثم استخدم idempotency payload يتضمن جميع المدخلات. إذا وجد intent منتهي وغير مستهلك للبريد نفسه فاستبدله داخل المعاملة؛ وإذا كان صالحًا فارفض إنشاء نية متوازية.

أضف:

```sql
public.supervisor_cancel_customer_onboarding(
  p_intent_id uuid,
  p_note text
) returns void
```

ولا تسمح بإلغاء intent مستهلكة.

- [ ] **Step 4: حدّث `private.handle_new_user` لاستهلاك النية**

في بداية trigger:

```sql
select *
into v_intent
from private.customer_onboarding_intents
where email = lower(btrim(new.email))
  and consumed_at is null
  and expires_at > clock_timestamp()
for update;
```

عند وجود intent:

- استخدم الاسم والمساحة والعملة والخطة والحالة والتواريخ منها.
- عيّن `profiles.must_change_password`.
- اجعل `actor_user_id = v_intent.created_by` في حدث الاشتراك والتدقيق.
- عيّن `consumed_at` و`consumed_user_id` بعد نجاح كل bootstrap.

عند عدم وجود intent احتفظ بسلوك signup العام الحالي: LYD + trial لمدة 14 يومًا.

- [ ] **Step 5: امنع المدير من تجاوز سجل التدقيق**

استبدل policy تحديث workspaces الحالية بأخرى تسمح فقط لمالك/مسؤول المساحة:

```sql
drop policy if exists workspaces_update_admin_or_supervisor
  on public.workspaces;

create policy workspaces_update_admin
on public.workspaces
for update
to authenticated
using (
  private.has_workspace_role(
    id,
    array['owner', 'admin']::public.workspace_role[]
  )
  and private.can_write_workspace(id)
)
with check (
  private.has_workspace_role(
    id,
    array['owner', 'admin']::public.workspace_role[]
  )
  and private.can_write_workspace(id)
);
```

تبقى عمليات المدير عبر SECURITY DEFINER RPCs المدققة فقط.

- [ ] **Step 6: شغّل reset واختبارات قاعدة البيانات**

Run:

```powershell
npm run supabase:reset
npm run supabase:test
```

Expected: اختبارات bootstrap والنوايا PASS.

### Task 3: إضافة إدارة الخطط

**Files:**
- Modify: migration created in Task 2
- Test: `supabase/tests/002_supervisor_control_plane.test.sql`

- [ ] **Step 1: أضف اختبارات plan CRUD**

اختبر:

- code يطابق `^[a-z0-9][a-z0-9_-]{1,39}$`.
- السعر غير سالب.
- `none` يفرض `interval_count is null`.
- `monthly/yearly` يفرضان `interval_count between 1 and 36`.
- `trial_days between 0 and 365`.
- `features` كائن JSON.
- الأرشفة تجعل `is_active=false` و`is_public=false`.
- لا يمكن أرشفة آخر خطة trial يحتاجها التسجيل العام.

- [ ] **Step 2: أضف RPCs**

```sql
supervisor_create_plan(
  p_code text,
  p_name text,
  p_price_minor bigint,
  p_currency_code text,
  p_billing_interval public.billing_interval,
  p_interval_count smallint,
  p_trial_days smallint,
  p_is_public boolean,
  p_features jsonb,
  p_note text,
  p_client_id uuid
) returns public.subscription_plans

supervisor_update_plan(
  p_plan_id uuid,
  p_name text,
  p_price_minor bigint,
  p_currency_code text,
  p_billing_interval public.billing_interval,
  p_interval_count smallint,
  p_trial_days smallint,
  p_is_public boolean,
  p_features jsonb,
  p_note text,
  p_client_id uuid
) returns public.subscription_plans

supervisor_archive_plan(
  p_plan_id uuid,
  p_note text,
  p_client_id uuid
) returns public.subscription_plans
```

كل دالة تستدعي `private.write_audit` بقيم before/after ولا تسمح بتعديل `code` بعد الإنشاء.

- [ ] **Step 3: شغّل اختبارات الخطط**

Run:

```powershell
npm run supabase:test
```

Expected: plan tests PASS.

### Task 4: إضافة دورة الاشتراك اليدوية الكاملة

**Files:**
- Modify: migration created in Task 2
- Test: `supabase/tests/002_supervisor_control_plane.test.sql`

- [ ] **Step 1: اكتب transition matrix في الاختبار**

المسموح:

```text
trialing -> active|grace|frozen|expired|cancelled
active   -> grace|frozen|expired|cancelled
grace    -> active|frozen|expired|cancelled
frozen   -> active|grace|expired|cancelled
expired  -> active
cancelled-> active
```

- [ ] **Step 2: أضف RPC تغيير الخطة**

```sql
supervisor_change_subscription_plan(
  p_workspace_id uuid,
  p_plan_id uuid,
  p_note text,
  p_client_id uuid
) returns public.workspace_subscriptions
```

ارفض الخطة المؤرشفة، وسجّل الخطة القديمة والجديدة في metadata.

- [ ] **Step 3: أضف RPC التجديد**

```sql
supervisor_renew_subscription(
  p_workspace_id uuid,
  p_period_count smallint,
  p_note text,
  p_client_id uuid
) returns public.workspace_subscriptions
```

استخدم:

```sql
v_base := greatest(clock_timestamp(), coalesce(v_sub.current_period_ends_at, clock_timestamp()));
```

ثم أضف أشهر/سنوات حسب الخطة، واجعل الحالة `active`، وامسح تواريخ grace/frozen/expired/cancelled وحقول الحالة المجدولة. لا تغيّر `profiles.account_status` تلقائيًا.

- [ ] **Step 4: أضف RPC انتقال الحالة والتواريخ**

```sql
supervisor_set_subscription_state(
  p_workspace_id uuid,
  p_target_status public.subscription_status,
  p_trial_ends_at timestamptz,
  p_current_period_ends_at timestamptz,
  p_grace_ends_at timestamptz,
  p_note text,
  p_client_id uuid
) returns public.workspace_subscriptions
```

تحقق من transition matrix ومن الحقول المطلوبة لكل حالة. حدّث `workspaces.status` بصورة متسقة، واكتب `subscription_events` وaudit.

- [ ] **Step 5: أضف الإلغاء المجدول**

```sql
supervisor_schedule_subscription_state(
  p_workspace_id uuid,
  p_target_status public.subscription_status,
  p_scheduled_at timestamptz,
  p_note text,
  p_client_id uuid
) returns public.workspace_subscriptions
```

اسمح فقط بـ`cancelled|expired`، واجعل الوقت في المستقبل ولا يتجاوز `current_period_ends_at` للحالة النشطة. تستخدم نماذج القراءة `scheduled_status_at <= clock_timestamp()` لحساب الحالة الفعلية، ويوقف entitlement أصلًا عند نهاية الفترة. أي تجديد لاحق يمسح الجدولة.

- [ ] **Step 6: شغّل اختبارات الاشتراكات**

Run:

```powershell
npm run supabase:test
```

Expected: transition، renewal، idempotency، وaudit tests PASS.

### Task 5: إضافة نماذج القراءة اللازمة للواجهة

**Files:**
- Modify: migration created in Task 2
- Test: `supabase/tests/002_supervisor_control_plane.test.sql`

- [ ] **Step 1: أضف اختبارات القراءة المقيّدة**

اختبر أن المستخدم العادي يُرفض، والمدير يحصل فقط على الأعمدة المعلنة، والبحث/filtres/pagination تعيد `total` صحيحًا.

- [ ] **Step 2: أضف قائمة العملاء وتفاصيل العميل**

```sql
supervisor_list_customers(
  p_query text,
  p_account_status public.account_status,
  p_subscription_status public.subscription_status,
  p_plan_id uuid,
  p_limit integer,
  p_offset integer
) returns jsonb

supervisor_get_customer(
  p_user_id uuid
) returns jsonb
```

تعرض الدالتان صراحةً:

```text
user id، email، display name، account status، last sign-in
workspace id/name/currency/status
subscription id/status/dates
scheduled status/date and effective status
plan id/name
pending payment count
```

لا تستخدم `select auth.users.*` ولا تعيد tokens أو metadata الداخلية.

- [ ] **Step 3: أضف قائمة الخطط للمدير**

```sql
supervisor_list_plans(
  p_include_archived boolean default true
) returns jsonb
```

تعيد الخطة مع عدد الاشتراكات حسب الحالة.

- [ ] **Step 4: أضف قائمة المدفوعات المثرية**

```sql
supervisor_list_payments(
  p_status public.payment_request_status,
  p_query text,
  p_plan_id uuid,
  p_currency_code text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer,
  p_offset integer
) returns jsonb
```

تعيد بيانات المساحة والعميل والخطة والفترات والمراجع، مع `rows` و`total`.

- [ ] **Step 5: شغّل اختبارات نماذج القراءة**

Run:

```powershell
npm run supabase:test
```

Expected: regular-user denial، filtering، pagination، وcolumn-redaction tests PASS.

### Task 6: إضافة رسائل داخل التطبيق وتغيير كلمة المرور الإلزامي

**Files:**
- Modify: migration created in Task 2
- Modify: `src/features/auth/auth-context.ts`
- Modify: `src/features/auth/AuthProvider.tsx`
- Modify: `src/features/auth/RequireAuth.tsx`
- Modify: `src/features/auth/UpdatePasswordPage.tsx`
- Test: `src/features/auth/RequireAuth.test.tsx`

- [x] **Step 1: أضف RPC إرسال إشعار**

```sql
supervisor_send_notification(
  p_user_id uuid,
  p_workspace_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_metadata jsonb,
  p_note text,
  p_client_id uuid
) returns public.notifications
```

تحقق أن المستخدم عضو في المساحة عند تمرير الاثنين، وحدد 120 حرفًا للعنوان و2000 للنص.

- [x] **Step 2: أضف RPC إنهاء تغيير كلمة المرور**

```sql
complete_required_password_change() returns void
```

تعمل بهوية المستخدم نفسه فقط:

```sql
update public.profiles
set must_change_password = false, updated_at = clock_timestamp()
where id = auth.uid();
```

- [x] **Step 3: أضف بوابة الواجهة**

أضف `must_change_password` إلى `Profile` وإلى select/mapping في `AuthProvider.tsx`. ثم في `RequireAuth.tsx`، بعد فحص `account_status`:

```tsx
if (
  profile.must_change_password &&
  location.pathname !== "/auth/update-password"
) {
  return <Navigate to="/auth/update-password?required=1" replace />;
}
```

بعد نجاح `updateUser({ password })` تستدعي صفحة التحديث RPC الإكمال قبل العودة للتطبيق.

- [x] **Step 4: اختبر البوابة**

Run:

```powershell
npx vitest run src/features/auth/RequireAuth.test.tsx
```

Expected: الحساب الملزم لا يرى Dashboard قبل تغيير كلمة المرور.

### Task 7: بناء Edge Function الإدارية

**Files:**
- Create: `supabase/functions/supervisor-customer-admin/index.ts`
- Create: `supabase/functions/supervisor-customer-admin/index.test.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1: عرّف عقد الطلب**

```ts
interface CreateCustomerRequest {
  action: "create_customer";
  email: string;
  displayName: string;
  workspaceName: string;
  currencyCode: string;
  planId: string;
  subscriptionStatus: "trialing" | "active";
  startsAt: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  deliveryMode: "invite" | "temporary_password" | "password_setup_email";
  note: string;
  clientId: string;
}

type AdminAction =
  | CreateCustomerRequest
  | {
      action: "send_password_setup";
      email: string;
    };
```

- [ ] **Step 2: اختبر التحقق**

اختبر 401 بلا Authorization، 403 لغير المدير، 400 للمدخلات، و200 للمدير. Mock لـ Admin API يثبت:

```ts
expect(admin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
  "customer@example.com",
  expect.objectContaining({ redirectTo: expect.stringContaining("/auth/update-password") }),
);
```

- [ ] **Step 3: نفذ التحقق الآمن**

استخدم client بهوية JWT لقراءة profile واستدعاء `supervisor_prepare_customer_onboarding` بكل بيانات الطلب، وclient منفصل بـ service role لعملية Auth Admin فقط. لا تسجل body أو password.

أنشئ كلمة المرور المؤقتة داخل Edge Function لا في المتصفح:

```ts
const temporaryPassword = `M!z9-${crypto.randomUUID()}`;
```

للإنشاء المباشر:

```ts
await admin.auth.admin.createUser({
  email,
  password: temporaryPassword,
  email_confirm: true,
  user_metadata: { display_name: displayName },
});
```

للدعوة:

```ts
await admin.auth.admin.inviteUserByEmail(email, {
  data: { display_name: displayName },
  redirectTo: `${appOrigin}/auth/update-password`,
});
```

في `password_setup_email` أنشئ الحساب بكلمة عشوائية لا تعاد للمدير، ثم أرسل `resetPasswordForEmail` إلى مسار تحديث كلمة المرور. عند فشل Admin API استدعِ `supervisor_cancel_customer_onboarding`.

الاستجابة:

```ts
{
  userId: string;
  temporaryPassword: deliveryMode === "temporary_password"
    ? temporaryPassword
    : null;
}
```

- [ ] **Step 4: أضف إعداد function**

في `supabase/config.toml`:

```toml
[functions.supervisor-customer-admin]
verify_jwt = true
```

- [ ] **Step 5: شغّل اختبارات Edge Function**

Run:

```powershell
deno test --allow-env supabase/functions/supervisor-customer-admin/index.test.ts
```

Expected: كل اختبارات auth والتحقق والتعويض PASS.

### Task 8: الأنواع والرسائل والتحقق النهائي

**Files:**
- Regenerate: `src/types/database.ts`
- Modify: `src/lib/user-error.ts`
- Modify: `src/lib/user-error.test.ts`

- [ ] **Step 1: أضف رسائل الأخطاء العربية**

أضف مفاتيح:

```ts
forbidden
onboarding_intent_expired
onboarding_intent_conflict
invalid_subscription_transition
inactive_plan
invalid_plan_interval
idempotency_conflict
must_change_password
```

- [ ] **Step 2: أعد توليد الأنواع**

Run:

```powershell
npm run supabase:types
```

Expected: `profiles.must_change_password` وRPCs الجديدة موجودة في `database.ts`.

- [ ] **Step 3: شغّل مجموعة التحقق**

Run:

```powershell
npm run supabase:lint
npm run supabase:test
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

Expected: جميع الأوامر PASS.

- [ ] **Step 4: افحص Advisors قبل أي نشر**

استخدم Supabase `get_advisors` للأمان والأداء. لا تطبق migration على الإنتاج قبل زوال أخطاء RLS/privileges ونجاح الاختبارات على بيئة محلية أو branch.
