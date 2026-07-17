import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarClock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Shuffle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  billingAdminKeys,
  changeSubscriptionPlan,
  fetchAdminPlans,
  renewSubscription,
  scheduleSubscriptionState,
  setSubscriptionState,
} from "./billing-admin-api";
import { customerAdminKeys } from "./customer-admin-api";
import type {
  SubscriptionStatus,
  SupervisorCustomerRow,
} from "./customer-admin-types";
import { SupervisorActionDialog } from "./SupervisorActionDialog";
import { invalidateSupervisor } from "./supervisor-api";
import { subscriptionStatusLabel } from "./supervisor-utils";

type ActionKind =
  | { type: "renew"; periodCount: 1 | 3 | 6 | 12 }
  | { type: "change_plan" }
  | { type: "set_state"; targetStatus: SubscriptionStatus }
  | { type: "schedule"; targetStatus: "cancelled" | "expired" };

const SET_STATE_OPTIONS: SubscriptionStatus[] = [
  "active",
  "grace",
  "frozen",
  "expired",
  "cancelled",
];

const PERIOD_OPTIONS = [1, 3, 6, 12] as const;

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

export interface CustomerSubscriptionControlsProps {
  customer: SupervisorCustomerRow;
}

export function CustomerSubscriptionControls({
  customer,
}: CustomerSubscriptionControlsProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ActionKind | null>(null);
  const [planId, setPlanId] = useState(customer.planId);
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [currentPeriodEndsAt, setCurrentPeriodEndsAt] = useState("");
  const [graceEndsAt, setGraceEndsAt] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const plansQuery = useQuery({
    queryKey: billingAdminKeys.plansActive,
    queryFn: () => fetchAdminPlans(false),
  });

  const activePlans = (plansQuery.data ?? []).filter((plan) => plan.isActive);
  const isFrozen = customer.effectiveSubscriptionStatus === "frozen";
  const isCancelledOrExpired = ["cancelled", "expired"].includes(
    customer.effectiveSubscriptionStatus,
  );

  const actionMutation = useMutation({
    mutationFn: async (input: { note: string }) => {
      if (!action) throw new Error("لا إجراء محدد");
      const clientId = crypto.randomUUID();
      const workspaceId = customer.workspaceId;

      if (action.type === "renew") {
        await renewSubscription({
          workspaceId,
          periodCount: action.periodCount,
          note: input.note,
          clientId,
        });
        return;
      }

      if (action.type === "change_plan") {
        if (!planId) throw new Error("اختر خطة");
        await changeSubscriptionPlan({
          workspaceId,
          planId,
          note: input.note,
          clientId,
        });
        return;
      }

      if (action.type === "set_state") {
        await setSubscriptionState({
          workspaceId,
          targetStatus: action.targetStatus,
          trialEndsAt: fromDatetimeLocalValue(trialEndsAt),
          currentPeriodEndsAt: fromDatetimeLocalValue(currentPeriodEndsAt),
          graceEndsAt: fromDatetimeLocalValue(graceEndsAt),
          note: input.note,
          clientId,
        });
        return;
      }

      const when =
        fromDatetimeLocalValue(scheduledAt) ?? customer.currentPeriodEndsAt;
      if (!when) throw new Error("حدد موعد الجدولة");
      await scheduleSubscriptionState({
        workspaceId,
        targetStatus: action.targetStatus,
        scheduledAt: when,
        note: input.note,
        clientId,
      });
    },
    onSuccess: async () => {
      toast.success("تم تحديث الاشتراك");
      setAction(null);
      await invalidateSupervisor(queryClient);
      await queryClient.invalidateQueries({
        queryKey: customerAdminKeys.detail(customer.userId),
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openAction(next: ActionKind) {
    setAction(next);
    setPlanId(customer.planId || activePlans[0]?.planId || "");
    setTrialEndsAt(toDatetimeLocalValue(customer.trialEndsAt));
    setCurrentPeriodEndsAt(toDatetimeLocalValue(customer.currentPeriodEndsAt));
    setGraceEndsAt("");
    setScheduledAt(toDatetimeLocalValue(customer.currentPeriodEndsAt));
  }

  const dialogTitle =
    action?.type === "renew"
      ? `تمديد ${action.periodCount} فترة`
      : action?.type === "change_plan"
        ? "تغيير الخطة"
        : action?.type === "set_state"
          ? `تعيين الحالة: ${subscriptionStatusLabel[action.targetStatus] ?? action.targetStatus}`
          : action?.type === "schedule"
            ? `جدولة ${action.targetStatus === "cancelled" ? "الإلغاء" : "الانتهاء"}`
            : "";

  const dialogTone =
    action?.type === "schedule" ||
    (action?.type === "set_state" &&
      (action.targetStatus === "expired" ||
        action.targetStatus === "cancelled" ||
        action.targetStatus === "frozen"))
      ? "danger"
      : "primary";

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-2xl border border-primary/15 bg-primary-soft/40 px-3.5 py-3">
        <p className="text-xs font-bold text-primary">تحكم مباشر بالاشتراك</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          يمكنك تمديد أو إيقاف أو تفعيل الاشتراك دون انتظار طلب دفع أو إثبات من
          العميل. كل إجراء يُسجَّل بملاحظة المدير.
        </p>
      </div>

      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <RefreshCw aria-hidden="true" className="text-primary" size={15} />
          <p className="text-xs font-bold text-ink">تمديد الاشتراك</p>
        </div>
        <p className="text-[11px] text-muted">
          يفعّل الاشتراك ويمدّد نهاية الفترة وفق دورة الخطة الحالية.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {PERIOD_OPTIONS.map((count) => (
            <button
              className="pressable flex min-h-12 flex-col items-center justify-center rounded-2xl border border-line bg-canvas px-2 text-sm font-bold text-ink hover:border-primary/30 hover:bg-primary-soft/50"
              key={count}
              onClick={() => openAction({ type: "renew", periodCount: count })}
              type="button"
            >
              <span>+{count}</span>
              <span className="text-[10px] font-semibold text-muted">فترة</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <p className="text-xs font-bold text-ink">إجراءات سريعة</p>
        <div className="grid grid-cols-2 gap-2">
          {isFrozen ? (
            <button
              className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-success-soft px-3 text-sm font-bold text-success"
              onClick={() =>
                openAction({ type: "set_state", targetStatus: "active" })
              }
              type="button"
            >
              <PlayCircle aria-hidden="true" size={16} />
              إلغاء التجميد
            </button>
          ) : (
            <button
              className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-warning-soft px-3 text-sm font-bold text-warning"
              onClick={() =>
                openAction({ type: "set_state", targetStatus: "frozen" })
              }
              type="button"
            >
              <PauseCircle aria-hidden="true" size={16} />
              تجميد الاشتراك
            </button>
          )}
          <button
            className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-danger-soft px-3 text-sm font-bold text-danger"
            onClick={() =>
              openAction({ type: "set_state", targetStatus: "cancelled" })
            }
            type="button"
          >
            <Ban aria-hidden="true" size={16} />
            إلغاء فوري
          </button>
          {isCancelledOrExpired ? (
            <button
              className="pressable col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-success-soft px-3 text-sm font-bold text-success"
              onClick={() =>
                openAction({ type: "set_state", targetStatus: "active" })
              }
              type="button"
            >
              <PlayCircle aria-hidden="true" size={16} />
              إعادة تفعيل الاشتراك
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-2.5">
        <p className="text-xs font-bold text-ink">إدارة متقدمة</p>
        <div className="grid gap-2">
          <button
            className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-canvas px-4 text-sm font-bold text-primary"
            onClick={() => openAction({ type: "change_plan" })}
            type="button"
          >
            <Shuffle aria-hidden="true" size={16} />
            تغيير الخطة
          </button>
          <button
            className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-canvas px-4 text-sm font-bold text-ink"
            onClick={() =>
              openAction({
                type: "set_state",
                targetStatus: customer.effectiveSubscriptionStatus,
              })
            }
            type="button"
          >
            تعيين حالة وتواريخ يدويًا
          </button>
          <button
            className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-canvas px-4 text-sm font-bold text-danger"
            onClick={() =>
              openAction({ type: "schedule", targetStatus: "cancelled" })
            }
            type="button"
          >
            <CalendarClock aria-hidden="true" size={16} />
            جدولة إلغاء / انتهاء
          </button>
        </div>
      </section>

      <SupervisorActionDialog
        confirmLabel="تنفيذ"
        description={`${customer.displayName || customer.email} · ${customer.workspaceName}`}
        isPending={actionMutation.isPending}
        noteRequired
        onConfirm={(note) => {
          if (actionMutation.isPending) return;
          actionMutation.mutate({ note });
        }}
        onOpenChange={(open) => {
          if (!open && !actionMutation.isPending) setAction(null);
        }}
        open={Boolean(action)}
        title={dialogTitle}
        tone={dialogTone}
      >
        {action?.type === "renew" ? (
          <p className="text-sm text-muted">
            سيتم تفعيل الاشتراك وتمديده بمقدار {action.periodCount} فترة وفق
            دورة الخطة الحالية — بدون الحاجة لطلب دفع من العميل.
          </p>
        ) : null}

        {action?.type === "change_plan" ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">
              الخطة الجديدة
            </span>
            <select
              className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              onChange={(event) => setPlanId(event.target.value)}
              value={planId}
            >
              {activePlans.map((plan) => (
                <option key={plan.planId} value={plan.planId}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {action?.type === "set_state" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                الحالة المستهدفة
              </span>
              <select
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                onChange={(event) =>
                  setAction({
                    type: "set_state",
                    targetStatus: event.target.value as SubscriptionStatus,
                  })
                }
                value={action.targetStatus}
              >
                {SET_STATE_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {subscriptionStatusLabel[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                نهاية التجربة
              </span>
              <input
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                onChange={(event) => setTrialEndsAt(event.target.value)}
                type="datetime-local"
                value={trialEndsAt}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                نهاية الفترة الحالية
              </span>
              <input
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                onChange={(event) => setCurrentPeriodEndsAt(event.target.value)}
                type="datetime-local"
                value={currentPeriodEndsAt}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                نهاية المهلة
              </span>
              <input
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                onChange={(event) => setGraceEndsAt(event.target.value)}
                type="datetime-local"
                value={graceEndsAt}
              />
            </label>
          </div>
        ) : null}

        {action?.type === "schedule" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                الحالة المجدولة
              </span>
              <select
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                onChange={(event) =>
                  setAction({
                    type: "schedule",
                    targetStatus: event.target.value as "cancelled" | "expired",
                  })
                }
                value={action.targetStatus}
              >
                <option value="cancelled">ملغى عند الموعد</option>
                <option value="expired">منتهٍ عند الموعد</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">
                موعد التنفيذ
              </span>
              <input
                className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                onChange={(event) => setScheduledAt(event.target.value)}
                type="datetime-local"
                value={scheduledAt}
              />
              <p className="mt-1 text-[11px] text-muted">
                الافتراضي: نهاية الفترة الحالية
              </p>
            </label>
          </div>
        ) : null}
      </SupervisorActionDialog>
    </div>
  );
}
