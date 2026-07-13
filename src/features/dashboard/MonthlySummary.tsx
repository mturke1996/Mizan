import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatMinorAmount } from "@/domain/money/money";
import { AppCard } from "@/shared/ui/AppCard";

export function MonthlySummary({
  incomeMinor,
  expenseMinor,
  currency = "LYD",
}: {
  incomeMinor: bigint;
  expenseMinor: bigint;
  currency?: string;
}) {
  return (
    <section aria-label="ملخص الشهر" className="mb-6 grid grid-cols-2 gap-3">
      <AppCard className="p-4">
        <div className="mb-4 flex size-9 items-center justify-center rounded-sm bg-success-soft text-success">
          <ArrowDownLeft aria-hidden="true" size={18} strokeWidth={1.8} />
        </div>
        <p className="text-xs text-muted">دخل هذا الشهر</p>
        <p className="mt-1 flex items-baseline gap-1">
          <strong className="numeric text-xl font-bold text-ink">
            {formatMinorAmount(incomeMinor, {
              currency,
              locale: "en-US",
            })}
          </strong>
          <span className="text-[10px] font-semibold text-muted">
            {currency}
          </span>
        </p>
      </AppCard>
      <AppCard className="p-4">
        <div className="mb-4 flex size-9 items-center justify-center rounded-sm bg-danger-soft text-danger">
          <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.8} />
        </div>
        <p className="text-xs text-muted">مصروف هذا الشهر</p>
        <p className="mt-1 flex items-baseline gap-1">
          <strong className="numeric text-xl font-bold text-ink">
            {formatMinorAmount(expenseMinor, {
              currency,
              locale: "en-US",
            })}
          </strong>
          <span className="text-[10px] font-semibold text-muted">
            {currency}
          </span>
        </p>
      </AppCard>
    </section>
  );
}
