import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  Package,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AppCard } from "@/shared/ui/AppCard";
import {
  fetchActionQueue,
  fetchAuditEvents,
  fetchOperationalMetrics,
  fetchPlanMix,
  fetchRevenueSeries,
  formatRateMetric,
  groupRevenueByCurrency,
  intelligenceKeys,
  type ActionQueueItem,
} from "./supervisor-intelligence-api";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  StatusBadge,
} from "./SupervisorUi";
import {
  formatDateAr,
  formatMinorCurrency,
} from "./supervisor-utils";

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 90);
  return { from: from.toISOString(), to: to.toISOString() };
}

function severityTone(severity: ActionQueueItem["severity"]): string {
  if (severity === "critical") return "bg-danger-soft text-danger";
  if (severity === "warning") return "bg-warning-soft text-warning";
  return "bg-info-soft text-info";
}

function severityLabel(severity: ActionQueueItem["severity"]): string {
  if (severity === "critical") return "حرج";
  if (severity === "warning") return "تحذير";
  return "معلومة";
}

export function SupervisorOperationsPage() {
  const range = useMemo(() => defaultRange(), []);

  const metricsQuery = useQuery({
    queryKey: intelligenceKeys.operations(range.from, range.to),
    queryFn: () => fetchOperationalMetrics(range.from, range.to),
  });
  const queueQuery = useQuery({
    queryKey: intelligenceKeys.actionQueue,
    queryFn: () => fetchActionQueue(50),
  });
  const revenueQuery = useQuery({
    queryKey: intelligenceKeys.revenue(range.from, range.to, "month"),
    queryFn: () =>
      fetchRevenueSeries({
        from: range.from,
        to: range.to,
        bucket: "month",
      }),
  });
  const planMixQuery = useQuery({
    queryKey: intelligenceKeys.planMix,
    queryFn: fetchPlanMix,
  });
  const decisionsQuery = useQuery({
    queryKey: intelligenceKeys.audit({ limit: 8, offset: 0 }),
    queryFn: () =>
      fetchAuditEvents({
        limit: 8,
        offset: 0,
      }),
  });

  const metrics = metricsQuery.data;
  const revenueByCurrency = groupRevenueByCurrency(revenueQuery.data ?? []);

  const loading =
    metricsQuery.isLoading ||
    queueQuery.isLoading ||
    revenueQuery.isLoading ||
    planMixQuery.isLoading;

  if (
    metricsQuery.isError ||
    queueQuery.isError ||
    revenueQuery.isError ||
    planMixQuery.isError
  ) {
    return (
      <div className="py-6">
        <ErrorBlock
          message="تعذر تحميل مركز العمليات"
          onRetry={() => {
            void metricsQuery.refetch();
            void queueQuery.refetch();
            void revenueQuery.refetch();
            void planMixQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (loading || !metrics) {
    return (
      <div className="py-6">
        <LoadingBlock rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6">
      <div className="lg:hidden">
        <h1 className="text-xl font-bold text-ink">مركز العمليات</h1>
        <p className="mt-1 text-sm text-muted">
          طابور القرارات ومؤشرات التشغيل الحقيقية
        </p>
      </div>

      <section aria-labelledby="action-queue-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2
              className="text-base font-bold text-ink"
              id="action-queue-heading"
            >
              طابور القرارات
            </h2>
            <p className="mt-1 text-xs text-muted">
              العناصر مرتبة حسب الأولوية التشغيلية
            </p>
          </div>
        </div>
        {(queueQuery.data?.length ?? 0) === 0 ? (
          <EmptyBlock
            description="لا توجد عناصر تتطلب تدخلاً الآن."
            title="الطابور فارغ"
          />
        ) : (
          <ul className="space-y-2">
            {(queueQuery.data ?? []).map((item) => (
              <li key={item.id}>
                <Link
                  className="pressable flex items-start justify-between gap-3 rounded-[12px] border border-line bg-surface p-4 transition-colors hover:bg-surface-subtle"
                  to={item.href}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={severityLabel(item.severity)}
                        tone={severityTone(item.severity)}
                      />
                      <p className="truncate text-sm font-bold text-ink">
                        {item.title}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {item.customerName || "عميل"} · {item.description}
                    </p>
                    {item.dueAt ? (
                      <p className="mt-1 text-[11px] text-soft">
                        الاستحقاق: {formatDateAr(item.dueAt)}
                      </p>
                    ) : null}
                  </div>
                  <ArrowLeft
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-muted"
                    size={16}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="customer-payment-metrics"
        className="grid gap-4 lg:grid-cols-[1.2fr_1fr]"
      >
        <AppCard className="p-5" elevated>
          <div className="mb-4 flex items-center gap-2">
            <Users aria-hidden="true" className="text-primary" size={18} />
            <h2 className="text-sm font-bold text-ink" id="customer-payment-metrics">
              مؤشرات العملاء
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["الإجمالي", metrics.customers.total],
              ["نشط", metrics.customers.active],
              ["تجريبي", metrics.customers.trialing],
              ["مهلة", metrics.customers.grace],
              ["مجمّد", metrics.customers.frozen],
              ["ينتهي خلال 7 أيام", metrics.customers.expiring7d],
            ].map(([label, value]) => (
              <div
                className="rounded-[10px] bg-surface-subtle px-3 py-3"
                key={String(label)}
              >
                <dt className="text-[11px] text-muted">{label}</dt>
                <dd className="numeric mt-1 text-xl font-bold text-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </AppCard>

        <AppCard className="border-warning/20 bg-warning-soft/30 p-5">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard aria-hidden="true" className="text-warning" size={18} />
            <h2 className="text-sm font-bold text-ink">مؤشرات المدفوعات</h2>
          </div>
          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted">معلّقة</dt>
              <dd className="numeric font-bold text-ink">
                {metrics.payments.pending}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted">موافق عليها</dt>
              <dd className="numeric font-bold text-ink">
                {metrics.payments.approved}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted">مرفوضة</dt>
              <dd className="numeric font-bold text-ink">
                {metrics.payments.rejected}
              </dd>
            </div>
            <div className="rounded-[10px] bg-surface/80 px-3 py-3">
              <p className="text-[11px] text-muted">متوسط زمن المراجعة</p>
              <p className="numeric mt-1 text-lg font-bold text-ink">
                {metrics.payments.averageReviewMinutes == null
                  ? "بيانات غير كافية"
                  : `${new Intl.NumberFormat("ar-LY-u-nu-latn", {
                      maximumFractionDigits: 1,
                    }).format(metrics.payments.averageReviewMinutes)} دقيقة`}
              </p>
            </div>
          </dl>
        </AppCard>
      </section>

      <section aria-labelledby="revenue-by-currency" className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink" id="revenue-by-currency">
              مدفوعات معتمدة حسب العملة
            </h2>
            <p className="mt-1 text-xs text-muted">
              لا يتم جمع LYD مع USD — المصدر هو قرارات المراجعة اليدوية
            </p>
          </div>
          <Link
            className="pressable text-xs font-bold text-primary hover:underline"
            to="/supervisor/revenue"
          >
            التفاصيل
          </Link>
        </div>
        {revenueByCurrency.size === 0 ? (
          <EmptyBlock
            description="لا مدفوعات معتمدة في النطاق الحالي."
            title="لا بيانات إيراد"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {[...revenueByCurrency.entries()].map(([currency, points]) => {
              const totalMinor = points.reduce(
                (sum, point) => sum + point.approvedAmountMinor,
                0,
              );
              const totalCount = points.reduce(
                (sum, point) => sum + point.approvedCount,
                0,
              );
              return (
                <AppCard className="p-4" key={currency}>
                  <p className="text-xs font-bold text-muted">{currency}</p>
                  <p className="numeric mt-2 text-2xl font-bold text-ink">
                    {formatMinorCurrency(totalMinor, currency)}
                  </p>
                  <p className="mt-1 text-[11px] text-soft">
                    {totalCount} دفعة معتمدة
                  </p>
                </AppCard>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AppCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="text-success" size={18} />
            <h2 className="text-sm font-bold text-ink">معدل الموافقة</h2>
          </div>
          <p className="numeric text-3xl font-bold text-ink">
            {formatRateMetric(metrics.payments.approvalRate)}
          </p>
          <p className="mt-2 text-xs text-muted">
            حجم العينة: {metrics.payments.approvalRate.sampleSize}
          </p>
        </AppCard>
        <AppCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 aria-hidden="true" className="text-primary" size={18} />
            <h2 className="text-sm font-bold text-ink">تحويل التجارب</h2>
          </div>
          <p className="numeric text-3xl font-bold text-ink">
            {formatRateMetric(metrics.trials)}
          </p>
          <p className="mt-2 text-xs text-muted">
            حجم العينة: {metrics.trials.sampleSize}
          </p>
        </AppCard>
      </section>

      <section aria-labelledby="plan-mix-heading">
        <div className="mb-3 flex items-center gap-2">
          <Package aria-hidden="true" className="text-primary" size={18} />
          <h2 className="text-base font-bold text-ink" id="plan-mix-heading">
            توزيع الخطط
          </h2>
        </div>
        {(planMixQuery.data?.length ?? 0) === 0 ? (
          <EmptyBlock description="لا خطط معرّفة." title="لا توزيع" />
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-line bg-surface">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-subtle text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">الخطة</th>
                  <th className="px-4 py-3 text-start font-bold">نشط</th>
                  <th className="px-4 py-3 text-start font-bold">تجريبي</th>
                  <th className="px-4 py-3 text-start font-bold">مجمّد</th>
                </tr>
              </thead>
              <tbody>
                {(planMixQuery.data ?? []).map((plan) => (
                  <tr className="border-t border-line" key={plan.planId}>
                    <td className="px-4 py-3 font-semibold text-ink">
                      {plan.planName}
                    </td>
                    <td className="numeric px-4 py-3">{plan.activeSubscriptions}</td>
                    <td className="numeric px-4 py-3">
                      {plan.trialingSubscriptions}
                    </td>
                    <td className="numeric px-4 py-3">
                      {plan.frozenSubscriptions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="recent-decisions">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="text-warning" size={18} />
            <h2 className="text-base font-bold text-ink" id="recent-decisions">
              آخر القرارات
            </h2>
          </div>
          <Link
            className="pressable text-xs font-bold text-primary hover:underline"
            to="/supervisor/audit"
          >
            سجل التدقيق
          </Link>
        </div>
        {decisionsQuery.isLoading ? (
          <LoadingBlock rows={2} />
        ) : (decisionsQuery.data?.rows.length ?? 0) === 0 ? (
          <EmptyBlock
            description="لا قرارات مسجّلة بعد."
            title="لا سجل حديث"
          />
        ) : (
          <ul className="space-y-2">
            {(decisionsQuery.data?.rows ?? []).map((event) => (
              <li
                className="rounded-[12px] border border-line bg-surface px-4 py-3"
                key={event.id}
              >
                <p className="text-sm font-bold text-ink">{event.action}</p>
                <p className="mt-1 text-xs text-muted">
                  {event.actorName || "منفّذ"}
                  {event.customerName ? ` · ${event.customerName}` : ""}
                  {" · "}
                  {formatDateAr(event.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
