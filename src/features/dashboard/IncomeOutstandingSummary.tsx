import { ArrowLeft, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { formatMinorAmount } from "@/domain/money/money";
import {
  useIncomeSourceBalancesQuery,
  useIncomeSourcesQuery,
} from "@/features/workspace/use-finance-data";
import { AppCard } from "@/shared/ui/AppCard";

export function IncomeOutstandingSummary({ currency }: { currency: string }) {
  const sourcesQuery = useIncomeSourcesQuery();
  const balancesQuery = useIncomeSourceBalancesQuery();

  const sources = sourcesQuery.data ?? [];
  const balances = balancesQuery.data ?? [];
  const totalOutstanding = balances.reduce((sum, b) => sum + b.balanceMinor, 0n);
  const activeCount = sources.length;
  const money = { currency, locale: "en-US" as const };

  if (sourcesQuery.isLoading || balancesQuery.isLoading) {
    return (
      <AppCard
        role="status"
        className="mb-0 h-28 animate-pulse bg-surface-subtle lg:mb-5"
      />
    );
  }

  if (activeCount === 0) {
    return (
      <AppCard className="mb-0 overflow-hidden rounded-[18px] shadow-[0_8px_24px_rgb(27_30_60/4%)] lg:mb-5">
        <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Briefcase aria-hidden="true" size={18} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">مستحقاتي</h2>
              <p className="mt-1 text-xs text-muted">
                أضف مصدر دخل لتتبع اليوميات والراتب
              </p>
            </div>
          </div>
          <Link
            to="/income"
            aria-label="فتح دخلي"
            className="pressable grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-surface-subtle hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" size={17} />
          </Link>
        </div>
      </AppCard>
    );
  }

  return (
    <AppCard className="mb-0 overflow-hidden rounded-[18px] shadow-[0_8px_24px_rgb(27_30_60/4%)] lg:mb-5">
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Briefcase aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">مستحقاتي</h2>
            <p className="mt-1 text-xs text-muted">
              {activeCount} مصدر دخل نشط
            </p>
          </div>
        </div>
        <Link
          to="/income"
          aria-label="عرض كل المستحقات"
          className="pressable grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-surface-subtle hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" size={17} />
        </Link>
      </div>

      <div className="border-t border-line px-5 py-3">
        <p className="text-xs text-muted">إجمالي المستحق</p>
        <p
          className={[
            "numeric mt-1 text-lg font-black",
            totalOutstanding > 0n ? "text-success" : "text-ink",
          ].join(" ")}
          dir="ltr"
        >
          {formatMinorAmount(totalOutstanding, money)}
          <span className="ms-1 text-xs font-bold text-muted">{currency}</span>
        </p>
      </div>
    </AppCard>
  );
}
