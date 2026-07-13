import { CheckCircle2, ExternalLink, Eye, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { billingAdminKeys, fetchAdminPlans } from "./billing-admin-api";
import { SupervisorActionDialog } from "./SupervisorActionDialog";
import { SupervisorDataTable } from "./SupervisorDataTable";
import {
  createPaymentProofUrl,
  fetchPayments,
  invalidateSupervisor,
  reviewPayment,
  supervisorKeys,
  type PaymentRequestRow,
} from "./supervisor-api";
import { ErrorBlock, SearchField, StatusBadge } from "./SupervisorUi";
import {
  formatDateAr,
  formatMinorCurrency,
  statusTone,
} from "./supervisor-utils";

const PAGE_SIZE = 20;

const STATUS_TABS = [
  { id: "pending", label: "بانتظار المراجعة" },
  { id: "approved", label: "تمت الموافقة" },
  { id: "rejected", label: "مرفوضة" },
  { id: "all", label: "الكل" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function paymentStatusLabel(status: PaymentRequestRow["status"]): string {
  if (status === "pending") return "بانتظار المراجعة";
  if (status === "approved") return "موافق";
  return "مرفوض";
}

export function SupervisorPaymentsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [reviewTarget, setReviewTarget] = useState<{
    payment: PaymentRequestRow;
    decision: "approve" | "reject";
  } | null>(null);

  const statusTab = (searchParams.get("status") as StatusTab | null) ?? "pending";
  const planId = searchParams.get("plan") ?? "";
  const currencyCode = searchParams.get("currency") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const queryInput = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const [localQuery, setLocalQuery] = useState(
    () => searchParams.get("q") ?? "",
  );
  const debouncedQuery = useDebouncedValue(localQuery, 300);

  useEffect(() => {
    if (debouncedQuery === queryInput) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedQuery.trim()) next.set("q", debouncedQuery.trim());
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true });
  }, [debouncedQuery, queryInput, searchParams, setSearchParams]);

  function setParam(name: string, value: string, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    if (!value || (name === "status" && value === "pending")) {
      next.delete(name);
    } else {
      next.set(name, value);
    }
    if (resetPage) next.delete("page");
    setSearchParams(next, { replace: true });
  }

  const listFilters = useMemo(
    () => ({
      status: statusTab === "all" ? null : statusTab,
      query: debouncedQuery.trim() || undefined,
      planId: planId || undefined,
      currencyCode: currencyCode || undefined,
      from: from ? new Date(`${from}T00:00:00`).toISOString() : null,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [statusTab, debouncedQuery, planId, currencyCode, from, to, page],
  );

  const paymentsQuery = useQuery({
    queryKey: supervisorKeys.paymentsList(listFilters),
    queryFn: () => fetchPayments(listFilters),
  });

  const plansQuery = useQuery({
    queryKey: billingAdminKeys.plansActive,
    queryFn: () => fetchAdminPlans(false),
  });

  const reviewMutation = useMutation({
    mutationFn: (input: {
      id: string;
      decision: "approve" | "reject";
      note: string;
    }) => reviewPayment(input.id, input.decision, input.note),
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.decision === "approve" ? "تمت الموافقة" : "تم الرفض",
      );
      setReviewTarget(null);
      await invalidateSupervisor(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const proofMutation = useMutation({
    mutationFn: (input: { id: string; path: string }) =>
      createPaymentProofUrl(input.path).then((url) => ({ id: input.id, url })),
    onSuccess: ({ id, url }) => {
      setProofUrls((current) => ({ ...current, [id]: url }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = paymentsQuery.data?.rows ?? [];
  const total = paymentsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const plans = plansQuery.data ?? [];
  const currencies = useMemo(() => {
    const set = new Set(rows.map((row) => row.currencyCode).filter(Boolean));
    for (const plan of plans) set.add(plan.currencyCode);
    return [...set].sort();
  }, [rows, plans]);

  function openReview(
    payment: PaymentRequestRow,
    decision: "approve" | "reject",
  ) {
    if (decision === "approve" && !payment.proofObjectPath) {
      toast.error("الموافقة تتطلب إثبات دفع مرفقًا");
      return;
    }
    setReviewTarget({ payment, decision });
  }

  return (
    <div className="page-enter space-y-5 pt-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">المدفوعات</h1>
        <p className="mt-1 text-sm text-muted">
          صندوق وارد للمراجعة وسجل كامل للطلبات.
        </p>
      </div>

      <div
        aria-label="حالة الطلب"
        className="subtle-scrollbar flex gap-2 overflow-x-auto pb-1"
      >
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab.id;
          return (
            <button
              className={`pressable shrink-0 rounded-sm px-3 py-2 text-xs font-bold ${
                active
                  ? "bg-primary text-primary-on"
                  : "bg-surface-subtle text-muted hover:text-ink"
              }`}
              key={tab.id}
              onClick={() => setParam("status", tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <SearchField
          onChange={setLocalQuery}
          placeholder="بحث بالمساحة أو الاسم أو البريد..."
          value={localQuery}
        />
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="الخطة"
            className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold"
            onChange={(event) => setParam("plan", event.target.value)}
            value={planId}
          >
            <option value="">كل الخطط</option>
            {plans.map((plan) => (
              <option key={plan.planId} value={plan.planId}>
                {plan.name}
              </option>
            ))}
          </select>
          <select
            aria-label="العملة"
            className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold"
            onChange={(event) => setParam("currency", event.target.value)}
            value={currencyCode}
          >
            <option value="">كل العملات</option>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-muted">
            من
            <input
              className="min-h-11 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
              onChange={(event) => setParam("from", event.target.value)}
              type="date"
              value={from}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-muted">
            إلى
            <input
              className="min-h-11 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
              onChange={(event) => setParam("to", event.target.value)}
              type="date"
              value={to}
            />
          </label>
        </div>
      </div>

      {paymentsQuery.isError ? (
        <ErrorBlock
          message={
            paymentsQuery.error instanceof Error
              ? paymentsQuery.error.message
              : "حاول مرة أخرى"
          }
          onRetry={() => void paymentsQuery.refetch()}
        />
      ) : (
        <SupervisorDataTable
          columns={[
            {
              id: "workspace",
              header: "المساحة",
              cell: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-bold">{row.workspaceName}</p>
                  <p className="truncate text-[11px] text-muted">
                    {row.requesterName || "—"}
                  </p>
                </div>
              ),
            },
            {
              id: "plan",
              header: "الخطة",
              cell: (row) => (
                <span>
                  {row.planName} · {row.periodCount} فترة
                </span>
              ),
            },
            {
              id: "amount",
              header: "المبلغ",
              cell: (row) => (
                <span className="numeric font-bold">
                  {formatMinorCurrency(row.amountMinor, row.currencyCode)}{" "}
                  {row.currencyCode}
                </span>
              ),
            },
            {
              id: "status",
              header: "الحالة",
              cell: (row) => (
                <StatusBadge
                  label={paymentStatusLabel(row.status)}
                  tone={statusTone(
                    row.status === "approved"
                      ? "active"
                      : row.status === "rejected"
                        ? "expired"
                        : "grace",
                  )}
                />
              ),
            },
            {
              id: "created",
              header: "التاريخ",
              cell: (row) => (
                <span className="text-xs">{formatDateAr(row.createdAt)}</span>
              ),
            },
            {
              id: "actions",
              header: "مراجعة",
              cell: (row) =>
                row.status === "pending" ? (
                  <div
                    className="flex gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="pressable inline-flex min-h-9 items-center gap-1 rounded-sm bg-success-soft px-2 text-[10px] font-bold text-success disabled:opacity-50"
                      disabled={!row.proofObjectPath}
                      onClick={() => openReview(row, "approve")}
                      type="button"
                    >
                      <CheckCircle2 size={12} />
                      موافقة
                    </button>
                    <button
                      className="pressable inline-flex min-h-9 items-center gap-1 rounded-sm bg-danger-soft px-2 text-[10px] font-bold text-danger"
                      onClick={() => openReview(row, "reject")}
                      type="button"
                    >
                      <XCircle size={12} />
                      رفض
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted">
                    {row.reviewedByName || "—"}
                  </span>
                ),
            },
          ]}
          emptyTitle={
            statusTab === "pending" ? "لا طلبات معلّقة" : "لا نتائج"
          }
          emptyDescription={
            statusTab === "pending"
              ? "عندما يرفع المستخدمون إثبات دفع، ستظهر هنا للمراجعة."
              : "لا توجد طلبات مطابقة للفلاتر."
          }
          isLoading={paymentsQuery.isLoading}
          onPageChange={(nextPage) =>
            setParam("page", nextPage <= 1 ? "" : String(nextPage), false)
          }
          onRowSelect={(row) => {
            if (row.status === "pending") openReview(row, "approve");
          }}
          page={page}
          pageCount={pageCount}
          renderMobileRow={(row) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-ink">{row.workspaceName}</p>
                  <p className="text-xs text-muted">
                    {row.planName} · {row.periodCount} فترة
                  </p>
                </div>
                <StatusBadge
                  label={paymentStatusLabel(row.status)}
                  tone={statusTone(
                    row.status === "approved"
                      ? "active"
                      : row.status === "rejected"
                        ? "expired"
                        : "grace",
                  )}
                />
              </div>
              <p className="numeric text-sm font-bold">
                {formatMinorCurrency(row.amountMinor, row.currencyCode)}{" "}
                {row.currencyCode}
              </p>
              <p className="text-[11px] text-soft">
                {formatDateAr(row.createdAt)}
              </p>
              {row.status === "pending" ? (
                <div className="flex gap-2">
                  <button
                    className="pressable min-h-10 flex-1 rounded-sm bg-success-soft text-xs font-bold text-success disabled:opacity-50"
                    disabled={!row.proofObjectPath}
                    onClick={(event) => {
                      event.stopPropagation();
                      openReview(row, "approve");
                    }}
                    type="button"
                  >
                    موافقة
                  </button>
                  <button
                    className="pressable min-h-10 flex-1 rounded-sm bg-danger-soft text-xs font-bold text-danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      openReview(row, "reject");
                    }}
                    type="button"
                  >
                    رفض
                  </button>
                </div>
              ) : null}
            </div>
          )}
          rowKey={(row) => row.id}
          rows={rows}
        />
      )}

      <SupervisorActionDialog
        confirmLabel={
          reviewTarget?.decision === "approve" ? "موافقة" : "رفض الطلب"
        }
        description={
          reviewTarget
            ? `${reviewTarget.payment.workspaceName} · ${reviewTarget.payment.planName} · ${reviewTarget.payment.periodCount} فترة`
            : "مراجعة طلب الدفع"
        }
        isPending={reviewMutation.isPending}
        noteRequired={reviewTarget?.decision === "reject"}
        onConfirm={(note) => {
          if (!reviewTarget || reviewMutation.isPending) return;
          if (
            reviewTarget.decision === "approve" &&
            !reviewTarget.payment.proofObjectPath
          ) {
            toast.error("الموافقة تتطلب إثبات دفع مرفقًا");
            return;
          }
          reviewMutation.mutate({
            id: reviewTarget.payment.id,
            decision: reviewTarget.decision,
            note,
          });
        }}
        onOpenChange={(open) => {
          if (!open && !reviewMutation.isPending) setReviewTarget(null);
        }}
        open={Boolean(reviewTarget)}
        title={
          reviewTarget?.decision === "approve"
            ? "تأكيد الموافقة"
            : "تأكيد الرفض"
        }
        tone={reviewTarget?.decision === "reject" ? "danger" : "primary"}
      >
        {reviewTarget ? (
          <div className="space-y-3">
            <p className="numeric text-lg font-bold text-ink">
              {formatMinorCurrency(
                reviewTarget.payment.amountMinor,
                reviewTarget.payment.currencyCode,
              )}{" "}
              {reviewTarget.payment.currencyCode}
            </p>
            <p className="text-sm text-muted">
              {reviewTarget.payment.requesterNote ||
                "بدون ملاحظة من المستخدم"}
            </p>
            {reviewTarget.payment.proofObjectPath ? (
              proofUrls[reviewTarget.payment.id] ? (
                <a
                  className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-xs font-bold text-primary"
                  href={proofUrls[reviewTarget.payment.id]}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" size={15} />
                  فتح الإثبات
                </a>
              ) : (
                <button
                  className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-xs font-bold text-primary disabled:opacity-50"
                  disabled={proofMutation.isPending}
                  onClick={() =>
                    proofMutation.mutate({
                      id: reviewTarget.payment.id,
                      path: reviewTarget.payment.proofObjectPath!,
                    })
                  }
                  type="button"
                >
                  <Eye aria-hidden="true" size={15} />
                  عرض الإثبات
                </button>
              )
            ) : (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
                بدون إثبات — لا يمكن الموافقة
              </p>
            )}
          </div>
        ) : null}
      </SupervisorActionDialog>
    </div>
  );
}
