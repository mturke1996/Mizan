import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  archivePlan,
  billingAdminKeys,
  createPlan,
  fetchAdminPlans,
  updatePlan,
} from "./billing-admin-api";
import type {
  AdminPlan,
  BillingInterval,
  CreatePlanInput,
  UpdatePlanInput,
} from "./customer-admin-types";
import { SupervisorActionDialog } from "./SupervisorActionDialog";
import { ErrorBlock, LoadingBlock, StatusBadge } from "./SupervisorUi";
import { getCurrencyScale } from "@/domain/money/money";
import { invalidateSupervisor } from "./supervisor-api";
import { formatMinorCurrency } from "./supervisor-utils";

export const PLAN_FEATURES = ["manual_payment"] as const;

const INTERVAL_LABELS: Record<BillingInterval, string> = {
  none: "بدون دورة",
  monthly: "شهري",
  yearly: "سنوي",
};

type EditorMode = "create" | "edit";

interface PlanFormState {
  code: string;
  name: string;
  priceMajor: string;
  currencyCode: string;
  billingInterval: BillingInterval;
  intervalCount: string;
  trialDays: string;
  isPublic: boolean;
  manualPayment: boolean;
}

const EMPTY_FORM: PlanFormState = {
  code: "",
  name: "",
  priceMajor: "0",
  currencyCode: "LYD",
  billingInterval: "monthly",
  intervalCount: "1",
  trialDays: "0",
  isPublic: true,
  manualPayment: true,
};

function toMajor(priceMinor: number, currencyCode: string): string {
  const scale = getCurrencyScale(currencyCode);
  const major = priceMinor / 10 ** scale;
  return major
    .toFixed(scale)
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "") || "0";
}

function toMinor(priceMajor: string, currencyCode: string): number {
  const parsed = Number(priceMajor);
  if (!Number.isFinite(parsed) || parsed < 0) return NaN;
  const scale = getCurrencyScale(currencyCode);
  return Math.round(parsed * 10 ** scale);
}

function formFromPlan(plan: AdminPlan): PlanFormState {
  return {
    code: plan.code,
    name: plan.name,
    priceMajor: toMajor(plan.priceMinor, plan.currencyCode),
    currencyCode: plan.currencyCode,
    billingInterval: plan.billingInterval,
    intervalCount: String(plan.intervalCount ?? 1),
    trialDays: String(plan.trialDays),
    isPublic: plan.isPublic,
    manualPayment: Boolean(plan.features.manual_payment),
  };
}

function subscriberTotal(plan: AdminPlan): number {
  const counts = plan.subscriptionCounts;
  return (
    counts.trialing +
    counts.active +
    counts.grace +
    counts.frozen +
    counts.expired +
    counts.cancelled
  );
}

export function SupervisorPlansPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [mode, setMode] = useState<EditorMode>("create");
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [archiveTarget, setArchiveTarget] = useState<AdminPlan | null>(null);
  const [submitClientId, setSubmitClientId] = useState(() =>
    crypto.randomUUID(),
  );

  const plansQuery = useQuery({
    queryKey: billingAdminKeys.plans,
    queryFn: () => fetchAdminPlans(true),
  });

  const plans = plansQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async (note: string) => {
      const priceMinor = toMinor(form.priceMajor, form.currencyCode);
      if (!Number.isFinite(priceMinor)) {
        throw new Error("أدخل سعرًا صالحًا");
      }
      if (!form.name.trim()) throw new Error("اسم الخطة مطلوب");
      if (mode === "create" && !form.code.trim()) {
        throw new Error("رمز الخطة مطلوب عند الإنشاء");
      }

      const features: Record<string, unknown> = {};
      if (form.manualPayment) features.manual_payment = true;

      const intervalCount =
        form.billingInterval === "none"
          ? null
          : Math.max(1, Number(form.intervalCount) || 1);

      if (mode === "create") {
        const input: CreatePlanInput = {
          code: form.code.trim(),
          name: form.name.trim(),
          priceMinor,
          currencyCode: form.currencyCode.trim().toUpperCase(),
          billingInterval: form.billingInterval,
          intervalCount,
          trialDays: Math.max(0, Number(form.trialDays) || 0),
          isPublic: form.isPublic,
          features,
          note,
          clientId: submitClientId,
        };
        return createPlan(input);
      }

      if (!editingPlan) throw new Error("لا خطة محددة");
      const input: UpdatePlanInput = {
        planId: editingPlan.planId,
        name: form.name.trim(),
        priceMinor,
        currencyCode: form.currencyCode.trim().toUpperCase(),
        billingInterval: form.billingInterval,
        intervalCount,
        trialDays: Math.max(0, Number(form.trialDays) || 0),
        isPublic: form.isPublic,
        features,
        note,
        clientId: submitClientId,
      };
      return updatePlan(input);
    },
    onSuccess: async () => {
      toast.success(mode === "create" ? "تم إنشاء الخطة" : "تم تحديث الخطة");
      setEditorOpen(false);
      setSubmitClientId(crypto.randomUUID());
      await invalidateSupervisor(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (note: string) => {
      if (!archiveTarget) throw new Error("لا خطة محددة");
      return archivePlan({
        planId: archiveTarget.planId,
        note,
        clientId: crypto.randomUUID(),
      });
    },
    onSuccess: async () => {
      toast.success("تم أرشفة الخطة");
      setArchiveTarget(null);
      await invalidateSupervisor(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sortedPlans = useMemo(
    () =>
      [...plans].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name, "ar");
      }),
    [plans],
  );

  function openCreate() {
    setMode("create");
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setSubmitClientId(crypto.randomUUID());
    setEditorOpen(true);
  }

  function openEdit(plan: AdminPlan) {
    setMode("edit");
    setEditingPlan(plan);
    setForm(formFromPlan(plan));
    setSubmitClientId(crypto.randomUUID());
    setEditorOpen(true);
  }

  return (
    <div className="page-enter space-y-5 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">الخطط</h1>
          <p className="mt-1 text-sm text-muted">
            إنشاء وتحديث وأرشفة خطط الاشتراك.
          </p>
        </div>
        <button
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
          onClick={openCreate}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          خطة جديدة
        </button>
      </div>

      {plansQuery.isLoading ? (
        <LoadingBlock rows={4} />
      ) : plansQuery.isError ? (
        <ErrorBlock
          message={
            plansQuery.error instanceof Error
              ? plansQuery.error.message
              : "حاول مرة أخرى"
          }
          onRetry={() => void plansQuery.refetch()}
        />
      ) : sortedPlans.length === 0 ? (
        <p className="text-sm text-muted">لا خطط بعد.</p>
      ) : (
        <div className="space-y-3">
          {sortedPlans.map((plan) => {
            const total = subscriberTotal(plan);
            return (
              <article
                className="rounded-lg border border-line bg-surface p-4"
                key={plan.planId}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-ink">
                        {plan.name}
                      </h2>
                      <StatusBadge
                        label={plan.isPublic ? "عامة" : "خاصة"}
                        tone={
                          plan.isPublic
                            ? "bg-success-soft text-success"
                            : "bg-surface-subtle text-muted"
                        }
                      />
                      <StatusBadge
                        label={plan.isActive ? "نشطة" : "مؤرشفة"}
                        tone={
                          plan.isActive
                            ? "bg-info-soft text-info"
                            : "bg-danger-soft text-danger"
                        }
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      رمز: <span className="font-semibold">{plan.code}</span> ·{" "}
                      {INTERVAL_LABELS[plan.billingInterval]}
                      {plan.intervalCount ? ` × ${plan.intervalCount}` : ""}
                    </p>
                    <p className="numeric mt-2 text-lg font-bold text-ink">
                      {formatMinorCurrency(plan.priceMinor, plan.currencyCode)}{" "}
                      <span className="text-sm text-muted">
                        {plan.currencyCode}
                      </span>
                    </p>
                    <p className="mt-2 text-[11px] text-soft">
                      مشتركون: {total} (نشط {plan.subscriptionCounts.active} ·
                      تجريبي {plan.subscriptionCounts.trialing})
                    </p>
                    {plan.features.manual_payment ? (
                      <p className="mt-1 text-[11px] font-semibold text-primary">
                        دفع يدوي مفعّل
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="pressable min-h-11 rounded-sm border border-line-strong bg-surface px-3 text-xs font-bold text-ink"
                      onClick={() => openEdit(plan)}
                      type="button"
                    >
                      تعديل
                    </button>
                    {plan.isActive ? (
                      <button
                        className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-sm bg-danger-soft px-3 text-xs font-bold text-danger"
                        onClick={() => setArchiveTarget(plan)}
                        type="button"
                      >
                        <Archive aria-hidden="true" size={14} />
                        أرشفة
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <SupervisorActionDialog
        confirmLabel={mode === "create" ? "إنشاء الخطة" : "حفظ التعديلات"}
        description={
          mode === "create"
            ? "إنشاء خطة اشتراك جديدة. الرمز يُحدد عند الإنشاء فقط."
            : `تحديث خطة ${editingPlan?.name ?? ""}`
        }
        isPending={saveMutation.isPending}
        noteRequired
        onConfirm={(note) => {
          if (saveMutation.isPending) return;
          saveMutation.mutate(note);
        }}
        onOpenChange={(open) => {
          if (!open && !saveMutation.isPending) setEditorOpen(false);
        }}
        open={editorOpen}
        title={mode === "create" ? "خطة جديدة" : "تعديل الخطة"}
      >
        <div className="space-y-3">
          {mode === "create" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                الرمز
              </span>
              <input
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                placeholder="basic"
                value={form.code}
              />
            </label>
          ) : (
            <p className="rounded-md bg-surface-subtle px-3 py-2 text-xs text-muted">
              الرمز: <strong className="text-ink">{form.code}</strong> (ثابت بعد
              الإنشاء)
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">الاسم</span>
            <input
              className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              value={form.name}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                السعر
              </span>
              <input
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                inputMode="decimal"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priceMajor: event.target.value,
                  }))
                }
                value={form.priceMajor}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                العملة
              </span>
              <input
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm uppercase"
                maxLength={3}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currencyCode: event.target.value.toUpperCase(),
                  }))
                }
                value={form.currencyCode}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                دورة الفوترة
              </span>
              <select
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    billingInterval: event.target.value as BillingInterval,
                  }))
                }
                value={form.billingInterval}
              >
                <option value="none">بدون دورة</option>
                <option value="monthly">شهري</option>
                <option value="yearly">سنوي</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                عدد الدورات
              </span>
              <input
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm disabled:opacity-50"
                disabled={form.billingInterval === "none"}
                inputMode="numeric"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    intervalCount: event.target.value,
                  }))
                }
                value={form.intervalCount}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">
              أيام التجربة
            </span>
            <input
              className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              inputMode="numeric"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  trialDays: event.target.value,
                }))
              }
              value={form.trialDays}
            />
          </label>

          <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink">
            <input
              checked={form.isPublic}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isPublic: event.target.checked,
                }))
              }
              type="checkbox"
            />
            خطة عامة
          </label>

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">المزايا</legend>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
              <input
                checked={form.manualPayment}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    manualPayment: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              دفع يدوي (manual_payment)
            </label>
          </fieldset>
        </div>
      </SupervisorActionDialog>

      <SupervisorActionDialog
        confirmLabel="أرشفة"
        description={
          archiveTarget
            ? `أرشفة «${archiveTarget.name}» لا تحذف الصف، وتمنع استخدامها للاشتراكات الجديدة.`
            : "أرشفة الخطة"
        }
        isPending={archiveMutation.isPending}
        noteRequired
        onConfirm={(note) => archiveMutation.mutate(note)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        open={Boolean(archiveTarget)}
        title="تأكيد الأرشفة"
        tone="danger"
      />
    </div>
  );
}
