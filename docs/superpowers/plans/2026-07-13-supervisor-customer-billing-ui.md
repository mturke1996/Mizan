# Supervisor Customer and Billing UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** توفير واجهة مدير احترافية لإنشاء العملاء وإدارة الحسابات والاشتراكات والخطط والمدفوعات من داخل ميزان.

**Architecture:** تقسم الواجهة حسب المسؤولية إلى API للعملاء وAPI للفوترة، مع React Query ومكونات حوار/لوحة تفاصيل مشتركة. كل mutation ترسل `clientId` وملاحظة، ثم تبطل المفاتيح المرتبطة فقط.

**Tech Stack:** React 19، TypeScript، React Query، React Hook Form، Zod، Radix Dialog/Tabs، Tailwind CSS، Vitest، Testing Library، Playwright.

---

## خريطة الملفات

- Create: `src/features/supervisor/customer-admin-types.ts`
- Create: `src/features/supervisor/customer-admin-api.ts`
- Create: `src/features/supervisor/billing-admin-api.ts`
- Create: `src/features/supervisor/SupervisorActionDialog.tsx`
- Create: `src/features/supervisor/SupervisorDataTable.tsx`
- Create: `src/features/supervisor/CreateCustomerDialog.tsx`
- Create: `src/features/supervisor/CustomerDetailsPanel.tsx`
- Create: `src/features/supervisor/SupervisorCustomersPage.tsx`
- Create: `src/features/supervisor/SupervisorSubscriptionsPage.tsx`
- Create: `src/features/supervisor/SupervisorPlansPage.tsx`
- Modify: `src/features/supervisor/SupervisorPaymentsPage.tsx`
- Modify: `src/features/supervisor/SupervisorNav.tsx`
- Modify: `src/features/supervisor/SupervisorShell.tsx`
- Modify: `src/features/supervisor/supervisor-api.ts`
- Modify: `src/app/App.tsx`
- Test: matching `*.test.ts(x)` files
- Modify: `e2e/supervisor.spec.ts`

### Task 1: تثبيت العقود والأنواع

**Files:**
- Create: `src/features/supervisor/customer-admin-types.ts`
- Create: `src/features/supervisor/customer-admin-api.ts`
- Create: `src/features/supervisor/billing-admin-api.ts`
- Test: `src/features/supervisor/customer-admin-api.test.ts`

- [ ] **Step 1: عرّف أنواع الصفوف والمدخلات**

```ts
export type CustomerDeliveryMode =
  | "invite"
  | "temporary_password"
  | "password_setup_email";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "grace"
  | "frozen"
  | "expired"
  | "cancelled";

export interface SupervisorCustomerRow {
  userId: string;
  email: string;
  displayName: string | null;
  accountStatus: "active" | "suspended" | "disabled";
  lastSignInAt: string | null;
  workspaceId: string;
  workspaceName: string;
  currencyCode: string;
  workspaceStatus: "active" | "suspended" | "archived";
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  planId: string;
  planName: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  scheduledStatus: "cancelled" | "expired" | null;
  scheduledStatusAt: string | null;
  effectiveSubscriptionStatus: SubscriptionStatus;
  pendingPayments: number;
  createdAt: string;
}

export interface CreateCustomerInput {
  email: string;
  displayName: string;
  workspaceName: string;
  currencyCode: string;
  planId: string;
  subscriptionStatus: SubscriptionStatus;
  startsAt: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  deliveryMode: CustomerDeliveryMode;
  note: string;
  clientId: string;
}
```

- [ ] **Step 2: اكتب اختبارات تحويل RPC rows**

اختبر `snake_case -> camelCase`، القيم null، والفشل العربي.

- [ ] **Step 3: نفذ API العملاء**

```ts
export async function fetchCustomers(filters: {
  query?: string;
  accountStatus?: string;
  subscriptionStatus?: string;
  planId?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: SupervisorCustomerRow[]; total: number }>;

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<{ userId: string; temporaryPassword: string | null }>;

export async function fetchCustomerDetail(
  userId: string,
): Promise<SupervisorCustomerRow>;

export async function sendCustomerPasswordSetup(email: string): Promise<void>;
```

`createCustomer` يستدعي:

```ts
supabase.functions.invoke("supervisor-customer-admin", {
  body: { action: "create_customer", ...input },
});
```

- [ ] **Step 4: نفذ API الفوترة**

```ts
export async function fetchAdminPlans(): Promise<AdminPlan[]>;
export async function createPlan(input: CreatePlanInput): Promise<AdminPlan>;
export async function updatePlan(input: UpdatePlanInput): Promise<AdminPlan>;
export async function archivePlan(input: ActionInput): Promise<AdminPlan>;
export async function renewSubscription(input: RenewInput): Promise<void>;
export async function changeSubscriptionPlan(input: ChangePlanInput): Promise<void>;
export async function setSubscriptionState(input: StateInput): Promise<void>;
export async function scheduleSubscriptionState(input: ScheduledStateInput): Promise<void>;
```

- [ ] **Step 5: شغّل اختبارات API**

Run:

```powershell
npx vitest run src/features/supervisor/customer-admin-api.test.ts
```

Expected: PASS.

### Task 2: بناء حوار الإجراءات الموحد

**Files:**
- Create: `src/features/supervisor/SupervisorActionDialog.tsx`
- Test: `src/features/supervisor/SupervisorActionDialog.test.tsx`

- [ ] **Step 1: اكتب اختبار السلوك**

اختبر:

- لا submit بدون ملاحظة من 3 أحرف.
- Escape يغلق قبل الإرسال فقط.
- pending يعطل الإغلاق والزر.
- destructive action تعرض العبارة التحذيرية.

- [ ] **Step 2: نفذ المكوّن**

```tsx
interface SupervisorActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "warning" | "danger";
  isPending: boolean;
  noteRequired?: boolean;
  onOpenChange(open: boolean): void;
  onConfirm(note: string): void;
  children?: React.ReactNode;
}
```

استخدم Radix Dialog، focus trap، `aria-describedby`، وحجم لمس 44px.

- [ ] **Step 3: شغّل الاختبار**

Run:

```powershell
npx vitest run src/features/supervisor/SupervisorActionDialog.test.tsx
```

Expected: PASS.

### Task 3: بناء جدول المدير المتجاوب

**Files:**
- Create: `src/features/supervisor/SupervisorDataTable.tsx`
- Test: `src/features/supervisor/SupervisorDataTable.test.tsx`

- [ ] **Step 1: اكتب اختبارات الجدول**

اختبر رؤوس الأعمدة، الصف المختار، pagination، empty، loading، ونسخة الهاتف.

- [ ] **Step 2: نفذ المكوّن**

```tsx
interface SupervisorDataTableProps<T> {
  rows: T[];
  rowKey(row: T): string;
  columns: Array<{
    id: string;
    header: string;
    cell(row: T): React.ReactNode;
    className?: string;
  }>;
  renderMobileRow(row: T): React.ReactNode;
  selectedId?: string;
  page: number;
  pageCount: number;
  isLoading: boolean;
  emptyTitle: string;
  onRowSelect(row: T): void;
  onPageChange(page: number): void;
}
```

سطح المكتب `<table>` حقيقي، والهاتف قائمة أزرار؛ لا تجعل الجدول يمرر أفقيًا.

- [ ] **Step 3: شغّل الاختبار**

Run:

```powershell
npx vitest run src/features/supervisor/SupervisorDataTable.test.tsx
```

Expected: PASS.

### Task 4: بناء معالج إنشاء العميل

**Files:**
- Create: `src/features/supervisor/CreateCustomerDialog.tsx`
- Test: `src/features/supervisor/CreateCustomerDialog.test.tsx`

- [ ] **Step 1: عرّف Zod schema**

```ts
const createCustomerSchema = z
  .object({
    email: z.email(),
    displayName: z.string().trim().min(2).max(120),
    workspaceName: z.string().trim().min(2).max(120),
    currencyCode: z.string().length(3),
    planId: z.uuid(),
    subscriptionStatus: z.enum(["trialing", "active"]),
    startsAt: z.string().min(1),
    trialEndsAt: z.string().nullable(),
    currentPeriodEndsAt: z.string().nullable(),
    deliveryMode: z.enum([
      "invite",
      "temporary_password",
      "password_setup_email",
    ]),
    note: z.string().trim().min(3).max(500),
  })
  .superRefine((value, context) => {
    if (value.subscriptionStatus === "trialing" && !value.trialEndsAt) {
      context.addIssue({
        code: "custom",
        path: ["trialEndsAt"],
        message: "حدد نهاية الفترة التجريبية",
      });
    }
    if (!value.currentPeriodEndsAt) {
      context.addIssue({
        code: "custom",
        path: ["currentPeriodEndsAt"],
        message: "حدد نهاية الفترة الحالية",
      });
    }
  });
```

- [ ] **Step 2: اكتب اختبار الخطوات**

اختبر التسلسل:

```text
الهوية -> المساحة -> الاشتراك -> طريقة الدخول -> المراجعة
```

واختبر أن `clientId = crypto.randomUUID()` يبقى نفسه خلال retry.

- [ ] **Step 3: نفذ الحوار**

بعد النجاح:

- invitation/setup email: اعرض نجاحًا دون كلمة مرور.
- temporary password: افتح نتيجة منفصلة تعرض السر مرة واحدة مع Copy.
- لا تخزن السر في React Query cache أو localStorage أو toast.
- صفّر state عند إغلاق النتيجة.

- [ ] **Step 4: شغّل الاختبار**

Run:

```powershell
npx vitest run src/features/supervisor/CreateCustomerDialog.test.tsx
```

Expected: PASS.

### Task 5: بناء قائمة العملاء ولوحة التفاصيل

**Files:**
- Create: `src/features/supervisor/SupervisorCustomersPage.tsx`
- Create: `src/features/supervisor/CustomerDetailsPanel.tsx`
- Test: matching test files

- [ ] **Step 1: اكتب اختبارات البحث والفلاتر**

اختبر query debounced، account status، subscription status، plan، URL search params، وpage reset عند تغيير filter.

- [ ] **Step 2: نفذ صفحة العملاء**

الأعمدة:

```text
العميل | الحساب | المساحة | الخطة | الاشتراك | نهاية الفترة | الدفع | آخر دخول
```

زر أساسي واحد: «إضافة عميل».

- [ ] **Step 3: نفذ لوحة التفاصيل**

التبويبات في هذه المرحلة:

```text
الملخص | الحساب والمساحة | الاشتراك | المدفوعات
```

سطح المكتب panel بعرض 480px، والهاتف Dialog fullscreen. أبقِ `userId` في `?customer=` لدعم العودة والمشاركة.

- [ ] **Step 4: اربط إجراءات الحساب الحالية**

استخدم `supervisorSetAccountStatus` من خلال `SupervisorActionDialog`، واجعل الملاحظة إلزامية للإيقاف والتعطيل. أضف «إرسال رابط تعيين كلمة المرور» عبر Edge Function، مع منع كشف ما إذا كان البريد يخص مستخدمًا آخر في رسائل الخطأ العامة. لا تعرض «إعادة إرسال الدعوة» لأن Supabase Auth لا يوفر resend لنوع invite عبر مزود البريد المدمج؛ رابط recovery هو المسار المدعوم للحساب الموجود.

- [ ] **Step 5: شغّل اختبارات الصفحتين**

Run:

```powershell
npx vitest run src/features/supervisor/SupervisorCustomersPage.test.tsx src/features/supervisor/CustomerDetailsPanel.test.tsx
```

Expected: PASS.

### Task 6: بناء مركز الاشتراكات

**Files:**
- Create: `src/features/supervisor/SupervisorSubscriptionsPage.tsx`
- Test: `src/features/supervisor/SupervisorSubscriptionsPage.test.tsx`

- [ ] **Step 1: اكتب اختبارات الإجراءات**

اختبر:

- التجديد 1/3/6/12 فترة.
- تغيير الخطة.
- active/grace/frozen/expired/cancelled.
- الإلغاء الفوري أو المجدول عند نهاية الفترة.
- التواريخ المطلوبة حسب الحالة.
- mutation لا تعمل مرتين أثناء pending.

- [ ] **Step 2: نفذ الصفحة**

الفلاتر:

```text
الكل | تجريبي | نشط | مهلة | مجمد | منتهي | ملغي | ينتهي خلال 7 أيام
```

كل صف يعرض timeline مختصرًا، والزر يفتح حوارًا لا `window.confirm`.

- [ ] **Step 3: نفذ نماذج الإجراءات**

كل submit يرسل:

```ts
{
  workspaceId,
  note,
  clientId: crypto.randomUUID(),
  // action-specific fields
}
```

عند النجاح أبطل customer، subscription، stats، activity، وpayment keys.

- [ ] **Step 4: شغّل الاختبار**

Run:

```powershell
npx vitest run src/features/supervisor/SupervisorSubscriptionsPage.test.tsx
```

Expected: PASS.

### Task 7: بناء إدارة الخطط

**Files:**
- Create: `src/features/supervisor/SupervisorPlansPage.tsx`
- Test: `src/features/supervisor/SupervisorPlansPage.test.tsx`

- [ ] **Step 1: اكتب اختبارات النموذج**

اختبر code عند الإنشاء فقط، العملة، price minor precision، interval، trial days، public، features، archive confirmation.

- [ ] **Step 2: نفذ محرر الخطة**

مفاتيح المزايا المدعومة:

```ts
const PLAN_FEATURES = [
  "manual_payment",
] as const;
```

لا تسمح بإدخال JSON حر من الواجهة. لا تعرض analytics/projects/workers/inventory/capital كخيارات خطة حتى يوجد enforcement فعلي لها؛ إضافة مفتاح غير مطبق ستكون ميزة وهمية.

- [ ] **Step 3: نفذ قائمة الخطط**

اعرض السعر/العملة، دورة الفوترة، عدد المشتركين، العامة/الخاصة، والنشطة/المؤرشفة. الأرشفة لا تحذف الصف.

- [ ] **Step 4: شغّل الاختبار**

Run:

```powershell
npx vitest run src/features/supervisor/SupervisorPlansPage.test.tsx
```

Expected: PASS.

### Task 8: تحويل المدفوعات إلى صندوق وارد وسجل كامل

**Files:**
- Modify: `src/features/supervisor/SupervisorPaymentsPage.tsx`
- Modify: `src/features/supervisor/supervisor-api.ts`
- Test: `src/features/supervisor/SupervisorPaymentsPage.test.tsx`

- [ ] **Step 1: وسع عقد الدفع**

```ts
export interface PaymentRequestRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  requesterName: string | null;
  planId: string;
  planName: string;
  periodCount: number;
  amountMinor: number;
  currencyCode: string;
  status: "pending" | "approved" | "rejected";
  requesterNote: string | null;
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  proofObjectPath: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: أضف تبويبات الحالة والفلاتر**

```text
بانتظار المراجعة | تمت الموافقة | مرفوضة | الكل
```

أضف plan، currency، date range، وsearch.

- [ ] **Step 3: استبدل textarea المتكرر بحوار مراجعة**

الموافقة تتطلب إثباتًا. الرفض يتطلب ملاحظة. اعرض workspace وplan وperiod count قبل القرار.

- [ ] **Step 4: شغّل الاختبار**

Run:

```powershell
npx vitest run src/features/supervisor/SupervisorPaymentsPage.test.tsx
```

Expected: PASS.

### Task 9: إضافة المسارات والتنقل والترويسات

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/features/supervisor/SupervisorNav.tsx`
- Modify: `src/features/supervisor/SupervisorShell.tsx`

- [ ] **Step 1: أضف lazy routes**

```tsx
/supervisor/customers
/supervisor/subscriptions
/supervisor/plans
```

حوّل `/supervisor/users` إلى redirect على `/supervisor/customers` بعد اكتمال الصفحة.

- [ ] **Step 2: نظم التنقل**

المجموعات:

```text
التشغيل: الرئيسية
العملاء: العملاء، الاشتراكات
الفوترة: المدفوعات، الخطط
الحوكمة: السجل
```

اعرض badge للمدفوعات المعلقة من `PlatformStats.pending_payments`.

- [ ] **Step 3: تحقق من active route وRTL**

Run:

```powershell
npm run typecheck
npm run lint
```

Expected: PASS.

### Task 10: E2E والتحقق البصري

**Files:**
- Modify: `e2e/supervisor.spec.ts`

- [ ] **Step 1: أضف سيناريوهات E2E**

```text
manager opens create customer
manager validates required fields
manager creates temporary-password customer
temporary password is visible once
manager renews an existing subscription
manager creates then archives a plan
manager reviews payment history
non-supervisor cannot open routes
```

- [ ] **Step 2: شغّل التحقق الكامل**

Run:

```powershell
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Expected: جميع الأوامر PASS.

- [ ] **Step 3: تحقق من المقاسات**

اختبر يدويًا/Playwright:

```text
390x844
768x1024
1440x1000
```

لا overflow أفقي، الحوارات محصورة داخل viewport، وfocus واضح.
