import { ChartNoAxesCombined, WalletCards } from "lucide-react";
import { formatMinorAmount } from "@/domain/money/money";

interface BalanceOverviewProps {
  balanceMinor: bigint;
  currency: string;
  walletCount: number;
  monthlyTrend: Array<{ month: string; income: number; expense: number }>;
}

function getPolylinePoints(
  trend: BalanceOverviewProps["monthlyTrend"],
): string | null {
  const values = trend.map((item) => item.income - item.expense);
  if (values.length < 2 || values.every((value) => value === 0)) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 136 + 2;
      const y = 42 - ((value - min) / range) * 34;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function BalanceOverview({
  balanceMinor,
  currency,
  walletCount,
  monthlyTrend,
}: BalanceOverviewProps) {
  const points = getPolylinePoints(monthlyTrend);

  return (
    <section
      aria-labelledby="mobile-balance-title"
      className="mb-5 border-b border-line pb-5 lg:hidden"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p
            id="mobile-balance-title"
            className="flex items-center gap-2 text-xs font-medium text-muted"
          >
            <WalletCards
              aria-hidden="true"
              size={16}
              className="text-primary"
            />
            إجمالي الرصيد
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-1.5">
            <strong className="numeric text-[29px] leading-none font-bold tracking-[-0.04em] text-ink">
              {formatMinorAmount(balanceMinor, {
                currency,
                locale: "en-US",
              })}
            </strong>
            <span className="text-[10px] font-bold text-muted">{currency}</span>
          </p>
          <p className="mt-2 text-[11px] text-muted">
            موزّع على {walletCount} {walletCount === 1 ? "محفظة" : "محافظ"}
          </p>
        </div>

        <div className="w-36 shrink-0 text-primary">
          {points ? (
            <svg
              viewBox="0 0 140 48"
              className="h-14 w-full overflow-visible"
              role="img"
              aria-label="اتجاه صافي التدفق خلال الأشهر الأخيرة"
            >
              <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="0"
                y1="46"
                x2="140"
                y2="46"
                stroke="var(--mizan-border)"
                strokeWidth="1"
              />
            </svg>
          ) : (
            <div className="flex h-14 items-center justify-center rounded-[10px] bg-primary-soft">
              <ChartNoAxesCombined aria-hidden="true" size={22} />
            </div>
          )}
          <p className="mt-1 text-center text-[9px] text-muted">
            صافي التدفق الشهري
          </p>
        </div>
      </div>
    </section>
  );
}
