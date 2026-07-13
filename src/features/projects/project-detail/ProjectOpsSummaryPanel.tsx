import { ClipboardCopy } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { ProjectAnalyticsSnapshot } from "@/domain/analytics/compute-project-analytics";
import type { FinanceTransaction } from "@/domain/finance/finance-state";
import { formatMinorAmount } from "@/domain/money/money";
import type { ProjectSummary } from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import {
  buildProjectWhatsAppSummary,
  type ProjectSummaryPeriod,
} from "./project-ops-summary";

interface ProjectOpsSummaryPanelProps {
  analytics: ProjectAnalyticsSnapshot;
  currency: string;
  project: ProjectSummary;
  timeZone: string;
  transactions: readonly FinanceTransaction[];
}

function startOfPeriodIso(
  period: ProjectSummaryPeriod,
  timeZone: string,
): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const today = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (period === "week") {
    today.setUTCDate(today.getUTCDate() - 6);
  }
  return today.toISOString();
}

export function ProjectOpsSummaryPanel({
  analytics,
  currency,
  project,
  timeZone,
  transactions,
}: ProjectOpsSummaryPanelProps) {
  const [period, setPeriod] = useState<ProjectSummaryPeriod>("day");
  const fromIso = useMemo(
    () => startOfPeriodIso(period, timeZone),
    [period, timeZone],
  );
  const totals = useMemo(() => {
    let incomeMinor = 0n;
    let expenseMinor = 0n;
    for (const transaction of transactions) {
      if (transaction.kind === "transfer") continue;
      if (transaction.projectId !== project.id) continue;
      if (transaction.occurredAt < fromIso) continue;
      if (transaction.kind === "income") incomeMinor += transaction.amountMinor;
      if (transaction.kind === "expense") {
        expenseMinor += transaction.amountMinor;
      }
    }
    return { incomeMinor, expenseMinor };
  }, [fromIso, project.id, transactions]);

  const text = buildProjectWhatsAppSummary({
    analytics,
    currency,
    period,
    project,
    periodIncomeMinor: totals.incomeMinor,
    periodExpenseMinor: totals.expenseMinor,
  });

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم نسخ الملخص للواتساب");
    } catch {
      toast.error("تعذر نسخ الملخص");
    }
  };

  const formatMoney = (value: bigint) =>
    formatMinorAmount(value, { currency, locale: "en-US" });

  return (
    <AppCard className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">ملخص يوم/أسبوع</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            نص عربي جاهز للنسخ ومشاركته عبر واتساب.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ["day", "اليوم"],
              ["week", "الأسبوع"],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={period === value}
              className={`pressable min-h-10 rounded-sm border px-3 text-xs font-bold ${
                period === value
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-line text-muted"
              }`}
              key={value}
              onClick={() => setPeriod(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-sm bg-surface-subtle p-3">
          <dt className="text-muted">دخل</dt>
          <dd className="numeric mt-1 font-bold text-success" dir="ltr">
            {formatMoney(totals.incomeMinor)}
          </dd>
        </div>
        <div className="rounded-sm bg-surface-subtle p-3">
          <dt className="text-muted">مصروف</dt>
          <dd className="numeric mt-1 font-bold text-danger" dir="ltr">
            {formatMoney(totals.expenseMinor)}
          </dd>
        </div>
        <div className="rounded-sm bg-surface-subtle p-3">
          <dt className="text-muted">صافي</dt>
          <dd className="numeric mt-1 font-bold text-ink" dir="ltr">
            {formatMoney(totals.incomeMinor - totals.expenseMinor)}
          </dd>
        </div>
      </dl>

      <pre className="mt-4 overflow-x-auto rounded-sm border border-line bg-canvas p-3 text-xs leading-6 whitespace-pre-wrap text-ink">
        {text}
      </pre>

      <button
        className="pressable mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-primary text-sm font-bold text-primary-on"
        onClick={() => void copySummary()}
        type="button"
      >
        <ClipboardCopy aria-hidden="true" size={16} />
        نسخ ملخص واتساب
      </button>
    </AppCard>
  );
}
