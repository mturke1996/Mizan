import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  computeCashFlowMonths,
  computeInvoiceAging,
  computePeriodPnL,
  computeProjectProfitRows,
} from "@/domain/analytics/compute-reports";
import { formatMinorAmount } from "@/domain/money/money";
import { useAuth } from "@/features/auth/use-auth";
import {
  useAllTransactionsQuery,
  useCategoriesQuery,
  useInvoicesQuery,
} from "@/features/workspace/use-finance-data";
import { useProjectsView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { buildCsv, downloadCsv } from "@/lib/csv-export";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";

type PeriodKey = "month" | "quarter" | "year";

const PERIODS: ReadonlyArray<{ value: PeriodKey; label: string }> = [
  { value: "month", label: "هذا الشهر" },
  { value: "quarter", label: "آخر 3 أشهر" },
  { value: "year", label: "هذه السنة" },
];

function periodRange(key: PeriodKey, now = new Date()): { from: Date; to: Date } {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  if (key === "month") {
    from.setDate(1);
  } else if (key === "quarter") {
    from.setMonth(from.getMonth() - 2, 1);
  } else {
    from.setMonth(0, 1);
  }

  return { from, to };
}

export function ReportsPage() {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const { profile } = useAuth();
  const { currency } = useWorkspace();
  const allTransactions = useAllTransactionsQuery();
  const invoicesQuery = useInvoicesQuery();
  const categoriesQuery = useCategoriesQuery();
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjectsView();

  const money = { currency, locale: "en-US" as const };
  const timeZone = profile?.timezone ?? "Africa/Tripoli";

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categoriesQuery.data]);

  const { from, to } = useMemo(() => periodRange(period), [period]);

  const pnl = useMemo(
    () =>
      computePeriodPnL({
        transactions: allTransactions.transactions,
        currency,
        from,
        to,
        categoryNames,
      }),
    [allTransactions.transactions, currency, from, to, categoryNames],
  );

  const cashFlow = useMemo(
    () =>
      computeCashFlowMonths({
        transactions: allTransactions.transactions,
        currency,
        timeZone,
        months: period === "year" ? 12 : period === "quarter" ? 3 : 6,
      }),
    [allTransactions.transactions, currency, timeZone, period],
  );

  const aging = useMemo(
    () =>
      computeInvoiceAging({
        invoices: invoicesQuery.data ?? [],
        currency,
      }),
    [invoicesQuery.data, currency],
  );

  const projectRows = useMemo(
    () => computeProjectProfitRows({ projects }),
    [projects],
  );

  const isLoading =
    allTransactions.isLoading ||
    invoicesQuery.isLoading ||
    categoriesQuery.isLoading ||
    projectsLoading;

  const loadError =
    allTransactions.error ??
    invoicesQuery.error ??
    categoriesQuery.error ??
    (projectsError ? new Error(projectsError) : null);

  function handleExportPnL() {
    const csv = buildCsv(
      ["التصنيف", "دخل", "مصروف", "صافي"],
      [
        [
          "الإجمالي",
          pnl.incomeMinor.toString(),
          pnl.expenseMinor.toString(),
          pnl.netMinor.toString(),
        ],
        ...pnl.byCategory.map((row) => [
          row.name,
          row.incomeMinor.toString(),
          row.expenseMinor.toString(),
          (row.incomeMinor - row.expenseMinor).toString(),
        ]),
      ],
    );
    downloadCsv(`mizan-pnl-${period}.csv`, csv);
    toast.success("تم تنزيل تقرير الأرباح والخسائر");
  }

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="التقارير" backTo="/analytics" />
        <AppCard
          role="status"
          className="h-40 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="التقارير" backTo="/analytics" />
        <ErrorState
          message={getUserErrorMessage(loadError, "تعذر تحميل التقارير")}
          onRetry={() => {
            allTransactions.refetch();
            void invoicesQuery.refetch();
            void categoriesQuery.refetch();
            void refreshProjects();
          }}
        />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pb-6" dir="rtl">
      <PageHeader
        title="التقارير"
        subtitle="أرباح وخسائر، تدفق نقدي، أعمار فواتير، وربحية المشاريع"
        backTo="/analytics"
        action={
          <button
            type="button"
            onClick={handleExportPnL}
            className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-on"
          >
            <Download size={14} />
            تصدير P&L
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setPeriod(item.value)}
            className={[
              "pressable min-h-10 rounded-xl px-3 text-xs font-bold",
              period === item.value
                ? "bg-primary text-primary-on"
                : "bg-surface-subtle text-muted",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="mb-5">
        <h2 className="mb-3 text-sm font-bold text-ink">ملخص الأرباح والخسائر</h2>
        <div className="mb-3 grid grid-cols-3 gap-3">
          <StatTile
            label="الدخل"
            value={formatMinorAmount(pnl.incomeMinor, money)}
            tone="success"
          />
          <StatTile
            label="المصروف"
            value={formatMinorAmount(pnl.expenseMinor, money)}
            tone="danger"
          />
          <StatTile
            label="الصافي"
            value={formatMinorAmount(pnl.netMinor, money)}
            tone={pnl.netMinor >= 0n ? "success" : "danger"}
          />
        </div>
        {pnl.byCategory.length === 0 ? (
          <AppCard className="px-4 py-8 text-center text-sm text-muted">
            لا توجد حركات في هذه الفترة
          </AppCard>
        ) : (
          <div className="overflow-x-auto rounded-[18px] border border-line bg-surface">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] text-muted">
                  <th className="px-4 py-3 text-start font-bold">التصنيف</th>
                  <th className="px-4 py-3 text-start font-bold">دخل</th>
                  <th className="px-4 py-3 text-start font-bold">مصروف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pnl.byCategory.map((row) => (
                  <tr key={row.categoryId ?? "none"}>
                    <td className="px-4 py-3 font-semibold text-ink">
                      {row.name}
                    </td>
                    <td className="numeric px-4 py-3 text-success" dir="ltr">
                      {formatMinorAmount(row.incomeMinor, money)}
                    </td>
                    <td className="numeric px-4 py-3 text-danger" dir="ltr">
                      {formatMinorAmount(row.expenseMinor, money)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-sm font-bold text-ink">التدفق النقدي الشهري</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
          {cashFlow.map((month) => (
            <li
              key={month.monthKey}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <span className="text-sm font-semibold text-ink" dir="ltr">
                {month.monthKey}
              </span>
              <div className="flex flex-wrap gap-3 text-[11px]">
                <span className="numeric text-success" dir="ltr">
                  +{formatMinorAmount(month.incomeMinor, money)}
                </span>
                <span className="numeric text-danger" dir="ltr">
                  −{formatMinorAmount(month.expenseMinor, money)}
                </span>
                <span
                  className={`numeric font-bold ${
                    month.netMinor >= 0n ? "text-success" : "text-danger"
                  }`}
                  dir="ltr"
                >
                  {formatMinorAmount(month.netMinor, money)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-sm font-bold text-ink">أعمار الفواتير</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {aging.map((bucket) => (
            <AppCard key={bucket.label} className="rounded-[18px] p-4">
              <p className="text-[11px] font-medium text-muted">{bucket.label}</p>
              <p className="numeric mt-1.5 text-base font-bold text-ink" dir="ltr">
                {formatMinorAmount(bucket.amountMinor, money)}
              </p>
              <p className="mt-1 text-[11px] text-muted">{bucket.count} فاتورة</p>
            </AppCard>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-ink">ربحية المشاريع</h2>
        {projectRows.length === 0 ? (
          <AppCard className="px-4 py-8 text-center text-sm text-muted">
            لا توجد مشاريع نشطة
          </AppCard>
        ) : (
          <div className="overflow-x-auto rounded-[18px] border border-line bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] text-muted">
                  <th className="px-4 py-3 text-start font-bold">المشروع</th>
                  <th className="px-4 py-3 text-start font-bold">دخل</th>
                  <th className="px-4 py-3 text-start font-bold">مصروف</th>
                  <th className="px-4 py-3 text-start font-bold">الربح</th>
                  <th className="px-4 py-3 text-start font-bold">عمالة معلّقة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {projectRows.map((row) => (
                  <tr key={row.projectId}>
                    <td className="px-4 py-3 font-semibold text-ink">
                      {row.name}
                    </td>
                    <td className="numeric px-4 py-3 text-success" dir="ltr">
                      {formatMinorAmount(row.incomeMinor, money)}
                    </td>
                    <td className="numeric px-4 py-3 text-danger" dir="ltr">
                      {formatMinorAmount(row.expenseMinor, money)}
                    </td>
                    <td
                      className={`numeric px-4 py-3 font-bold ${
                        row.profitMinor >= 0n ? "text-success" : "text-danger"
                      }`}
                      dir="ltr"
                    >
                      {formatMinorAmount(row.profitMinor, money)}
                    </td>
                    <td className="numeric px-4 py-3 text-muted" dir="ltr">
                      {formatMinorAmount(row.outstandingLaborMinor, money)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "danger";
}) {
  return (
    <AppCard className="rounded-[18px] p-4">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p
        className={`numeric mt-1.5 text-sm font-bold ${
          tone === "success" ? "text-success" : "text-danger"
        }`}
        dir="ltr"
      >
        {value}
      </p>
    </AppCard>
  );
}
