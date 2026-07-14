import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarClock, Scale } from "lucide-react";
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
  const money = { currency, locale: "en-US" as const };
  const totalSide =
    analytics.receivableMinor + analytics.payableMinor > 0n
      ? analytics.receivableMinor + analytics.payableMinor
      : 1n;
  const receivePct = Math.round(
    Number((analytics.receivableMinor * 100n) / totalSide),
  );

  return (
    <AppCard className="mb-0 overflow-hidden rounded-[20px] border-line shadow-[0_10px_28px_rgb(27_30_60/5%)] lg:mb-5">
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-warning-soft text-warning ring-1 ring-inset ring-warning/15">
            <Scale aria-hidden="true" size={18} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">الذمم المفتوحة</h2>
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
          className="pressable grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted transition-colors hover:bg-surface-subtle hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" size={17} />
        </Link>
      </div>

      <div className="px-5 pb-3">
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full bg-success transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ width: `${receivePct}%` }}
          />
          <div
            className="h-full bg-warning"
            style={{ width: `${100 - receivePct}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 border-t border-line">
        <div className="px-5 py-3.5">
          <dt className="flex items-center gap-1 text-[11px] text-muted">
            <ArrowDownLeft size={12} className="text-success" />
            مستحق لك
          </dt>
          <dd className="numeric mt-1 text-sm font-black text-success" dir="ltr">
            {formatMinorAmount(analytics.receivableMinor, money)}
          </dd>
        </div>
        <div className="border-s border-line px-5 py-3.5">
          <dt className="flex items-center gap-1 text-[11px] text-muted">
            <ArrowUpRight size={12} className="text-warning" />
            مستحق عليك
          </dt>
          <dd className="numeric mt-1 text-sm font-black text-warning" dir="ltr">
            {formatMinorAmount(analytics.payableMinor, money)}
          </dd>
        </div>
      </dl>

      {analytics.overdueCount > 0 ? (
        <Link
          to="/debts?filter=overdue"
          className="flex items-center gap-2 border-t border-danger/15 bg-danger-soft px-5 py-3 text-xs font-bold text-danger transition-colors hover:bg-danger/10"
        >
          <CalendarClock aria-hidden="true" size={14} />
          {analytics.overdueCount} ديون متأخرة — افتح السجل
        </Link>
      ) : (
        <p className="border-t border-line px-5 py-3 text-[11px] text-muted">
          صافي الذمم{" "}
          <bdi className="numeric font-bold text-ink" dir="ltr">
            {formatMinorAmount(analytics.netMinor, money)} {currency}
          </bdi>
        </p>
      )}
    </AppCard>
  );
}
