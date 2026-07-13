import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type {
  AdminPlan,
  CreateCustomerInput,
  CustomerDeliveryMode,
} from "./customer-admin-types";

const STEPS = [
  "الهوية",
  "المساحة",
  "الاشتراك",
  "طريقة الدخول",
  "المراجعة",
] as const;

export const createCustomerSchema = z
  .object({
    email: z.email("أدخل بريدًا إلكترونيًا صالحًا"),
    displayName: z
      .string()
      .trim()
      .min(2, "الاسم قصير جدًا")
      .max(120, "الاسم طويل جدًا"),
    workspaceName: z
      .string()
      .trim()
      .min(2, "اسم المساحة قصير جدًا")
      .max(120, "اسم المساحة طويل جدًا"),
    currencyCode: z.string().length(3, "اختر عملة من 3 أحرف"),
    planId: z.uuid("اختر خطة صالحة"),
    subscriptionStatus: z.enum(["trialing", "active"]),
    startsAt: z.string().min(1, "حدد تاريخ البداية"),
    trialEndsAt: z.string().nullable(),
    currentPeriodEndsAt: z.string().nullable(),
    deliveryMode: z.enum([
      "invite",
      "temporary_password",
      "password_setup_email",
    ]),
    note: z
      .string()
      .trim()
      .min(3, "الملاحظة مطلوبة وبحد أدنى 3 أحرف")
      .max(500, "الملاحظة طويلة جدًا"),
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

export type CreateCustomerFormValues = z.infer<typeof createCustomerSchema>;

const DELIVERY_LABELS: Record<CustomerDeliveryMode, string> = {
  invite: "دعوة بالبريد",
  temporary_password: "كلمة مرور مؤقتة",
  password_setup_email: "رابط تعيين كلمة المرور",
};

const fieldClassName =
  "min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const TRIAL_MS = 14 * 24 * 60 * 60 * 1000;

function buildDefaultValues(planId: string): CreateCustomerFormValues {
  const now = Date.now();
  const trialEnd = new Date(now + TRIAL_MS).toISOString();
  return {
    email: "",
    displayName: "",
    workspaceName: "",
    currencyCode: "LYD",
    planId,
    subscriptionStatus: "trialing",
    startsAt: new Date(now).toISOString(),
    trialEndsAt: trialEnd,
    currentPeriodEndsAt: trialEnd,
    deliveryMode: "invite",
    note: "",
  };
}

export interface CreateCustomerDialogProps {
  open: boolean;
  plans: AdminPlan[];
  isPending?: boolean;
  onOpenChange(open: boolean): void;
  onCreate(
    input: CreateCustomerInput,
  ): Promise<{ userId: string; temporaryPassword: string | null }>;
}

export function CreateCustomerDialog({
  open,
  plans,
  isPending = false,
  onOpenChange,
  onCreate,
}: CreateCustomerDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultPassword, setResultPassword] = useState<string | null>(null);
  const [resultUserId, setResultUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activePlans = plans.filter((plan) => plan.isActive);
  const defaultPlanId = activePlans[0]?.planId ?? "";
  const [initialValues] = useState(() => buildDefaultValues(defaultPlanId));

  const {
    register,
    handleSubmit,
    control,
    trigger,
    getValues,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateCustomerFormValues>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: initialValues,
  });

  const watched = useWatch({ control });

  useEffect(() => {
    if (!open || !defaultPlanId) return;
    if (!getValues("planId")) {
      setValue("planId", defaultPlanId);
    }
  }, [open, defaultPlanId, getValues, setValue]);

  function handleOpenChange(next: boolean) {
    if (!next && (submitting || isPending)) return;
    if (!next) {
      setResultPassword(null);
      setResultUserId(null);
      setCopied(false);
      setSubmitError(null);
      setStep(0);
      setClientId(crypto.randomUUID());
      reset(buildDefaultValues(defaultPlanId));
    }
    onOpenChange(next);
  }

  async function goNext() {
    const fieldsByStep: Array<Array<keyof CreateCustomerFormValues>> = [
      ["email", "displayName"],
      ["workspaceName", "currencyCode"],
      [
        "planId",
        "subscriptionStatus",
        "startsAt",
        "trialEndsAt",
        "currentPeriodEndsAt",
      ],
      ["deliveryMode"],
      ["note"],
    ];
    const valid = await trigger(fieldsByStep[step]);
    if (!valid) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  async function onSubmit(values: CreateCustomerFormValues) {
    const resolvedClientId = clientId || crypto.randomUUID();
    if (!clientId) {
      setClientId(resolvedClientId);
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onCreate({
        ...values,
        clientId: resolvedClientId,
      });
      setResultUserId(result.userId);
      if (result.temporaryPassword) {
        setResultPassword(result.temporaryPassword);
      } else {
        setResultPassword(null);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "تعذر إنشاء العميل",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!resultPassword) return;
    try {
      await navigator.clipboard.writeText(resultPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const busy = submitting || isPending;
  const selectedPlan = activePlans.find((plan) => plan.planId === watched.planId);

  if (resultUserId) {
    return (
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
          <Dialog.Content
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            className="fixed inset-x-4 top-[12%] z-50 mx-auto w-full max-w-lg rounded-lg border border-line bg-surface p-5 shadow-[0_20px_60px_rgb(27_30_60/18%)] sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2"
          >
            <Dialog.Title className="text-lg font-bold text-ink" id={titleId}>
              تم إنشاء العميل
            </Dialog.Title>
            <Dialog.Description
              className="mt-1 text-sm text-muted"
              id={descriptionId}
            >
              أُنشئ الحساب بنجاح.
            </Dialog.Description>

            {resultPassword ? (
              <div className="mt-4 space-y-3 rounded-md border border-warning/30 bg-warning-soft/40 p-4">
                <p className="text-sm font-bold text-ink">
                  كلمة المرور المؤقتة (تُعرض مرة واحدة فقط)
                </p>
                <code
                  className="block break-all rounded-sm bg-surface px-3 py-2 text-sm font-semibold text-ink"
                  data-testid="temporary-password"
                >
                  {resultPassword}
                </code>
                <button
                  className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-sm font-bold text-ink"
                  onClick={() => void copyPassword()}
                  type="button"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "تم النسخ" : "نسخ كلمة المرور"}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                أُرسلت تعليمات الدخول إلى بريد العميل. لا توجد كلمة مرور للعرض.
              </p>
            )}

            <button
              className="pressable mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-primary px-4 text-sm font-bold text-primary-on"
              onClick={() => handleOpenChange(false)}
              type="button"
            >
              إغلاق
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          className="fixed inset-x-4 top-[6%] z-50 mx-auto max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-lg border border-line bg-surface p-5 shadow-[0_20px_60px_rgb(27_30_60/18%)] sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-bold text-ink" id={titleId}>
                إضافة عميل
              </Dialog.Title>
              <Dialog.Description
                className="mt-1 text-sm text-muted"
                id={descriptionId}
              >
                خطوة {step + 1} من {STEPS.length}: {STEPS[step]}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="إغلاق"
                className="pressable grid size-11 place-items-center rounded-sm border border-line text-muted disabled:opacity-50"
                disabled={busy}
                type="button"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <ol className="mt-4 flex flex-wrap gap-2" aria-label="خطوات الإنشاء">
            {STEPS.map((label, index) => (
              <li
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  index === step
                    ? "bg-primary text-primary-on"
                    : index < step
                      ? "bg-success-soft text-success"
                      : "bg-surface-subtle text-muted"
                }`}
                key={label}
              >
                {label}
              </li>
            ))}
          </ol>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (step < STEPS.length - 1) {
                void goNext();
                return;
              }
              void handleSubmit(onSubmit)(event);
            }}
          >
            {step === 0 ? (
              <div className="space-y-3">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-email"
                  >
                    البريد الإلكتروني
                  </label>
                  <input
                    className={fieldClassName}
                    id="create-customer-email"
                    type="email"
                    {...register("email")}
                  />
                  {errors.email ? (
                    <p className="mt-1 text-xs font-semibold text-danger" role="alert">
                      {errors.email.message}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-display-name"
                  >
                    الاسم الظاهر
                  </label>
                  <input
                    className={fieldClassName}
                    id="create-customer-display-name"
                    {...register("displayName")}
                  />
                  {errors.displayName ? (
                    <p className="mt-1 text-xs font-semibold text-danger" role="alert">
                      {errors.displayName.message}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-3">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-workspace-name"
                  >
                    اسم المساحة
                  </label>
                  <input
                    className={fieldClassName}
                    id="create-customer-workspace-name"
                    {...register("workspaceName")}
                  />
                  {errors.workspaceName ? (
                    <p className="mt-1 text-xs font-semibold text-danger" role="alert">
                      {errors.workspaceName.message}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-currency"
                  >
                    العملة
                  </label>
                  <select
                    className={fieldClassName}
                    id="create-customer-currency"
                    {...register("currencyCode")}
                  >
                    <option value="LYD">LYD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3">
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-plan"
                  >
                    الخطة
                  </label>
                  <select
                    className={fieldClassName}
                    id="create-customer-plan"
                    {...register("planId")}
                  >
                    {activePlans.map((plan) => (
                      <option key={plan.planId} value={plan.planId}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                  {errors.planId ? (
                    <p className="mt-1 text-xs font-semibold text-danger" role="alert">
                      {errors.planId.message}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-subscription-status"
                  >
                    حالة الاشتراك
                  </label>
                  <select
                    className={fieldClassName}
                    id="create-customer-subscription-status"
                    {...register("subscriptionStatus")}
                  >
                    <option value="trialing">تجريبي</option>
                    <option value="active">نشط</option>
                  </select>
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-starts-at"
                  >
                    تاريخ البداية
                  </label>
                  <input
                    className={fieldClassName}
                    id="create-customer-starts-at"
                    type="datetime-local"
                    value={toDatetimeLocalValue(watched.startsAt)}
                    onChange={(event) => {
                      const next = fromDatetimeLocalValue(event.target.value);
                      if (next) setValue("startsAt", next, { shouldValidate: true });
                    }}
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-trial-ends-at"
                  >
                    نهاية التجربة
                  </label>
                  <input
                    className={fieldClassName}
                    id="create-customer-trial-ends-at"
                    type="datetime-local"
                    value={toDatetimeLocalValue(watched.trialEndsAt)}
                    onChange={(event) => {
                      setValue(
                        "trialEndsAt",
                        fromDatetimeLocalValue(event.target.value),
                        { shouldValidate: true },
                      );
                    }}
                  />
                  {errors.trialEndsAt ? (
                    <p className="mt-1 text-xs font-semibold text-danger" role="alert">
                      {errors.trialEndsAt.message}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-period-ends-at"
                  >
                    نهاية الفترة الحالية
                  </label>
                  <input
                    className={fieldClassName}
                    id="create-customer-period-ends-at"
                    type="datetime-local"
                    value={toDatetimeLocalValue(watched.currentPeriodEndsAt)}
                    onChange={(event) => {
                      setValue(
                        "currentPeriodEndsAt",
                        fromDatetimeLocalValue(event.target.value),
                        { shouldValidate: true },
                      );
                    }}
                  />
                  {errors.currentPeriodEndsAt ? (
                    <p className="mt-1 text-xs font-semibold text-danger" role="alert">
                      {errors.currentPeriodEndsAt.message}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-bold text-ink">
                  طريقة الدخول
                </legend>
                {(
                  Object.keys(DELIVERY_LABELS) as CustomerDeliveryMode[]
                ).map((mode) => (
                  <label
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/40"
                    key={mode}
                  >
                    <input
                      type="radio"
                      value={mode}
                      {...register("deliveryMode")}
                    />
                    <span className="text-sm font-semibold text-ink">
                      {DELIVERY_LABELS[mode]}
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            {step === 4 ? (
              <div className="space-y-3">
                <dl className="space-y-2 rounded-md border border-line bg-surface-subtle/50 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">البريد</dt>
                    <dd className="font-semibold text-ink">{getValues("email")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">الاسم</dt>
                    <dd className="font-semibold text-ink">
                      {getValues("displayName")}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">المساحة</dt>
                    <dd className="font-semibold text-ink">
                      {getValues("workspaceName")} ({getValues("currencyCode")})
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">الخطة</dt>
                    <dd className="font-semibold text-ink">
                      {selectedPlan?.name ?? getValues("planId")}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">الدخول</dt>
                    <dd className="font-semibold text-ink">
                      {DELIVERY_LABELS[getValues("deliveryMode")]}
                    </dd>
                  </div>
                </dl>
                <div>
                  <label
                    className="mb-1.5 block text-sm font-bold text-ink"
                    htmlFor="create-customer-note"
                  >
                    ملاحظة المدير
                  </label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
                    id="create-customer-note"
                    {...register("note")}
                  />
                  {errors.note ? (
                    <p className="mt-1 text-xs font-semibold text-danger" role="alert">
                      {errors.note.message}
                    </p>
                  ) : null}
                </div>
                {submitError ? (
                  <p className="text-sm font-semibold text-danger" role="alert">
                    {submitError}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted" data-testid="client-id">
                  معرف الطلب: {clientId || "—"}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
              <button
                className="pressable inline-flex min-h-11 items-center justify-center rounded-sm border border-line-strong bg-surface px-4 text-sm font-bold text-ink disabled:opacity-40"
                disabled={busy || step === 0}
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                type="button"
              >
                السابق
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  className="pressable inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-4 text-sm font-bold text-primary-on"
                  type="submit"
                >
                  التالي
                </button>
              ) : (
                <button
                  className="pressable inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-4 text-sm font-bold text-primary-on disabled:opacity-50"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? "جارٍ الإنشاء…" : "إنشاء العميل"}
                </button>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
