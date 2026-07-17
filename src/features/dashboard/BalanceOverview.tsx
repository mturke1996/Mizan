import { ArrowDownLeft, ArrowUpRight, HandCoins } from "lucide-react";
import { formatMinorAmount } from "@/domain/money/money";

interface BalanceOverviewProps {
  balanceMinor: bigint;
  currency: string;
  walletCount: number;
  monthlyTrend: Array<{ month: string; income: number; expense: number }>;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
}

function getSparkline(
  trend: BalanceOverviewProps["monthlyTrend"],
): { line: string; area: string } | null {
  const values = trend.map((item) => item.income - item.expense);
  if (values.length < 2 || values.every((value) => value === 0)) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 160;
  const height = 56;
  const padY = 6;

  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - padY - ((value - min) / range) * (height - padY * 2);
    return { x, y };
  });

  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = [
    `0,${height}`,
    ...coords.map((point) => `${point.x},${point.y}`),
    `${width},${height}`,
  ].join(" ");

  return { line, area };
}

export function BalanceOverview({
  balanceMinor,
  currency,
  walletCount,
  monthlyTrend,
  incomeMinor,
  expenseMinor,
  netMinor,
}: BalanceOverviewProps) {
  const spark = getSparkline(monthlyTrend);
  const netPositive = netMinor >= 0n;

  return (
    <section
      aria-labelledby="mobile-balance-title"
      className="relative mb-4 overflow-hidden rounded-[22px] text-primary-on md:hidden"
      style={{
        background:
          "linear-gradient(145deg, var(--mizan-auth-panel) 0%, var(--mizan-primary) 52%, #5f67d8 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -left-10 size-44 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 bottom-0 size-36 rounded-full bg-black/10 blur-2xl"
      />

      <div className="relative p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              id="mobile-balance-title"
              className="text-[11px] font-semibold tracking-[0.04em] text-white/70"
            >
              إجمالي الرصيد
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <strong
                className="numeric text-[34px] leading-none font-bold tracking-[-0.045em] text-white"
                dir="ltr"
              >
                {formatMinorAmount(balanceMinor, {
                  currency,
                  locale: "en-US",
                })}
              </strong>
              <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-bold text-white/85">
                {currency}
              </span>
            </p>
            <p className="mt-2.5 text-[11px] text-white/65">
              موزّع على {walletCount}{" "}
              {walletCount === 1 ? "محفظة نشطة" : "محافظ نشطة"}
            </p>
          </div>

          <div className="w-[7.5rem] shrink-0 pt-1">
            {spark ? (
              <svg
                viewBox="0 0 160 56"
                className="h-14 w-full overflow-visible"
                role="img"
                aria-label="اتجاه صافي التدفق خلال الأشهر الأخيرة"
              >
                <defs>
                  <linearGradient id="balance-spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={spark.area} fill="url(#balance-spark-fill)" />
                <polyline
                  points={spark.line}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <div className="grid h-14 place-items-center rounded-2xl bg-white/10 text-[10px] font-semibold text-white/70">
                بلا اتجاه بعد
              </div>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-black/15 px-2.5 py-2.5 backdrop-blur-[2px]">
            <dt className="flex items-center gap-1 text-[10px] text-white/65">
              <ArrowDownLeft aria-hidden="true" size={12} />
              الدخل
            </dt>
            <dd
              className="numeric mt-1 truncate text-[12px] font-bold text-white"
              dir="ltr"
            >
              {formatMinorAmount(incomeMinor, {
                currency,
                locale: "en-US",
              })}
            </dd>
          </div>
          <div className="rounded-2xl bg-black/15 px-2.5 py-2.5 backdrop-blur-[2px]">
            <dt className="flex items-center gap-1 text-[10px] text-white/65">
              <ArrowUpRight aria-hidden="true" size={12} />
              المصروف
            </dt>
            <dd
              className="numeric mt-1 truncate text-[12px] font-bold text-white"
              dir="ltr"
            >
              {formatMinorAmount(expenseMinor, {
                currency,
                locale: "en-US",
              })}
            </dd>
          </div>
          <div className="rounded-2xl bg-black/15 px-2.5 py-2.5 backdrop-blur-[2px]">
            <dt className="flex items-center gap-1 text-[10px] text-white/65">
              <HandCoins aria-hidden="true" size={12} />
              الصافي
            </dt>
            <dd
              className={`numeric mt-1 truncate text-[12px] font-bold ${
                netPositive ? "text-[#b8f5df]" : "text-[#ffc4cb]"
              }`}
              dir="ltr"
            >
              {formatMinorAmount(netMinor, {
                currency,
                locale: "en-US",
              })}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
