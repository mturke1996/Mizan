import { ArrowLeft, CalendarClock, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { computeDebtAnalytics } from "@/domain/debts/compute-debt-analytics";
import { formatMinorAmount } from "@/domain/money/money";
import type { DebtSummary as DebtSummaryModel } from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";

export function DebtSummary({
  currency,
  debts,
  now,
  timeZone,
}: {
  currency: string;
  debts: DebtSummaryModel[];
  now: Date;
  timeZone: string;
}) {
  const analytics = computeDebtAnalytics({
    debts: debts.filter((debt) => debt.currencyCode === currency),
    now,
    timeZone,
  });

  return (
    <AppCard className="mb-5 overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-primary-soft text-primary">
            <Scale aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">الديون المفتوحة</h2>
            <p className="mt-1 text-xs text-muted">
              {analytics.openCount > 0
                ? `${analytics.openCount} أرصدة تحتاج متابعة`
                : "لا توجد أرصدة معلقة"}
            </p>
          </div>
        </div>
        <Link
          to="/debts"
          aria-label="عرض كل الديون"
          className="pressable grid size-10 shrink-0 place-items-center rounded-sm border border-line text-muted hover:bg-surface-subtle hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" size={17} />
        </Link>
      </div>

      <dl className="grid grid-cols-2 border-t border-line">
        <div className="px-5 py-3">
          <dt className="text-xs text-muted">مستحق لك</dt>
          <dd className="numeric mt-1 text-sm font-bold text-success" dir="ltr">
            {formatMinorAmount(analytics.receivableMinor, {
              currency,
              locale: "en-US",
            })}
          </dd>
        </div>
        <div className="border-s border-line px-5 py-3">
          <dt className="text-xs text-muted">مستحق عليك</dt>
          <dd className="numeric mt-1 text-sm font-bold text-warning" dir="ltr">
            {formatMinorAmount(analytics.payableMinor, {
              currency,
              locale: "en-US",
            })}
          </dd>
        </div>
      </dl>

      {analytics.overdueCount > 0 ? (
        <p className="flex items-center gap-2 border-t border-line bg-danger-soft px-5 py-3 text-xs font-semibold text-danger">
          <CalendarClock aria-hidden="true" size={14} />
          {analytics.overdueCount} ديون متأخرة
        </p>
      ) : null}
    </AppCard>
  );
}
