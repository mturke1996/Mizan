import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  billingAdminKeys,
  changeSubscriptionPlan,
  fetchAdminPlans,
  renewSubscription,
  scheduleSubscriptionState,
  setSubscriptionState,
} from "./billing-admin-api";
import {
  customerAdminKeys,
  fetchCustomers,
} from "./customer-admin-api";
import type {
  SubscriptionStatus,
  SupervisorCustomerRow,
} from "./customer-admin-types";
import { SupervisorActionDialog } from "./SupervisorActionDialog";
import { SupervisorDataTable } from "./SupervisorDataTable";
import { ErrorBlock, StatusBadge } from "./SupervisorUi";
import { invalidateSupervisor } from "./supervisor-api";
import {
  daysUntil,
  formatDateAr,
  statusTone,
  subscriptionStatusLabel,
} from "./supervisor-utils";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { id: "all", label: "الكل" },
  { id: "trialing", label: "تجريبي" },
  { id: "active", label: "نشط" },
  { id: "grace", label: "مهلة" },
  { id: "frozen", label: "مجمّد" },
  { id: "expired", label: "منتهٍ" },
  { id: "cancelled", label: "ملغى" },
  { id: "expiring7", label: "ينتهي خلال 7 أيام" },
] as const;

type FilterId = (typeof STATUS_FILTERS)[number]["id"];

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

export function SupervisorSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get("filter") as FilterId | null) ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [selected, setSelected] = useState<SupervisorCustomerRow | null>(null);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [planId, setPlanId] = useState("");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [currentPeriodEndsAt, setCurrentPeriodEndsAt] = useState("");
  const [graceEndsAt, setGraceEndsAt] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const isExpiringFilter = filter === "expiring7";
  const subscriptionStatus =
    filter === "all" || isExpiringFilter ? undefined : filter;

  const listFilters = useMemo(
    () => ({
      subscriptionStatus,
      limit: isExpiringFilter ? 100 : PAGE_SIZE,
      offset: isExpiringFilter ? 0 : (page - 1) * PAGE_SIZE,
    }),
    [subscriptionStatus, isExpiringFilter, page],
  );

  const customersQuery = useQuery({
    queryKey: customerAdminKeys.list({ ...listFilters, filter }),
    queryFn: () => fetchCustomers(listFilters),
  });

  const plansQuery = useQuery({
    queryKey: billingAdminKeys.plansActive,
    queryFn: () => fetchAdminPlans(false),
  });

  const rows = useMemo(() => {
    const all = customersQuery.data?.rows ?? [];
    if (!isExpiringFilter) return all;
    return all.filter((row) => {
      const remaining = daysUntil(row.currentPeriodEndsAt);
      return (
        remaining != null &&
        remaining >= 0 &&
        remaining <= 7 &&
        ["trialing", "active", "grace"].includes(row.effectiveSubscriptionStatus)
      );
    });
  }, [customersQuery.data?.rows, isExpiringFilter]);

  const total = isExpiringFilter
    ? rows.length
    : (customersQuery.data?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activePlans = (plansQuery.data ?? []).filter((plan) => plan.isActive);

  const actionMutation = useMutation({
    mutationFn: async (input: { note: string }) => {
      if (!selected || !action) throw new Error("لا إجراء محدد");
      const clientId = crypto.randomUUID();
      const workspaceId = selected.workspaceId;

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
        fromDatetimeLocalValue(scheduledAt) ??
        selected.currentPeriodEndsAt;
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
      setSelected(null);
      await invalidateSupervisor(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function setFilter(next: FilterId) {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("filter");
    else params.set("filter", next);
    params.delete("page");
    setSearchParams(params, { replace: true });
  }

  function setPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    setSearchParams(params, { replace: true });
  }

  function openAction(row: SupervisorCustomerRow, next: ActionKind) {
    setSelected(row);
    setAction(next);
    setPlanId(row.planId);
    setTrialEndsAt(toDatetimeLocalValue(row.trialEndsAt));
    setCurrentPeriodEndsAt(toDatetimeLocalValue(row.currentPeriodEndsAt));
    setGraceEndsAt("");
    setScheduledAt(toDatetimeLocalValue(row.currentPeriodEndsAt));
  }

  const dialogTitle =
    action?.type === "renew"
      ? `تجديد ${action.periodCount} فترة`
      : action?.type === "change_plan"
        ? "تغيير الخطة"
        : action?.type === "set_state"
          ? `تعيين الحالة: ${subscriptionStatusLabel[action.targetStatus] ?? action.targetStatus}`
          : action?.type === "schedule"
            ? `جدولة ${action.targetStatus === "cancelled" ? "الإلغاء" : "الانتهاء"}`
            : "";

  return (
    <div className="page-enter space-y-5 pt-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">الاشتراكات</h1>
        <p className="mt-1 text-sm text-muted">
          تمديد وتجميد وإلغاء مباشر — بدون انتظار طلب دفع من العميل، مع توثيق
          كل قرار.
        </p>
      </div>

      <div
        aria-label="تصفية الاشتراكات"
        className="subtle-scrollbar flex gap-2 overflow-x-auto pb-1"
      >
        {STATUS_FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              className={`pressable shrink-0 rounded-sm px-3 py-2 text-xs font-bold ${
                active
                  ? "bg-primary text-primary-on"
                  : "bg-surface-subtle text-muted hover:text-ink"
              }`}
              key={item.id}
              onClick={() => setFilter(item.id)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {customersQuery.isError ? (
        <ErrorBlock
          message={
            customersQuery.error instanceof Error
              ? customersQuery.error.message
              : "حاول مرة أخرى"
          }
          onRetry={() => void customersQuery.refetch()}
        />
      ) : (
        <SupervisorDataTable
          columns={[
            {
              id: "customer",
              header: "العميل",
              cell: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {row.displayName || row.email}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {row.workspaceName}
                  </p>
                </div>
              ),
            },
            {
              id: "plan",
              header: "الخطة",
              cell: (row) => row.planName || "—",
            },
            {
              id: "status",
              header: "الحالة",
              cell: (row) => (
                <StatusBadge
                  label={
                    subscriptionStatusLabel[row.effectiveSubscriptionStatus] ??
                    "—"
                  }
                  tone={statusTone(row.effectiveSubscriptionStatus)}
                />
              ),
            },
            {
              id: "timeline",
              header: "الجدول الزمني",
              cell: (row) => (
                <div className="text-xs text-muted">
                  <p>نهاية الفترة: {formatDateAr(row.currentPeriodEndsAt)}</p>
                  {row.scheduledStatus ? (
                    <p className="mt-1 text-warning">
                      مجدول{" "}
                      {subscriptionStatusLabel[row.scheduledStatus] ??
                        row.scheduledStatus}{" "}
                      · {formatDateAr(row.scheduledStatusAt)}
                    </p>
                  ) : null}
                </div>
              ),
            },
            {
              id: "actions",
              header: "إجراء",
              cell: (row) => (
                <div
                  className="flex flex-wrap gap-1"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {([1, 3, 6, 12] as const).map((count) => (
                    <button
                      className="pressable min-h-9 rounded-sm border border-line-strong bg-surface px-2 text-[10px] font-bold text-ink"
                      key={count}
                      onClick={() =>
                        openAction(row, { type: "renew", periodCount: count })
                      }
                      type="button"
                    >
                      +{count}
                    </button>
                  ))}
                  <button
                    className="pressable min-h-9 rounded-sm border border-line-strong bg-surface px-2 text-[10px] font-bold text-primary"
                    onClick={() => openAction(row, { type: "change_plan" })}
                    type="button"
                  >
                    خطة
                  </button>
                  <button
                    className="pressable min-h-9 rounded-sm border border-line-strong bg-surface px-2 text-[10px] font-bold text-warning"
                    onClick={() =>
                      openAction(row, {
                        type: "set_state",
                        targetStatus: "frozen",
                      })
                    }
                    type="button"
                  >
                    حالة
                  </button>
                  <button
                    className="pressable min-h-9 rounded-sm border border-line-strong bg-surface px-2 text-[10px] font-bold text-danger"
                    onClick={() =>
                      openAction(row, {
                        type: "schedule",
                        targetStatus: "cancelled",
                      })
                    }
                    type="button"
                  >
                    جدولة
                  </button>
                </div>
              ),
            },
          ]}
          emptyTitle="لا اشتراكات"
          isLoading={customersQuery.isLoading}
          onPageChange={setPage}
          onRowSelect={(row) => setSelected(row)}
          page={isExpiringFilter ? 1 : page}
          pageCount={isExpiringFilter ? 1 : pageCount}
          renderMobileRow={(row) => (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-ink">
                    {row.displayName || row.email}
                  </p>
                  <p className="text-xs text-muted">
                    {row.workspaceName} · {row.planName}
                  </p>
                </div>
                <StatusBadge
                  label={
                    subscriptionStatusLabel[row.effectiveSubscriptionStatus] ??
                    "—"
                  }
                  tone={statusTone(row.effectiveSubscriptionStatus)}
                />
              </div>
              <p className="text-[11px] text-soft">
                نهاية الفترة: {formatDateAr(row.currentPeriodEndsAt)}
              </p>
              <div className="flex flex-wrap gap-1">
                {([1, 3, 6, 12] as const).map((count) => (
                  <button
                    className="pressable min-h-9 rounded-sm border border-line-strong bg-surface px-2 text-[10px] font-bold"
                    key={count}
                    onClick={(event) => {
                      event.stopPropagation();
                      openAction(row, { type: "renew", periodCount: count });
                    }}
                    type="button"
                  >
                    تجديد {count}
                  </button>
                ))}
                <button
                  className="pressable min-h-9 rounded-sm border border-line-strong bg-surface px-2 text-[10px] font-bold text-primary"
                  onClick={(event) => {
                    event.stopPropagation();
                    openAction(row, { type: "change_plan" });
                  }}
                  type="button"
                >
                  تغيير الخطة
                </button>
                <button
                  className="pressable min-h-9 rounded-sm border border-line-strong bg-surface px-2 text-[10px] font-bold text-warning"
                  onClick={(event) => {
                    event.stopPropagation();
                    openAction(row, {
                      type: "set_state",
                      targetStatus:
                        row.effectiveSubscriptionStatus === "frozen"
                          ? "active"
                          : "frozen",
                    });
                  }}
                  type="button"
                >
                  {row.effectiveSubscriptionStatus === "frozen"
                    ? "إلغاء التجميد"
                    : "تجميد"}
                </button>
                <button
                  className="pressable min-h-9 rounded-sm border border-line-strong bg-surface px-2 text-[10px] font-bold text-danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    openAction(row, {
                      type: "schedule",
                      targetStatus: "cancelled",
                    });
                  }}
                  type="button"
                >
                  جدولة إلغاء
                </button>
              </div>
            </div>
          )}
          rowKey={(row) => row.workspaceId}
          rows={
            isExpiringFilter
              ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              : rows
          }
          selectedId={selected?.workspaceId}
        />
      )}

      <SupervisorActionDialog
        confirmLabel="تنفيذ"
        description={
          selected
            ? `${selected.displayName || selected.email} · ${selected.workspaceName}`
            : "تأكيد إجراء الاشتراك"
        }
        isPending={actionMutation.isPending}
        noteRequired
        onConfirm={(note) => {
          if (actionMutation.isPending) return;
          actionMutation.mutate({ note });
        }}
        onOpenChange={(open) => {
          if (!open && !actionMutation.isPending) {
            setAction(null);
          }
        }}
        open={Boolean(action && selected)}
        title={dialogTitle}
        tone={
          action?.type === "schedule" ||
          (action?.type === "set_state" &&
            (action.targetStatus === "expired" ||
              action.targetStatus === "cancelled" ||
              action.targetStatus === "frozen"))
            ? "danger"
            : "primary"
        }
      >
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
                <option value="cancelled">ملغى عند نهاية الفترة</option>
                <option value="expired">منتهٍ عند نهاية الفترة</option>
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

        {action?.type === "renew" ? (
          <p className="text-sm text-muted">
            سيتم تمديد الاشتراك بمقدار {action.periodCount} فترة وفق دورة الخطة
            الحالية.
          </p>
        ) : null}
      </SupervisorActionDialog>
    </div>
  );
}
