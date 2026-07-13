# Supervisor Intelligence and Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إضافة تحليلات تشغيلية حقيقية ورسائل وسجل تدقيق ووصول مالي للقراءة فقط إلى مركز المدير.

**Architecture:** تجمع RPCs مقيّدة بالمدير مؤشرات الفوترة حسب العملة وتعيد صفحات مالية محدودة، وتكتب audit عند كل وصول حساس. تعرض React الصفحات كطوابير قرارات ومعدلات قابلة للتفسير، لا كأرقام مزخرفة.

**Tech Stack:** PostgreSQL/PLpgSQL، Supabase RPC، React Query، Recharts، Radix Tabs/Dialog، Vitest، Playwright.

---

## خريطة الملفات

- Create: `supabase/migrations/<generated>_supervisor_intelligence_governance.sql`
- Create: `supabase/tests/003_supervisor_intelligence_governance.test.sql`
- Create: `src/features/supervisor/supervisor-intelligence-api.ts`
- Create: `src/features/supervisor/supervisor-financial-read-api.ts`
- Create: `src/features/supervisor/SupervisorOperationsPage.tsx`
- Create: `src/features/supervisor/SupervisorRevenuePage.tsx`
- Create: `src/features/supervisor/SupervisorMessagesPage.tsx`
- Create: `src/features/supervisor/SupervisorAuditPage.tsx`
- Create: `src/features/supervisor/CustomerFinancialReadPanel.tsx`
- Create: `src/features/supervisor/CustomerMessagesPanel.tsx`
- Create: `src/features/supervisor/CustomerControlLedger.tsx`
- Modify: `src/features/supervisor/CustomerDetailsPanel.tsx`
- Modify: `src/features/supervisor/SupervisorNav.tsx`
- Modify: `src/features/supervisor/SupervisorShell.tsx`
- Modify: `src/app/App.tsx`
- Modify: `e2e/supervisor.spec.ts`

### Task 1: تثبيت تعريف المؤشرات

**Files:**
- Create: `supabase/tests/003_supervisor_intelligence_governance.test.sql`

- [ ] **Step 1: اكتب fixtures متعددة العملات**

أنشئ داخل transaction:

```text
3 طلبات LYD: 2 approved، 1 rejected
2 طلبات USD: 1 approved، 1 pending
عميل trialing تحول إلى active
عميل active ينتهي خلال 7 أيام
عميل grace
خطة بلا مشتركين
```

- [ ] **Step 2: ثبّت الصيغ باختبارات pgTAP**

```text
approval_rate = approved / (approved + rejected) * 100
pending لا يدخل مقام approval_rate
trial_conversion_rate = converted_trials / decided_trials * 100
review_time = reviewed_at - created_at للطلبات المحسومة فقط
revenue = approved amount_minor grouped by currency_code
risk_count = grace + period ending within requested horizon
```

عند مقام صفر تعاد النسبة `null` مع `sample_size = 0`، ولا تعاد نسبة مضللة تساوي صفرًا.

- [ ] **Step 3: شغّل الاختبار وأثبت الفشل**

Run:

```powershell
npm run supabase:test
```

Expected: FAIL لأن RPCs غير موجودة.

### Task 2: إضافة RPCs التحليلات وطابور القرارات

**Files:**
- Create: `supabase/migrations/<generated>_supervisor_intelligence_governance.sql`
- Test: `supabase/tests/003_supervisor_intelligence_governance.test.sql`

- [ ] **Step 1: أنشئ migration**

Run:

```powershell
npx supabase migration new supervisor_intelligence_governance
```

- [ ] **Step 2: أضف ملخص العمليات**

```sql
supervisor_operational_metrics(
  p_from timestamptz,
  p_to timestamptz
) returns jsonb
```

الشكل:

```json
{
  "customers": {
    "total": 0,
    "active": 0,
    "trialing": 0,
    "grace": 0,
    "frozen": 0,
    "expiring_7d": 0
  },
  "payments": {
    "pending": 0,
    "approved": 0,
    "rejected": 0,
    "approval_rate": null,
    "approval_sample_size": 0,
    "average_review_minutes": null
  },
  "trials": {
    "conversion_rate": null,
    "sample_size": 0
  }
}
```

- [ ] **Step 3: أضف سلاسل الإيراد**

```sql
supervisor_revenue_series(
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text default 'month'
) returns table (
  bucket_start date,
  currency_code text,
  approved_amount_minor bigint,
  approved_count bigint
)
```

اسمح فقط بـ `day|week|month`. استخدم `reviewed_at` للدفعة المحصلة.

- [ ] **Step 4: أضف توزيع الخطط وطابور التنبيهات**

```sql
supervisor_plan_mix() returns table (
  plan_id uuid,
  plan_name text,
  active_subscriptions bigint,
  trialing_subscriptions bigint,
  frozen_subscriptions bigint
)

supervisor_action_queue(
  p_limit integer default 50
) returns table (
  item_id text,
  item_type text,
  severity text,
  workspace_id uuid,
  customer_name text,
  title text,
  description text,
  due_at timestamptz,
  action_href text
)
```

رتّب: grace، expired pending payment، ينتهي خلال 3 أيام، pending payment، suspended account.

- [ ] **Step 5: امنح أقل صلاحية وشغّل الاختبارات**

لكل دالة:

```sql
revoke all on function ... from public, anon;
grant execute on function ... to authenticated;
```

والتحقق الداخلي من supervisor إلزامي.

Run:

```powershell
npm run supabase:reset
npm run supabase:test
```

Expected: analytics tests PASS.

### Task 3: إضافة حملات الإشعارات داخل التطبيق

**Files:**
- Modify: intelligence migration
- Test: `supabase/tests/003_supervisor_intelligence_governance.test.sql`

- [ ] **Step 1: أضف سجل الحملات الخاص**

```sql
create table private.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id),
  segment text not null,
  title text not null,
  body text not null,
  recipient_count integer not null,
  created_at timestamptz not null default clock_timestamp()
);

revoke all on private.notification_campaigns
  from public, anon, authenticated;
```

- [ ] **Step 2: أضف RPC الإرسال المجمع**

```sql
supervisor_send_notification_campaign(
  p_segment text,
  p_title text,
  p_body text,
  p_note text,
  p_client_id uuid
) returns jsonb
```

الشرائح:

```text
all_active
trialing
expiring_7d
grace
frozen
```

حد أقصى 10,000 مستلم في الطلب، وidempotency تمنع التكرار.

- [ ] **Step 3: أضف RPC سجل الحملات**

```sql
supervisor_list_notification_campaigns(
  p_limit integer,
  p_offset integer
) returns table (
  id uuid,
  segment text,
  title text,
  body text,
  recipient_count integer,
  read_count integer,
  actor_name text,
  created_at timestamptz
)
```

تضيف دالة الإرسال `campaign_id` إلى `notifications.metadata`، وتحسب `read_count` من `notifications.read_at`.

- [ ] **Step 4: أضف سجل رسائل العميل**

```sql
supervisor_list_customer_notifications(
  p_user_id uuid,
  p_limit integer,
  p_offset integer
) returns jsonb
```

تعيد الرسائل المرسلة لهذا العميل وحالة القراءة دون رسائل مستخدمين آخرين.

- [ ] **Step 5: اختبر الشرائح والتكرار والقراءة**

Run:

```powershell
npm run supabase:test
```

Expected: العدد صحيح، المستخدم غير المطابق لا يتلقى رسالة، وretry لا يكرر notifications، وread count صحيح.

### Task 4: إضافة القراءة المالية المدققة

**Files:**
- Modify: intelligence migration
- Test: `supabase/tests/003_supervisor_intelligence_governance.test.sql`

- [ ] **Step 1: أضف helper للتحقق والتدقيق**

```sql
private.assert_supervisor_financial_read(
  p_workspace_id uuid,
  p_resource text
) returns uuid
```

تتحقق من supervisor والمساحة، ثم تكتب:

```text
action = supervisor.financial_accessed
metadata = { "resource": p_resource }
```

- [ ] **Step 2: أضف snapshot حسب العملة**

```sql
supervisor_customer_financial_snapshot(
  p_workspace_id uuid
) returns jsonb
```

استخدم فقط migrations المطبقة حاليًا:

- `wallet_balances`
- `project_totals`
- `project_worker_balances`

لا تعتمد على capital/inventory migration غير المطبقة.

- [ ] **Step 3: أضف صفحات القراءة**

```sql
supervisor_customer_wallets(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
) returns jsonb

supervisor_customer_transactions(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
) returns jsonb

supervisor_customer_projects(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
) returns jsonb

supervisor_customer_workers(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
) returns jsonb
```

لكل دالة `limit between 1 and 100`، وترتيب ثابت، و`total` منفصل.

- [ ] **Step 4: اختبر عدم وجود مسار كتابة**

اختبر أن:

- regular user يُرفض.
- supervisor يقرأ workspace صحيحًا.
- كل استدعاء يضيف audit event.
- لا توجد RPC مالية supervisor تقبل amount أو mutation.
- العملات تعاد مجموعات منفصلة.

- [ ] **Step 5: شغّل الاختبارات**

Run:

```powershell
npm run supabase:test
npm run supabase:lint
```

Expected: PASS.

### Task 5: إضافة قراءة سجل التدقيق

**Files:**
- Modify: intelligence migration
- Test: `supabase/tests/003_supervisor_intelligence_governance.test.sql`

- [ ] **Step 1: أضف RPC السجل**

```sql
supervisor_list_audit_events(
  p_query text,
  p_action_prefix text,
  p_workspace_id uuid,
  p_actor_user_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer,
  p_offset integer
) returns jsonb
```

النتيجة تحتوي `rows` و`total`، مع أسماء العميل والمنفذ، ولا تعرض metadata secrets.

- [ ] **Step 2: أضف control ledger**

```sql
supervisor_customer_control_ledger(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer
) returns jsonb
```

ادمج زمنيًا:

- audit events
- subscription events
- payment reviews
- notification campaigns/individual messages

- [ ] **Step 3: اختبر pagination والترتيب**

Run:

```powershell
npm run supabase:test
```

Expected: الأحدث أولًا، لا تكرار، وtotal صحيح.

### Task 6: بناء طبقة API والأنواع

**Files:**
- Create: `src/features/supervisor/supervisor-intelligence-api.ts`
- Create: `src/features/supervisor/supervisor-financial-read-api.ts`
- Test: matching `*.test.ts`

- [ ] **Step 1: عرّف الأنواع**

```ts
export interface RateMetric {
  value: number | null;
  sampleSize: number;
}

export interface CurrencyRevenuePoint {
  bucketStart: string;
  currencyCode: string;
  approvedAmountMinor: number;
  approvedCount: number;
}

export interface ActionQueueItem {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  workspaceId: string;
  customerName: string;
  title: string;
  description: string;
  dueAt: string | null;
  href: string;
}
```

- [ ] **Step 2: نفذ APIs وتحويل snake_case**

أضف query keys منفصلة:

```ts
operations
revenue
planMix
actionQueue
campaigns
audit
customerLedger(workspaceId)
customerFinance(workspaceId, resource, page)
```

- [ ] **Step 3: اختبر null rates والعملات**

Run:

```powershell
npx vitest run src/features/supervisor/supervisor-intelligence-api.test.ts src/features/supervisor/supervisor-financial-read-api.test.ts
```

Expected: PASS.

### Task 7: إعادة بناء الصفحة الرئيسية كمركز عمليات

**Files:**
- Create: `src/features/supervisor/SupervisorOperationsPage.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/features/supervisor/SupervisorOperationsPage.test.tsx`

- [ ] **Step 1: اكتب اختبارات truthfulness**

اختبر:

- نسبة null تعرض «بيانات غير كافية».
- sample size يظهر بجانب النسبة.
- الإيراد لا يجمع LYD مع USD.
- طابور القرارات يرتبط بالصفحة الصحيحة.

- [ ] **Step 2: نفذ ترتيب الصفحة**

```text
طابور القرارات
مؤشرات العملاء والمدفوعات
الإيراد حسب العملة
تحويل التجارب ومعدل الموافقة
توزيع الخطط
آخر القرارات
```

استخدم card surfaces مختلفة حسب نوع البيانات، لا شبكة metric cards متطابقة.

- [ ] **Step 3: اجعل route الجذر يستخدم الصفحة**

```tsx
path="supervisor" -> SupervisorOperationsPage
```

- [ ] **Step 4: شغّل الاختبار**

Run:

```powershell
npx vitest run src/features/supervisor/SupervisorOperationsPage.test.tsx
```

Expected: PASS.

### Task 8: بناء الإيرادات والرسائل

**Files:**
- Create: `src/features/supervisor/SupervisorRevenuePage.tsx`
- Create: `src/features/supervisor/SupervisorMessagesPage.tsx`
- Create: `src/features/supervisor/CustomerMessagesPanel.tsx`
- Test: matching test files

- [ ] **Step 1: نفذ صفحة الإيرادات**

الفلاتر: 30 يوم، 90 يوم، 12 شهر، custom. اعرض line/bar منفصلًا لكل عملة، وجدول مبالغ أسفله. سمِّ المؤشر «مدفوعات معتمدة» لا «إيراد مصرفي محصل» لأن المصدر هو قرار المراجعة اليدوي.

- [ ] **Step 2: نفذ محرر الرسالة**

Zod:

```ts
z.object({
  segment: z.enum([
    "all_active",
    "trialing",
    "expiring_7d",
    "grace",
    "frozen",
  ]),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(2000),
  note: z.string().trim().min(3).max(500),
});
```

اعرض عدد المستلمين قبل التأكيد، وسجل الحملات بعد الإرسال.

- [ ] **Step 3: أضف رسالة فردية داخل تفاصيل العميل**

استخدم `supervisor_send_notification` و`supervisor_list_customer_notifications`، ولا تعرض حملات غير مرتبطة بهذا العميل في التبويب.

- [ ] **Step 4: شغّل الاختبارات**

Run:

```powershell
npx vitest run src/features/supervisor/SupervisorRevenuePage.test.tsx src/features/supervisor/SupervisorMessagesPage.test.tsx
```

Expected: PASS.

### Task 9: بناء القراءة المالية وسجل تحكم العميل

**Files:**
- Create: `src/features/supervisor/CustomerFinancialReadPanel.tsx`
- Create: `src/features/supervisor/CustomerControlLedger.tsx`
- Modify: `src/features/supervisor/CustomerDetailsPanel.tsx`
- Test: matching test files

- [ ] **Step 1: أضف تبويبين lazy**

```text
البيانات المالية — قراءة فقط
سجل القرارات
```

لا تنفذ query قبل اختيار التبويب.

- [ ] **Step 2: نفذ panel المالي**

أضف شارة ثابتة:

```tsx
<StatusBadge label="قراءة فقط · كل فتح مسجل" tone="bg-warning-soft text-warning" />
```

أقسام: ملخص العملات، المحافظ، المعاملات، المشاريع، العمال. كل قسم pagination مستقل.

- [ ] **Step 3: نفذ Control Ledger**

استخدم timeline واحدًا مع icon دلالي ونص عربي للحساب، الاشتراك، الدفع، الرسالة، والوصول المالي.

- [ ] **Step 4: اختبر عدم وجود أفعال كتابة**

اختبر غياب `تعديل|حذف|عكس|إضافة معاملة` من panel المالي.

- [ ] **Step 5: شغّل الاختبارات**

Run:

```powershell
npx vitest run src/features/supervisor/CustomerFinancialReadPanel.test.tsx src/features/supervisor/CustomerControlLedger.test.tsx
```

Expected: PASS.

### Task 10: بناء سجل التدقيق والتنقل

**Files:**
- Create: `src/features/supervisor/SupervisorAuditPage.tsx`
- Modify: `src/features/supervisor/SupervisorNav.tsx`
- Modify: `src/features/supervisor/SupervisorShell.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: نفذ صفحة التدقيق**

الفلاتر:

```text
النطاق الزمني | نوع الإجراء | العميل | المنفذ | البحث
```

اعرض before/after من metadata في disclosure مغلق افتراضيًا.

- [ ] **Step 2: أضف المسارات**

```text
/supervisor/revenue
/supervisor/messages
/supervisor/audit
```

حوّل activity القديم إلى audit أو redirect.

- [ ] **Step 3: نظم التنقل النهائي**

```text
التشغيل: مركز العمليات
العملاء: العملاء، الاشتراكات
الفوترة: المدفوعات، الخطط، الإيرادات
التواصل: الرسائل
الحوكمة: سجل التدقيق
```

- [ ] **Step 4: شغّل TypeScript وLint**

Run:

```powershell
npm run typecheck
npm run lint
```

Expected: PASS.

### Task 11: E2E والأمان والأداء

**Files:**
- Modify: `e2e/supervisor.spec.ts`

- [ ] **Step 1: أضف E2E**

```text
metrics use real seeded payment data
revenue separates currencies
manager sends segment notification
manager opens read-only customer finance
financial access appears in audit
regular user cannot invoke financial RPC
mobile customer details remain usable
```

- [ ] **Step 2: شغّل التحقق الكامل**

Run:

```powershell
npm run supabase:lint
npm run supabase:test
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Expected: جميع الأوامر PASS.

- [ ] **Step 3: افحص Advisors**

شغّل security وperformance advisors. افحص خصوصًا:

- SECURITY DEFINER search_path.
- EXECUTE grants.
- RLS على أي public table جديد.
- indexes على payment status/reviewed_at، subscription dates، وaudit created_at.
- بطء `supervisor_action_queue` وfinancial pagination.

- [ ] **Step 4: تحقق من عدم الاعتماد على migration المشاريع الذكية**

يجب أن ينجح reset والاختبار حتى مع بقاء `20260713170000_smart_project_blueprint_foundation.sql` خارج قاعدة الإنتاج؛ لا تستدعِ جداول capital/inventory في هذه الحزمة.
