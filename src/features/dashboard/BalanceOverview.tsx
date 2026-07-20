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
      className="relative mb-4 overflow-hidden rounded-[22px] text-primary-on shadow-[0_10px_28px_rgb(67_56_202/18%)] md:hidden"
      style={{
        background:
          "linear-gradient(145deg, var(--mizan-auth-panel) 0%, var(--mizan-primary) 52%, #5f67d8 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -left-8 size-36 rounded-full bg-white/10 blur-2xl"
      />

      <div className="relative px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              id="mobile-balance-title"
              className="text-[10px] font-semibold tracking-[0.04em] text-white/70"
            >
              إجمالي الرصيد · {walletCount}{" "}
              {walletCount === 1 ? "محفظة" : "محافظ"}
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <strong
                className="numeric text-[30px] leading-none font-bold tracking-[-0.04em] text-white"
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
          </div>

          <div className="w-24 shrink-0 pt-0.5">
            {spark ? (
              <svg
                viewBox="0 0 160 56"
                className="h-10 w-full overflow-visible"
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
            ) : null}
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-1.5">
          <div className="rounded-xl bg-black/15 px-2 py-2">
            <dt className="flex items-center gap-1 text-[10px] text-white/65">
              <ArrowDownLeft aria-hidden="true" size={11} />
              الدخل
            </dt>
            <dd
              className="numeric mt-0.5 truncate text-[11px] font-bold text-white"
              dir="ltr"
            >
              {formatMinorAmount(incomeMinor, {
                currency,
                locale: "en-US",
              })}
            </dd>
          </div>
          <div className="rounded-xl bg-black/15 px-2 py-2">
            <dt className="flex items-center gap-1 text-[10px] text-white/65">
              <ArrowUpRight aria-hidden="true" size={11} />
              المصروف
            </dt>
            <dd
              className="numeric mt-0.5 truncate text-[11px] font-bold text-white"
              dir="ltr"
            >
              {formatMinorAmount(expenseMinor, {
                currency,
                locale: "en-US",
              })}
            </dd>
          </div>
          <div className="rounded-xl bg-black/15 px-2 py-2">
            <dt className="flex items-center gap-1 text-[10px] text-white/65">
              <HandCoins aria-hidden="true" size={11} />
              الصافي
            </dt>
            <dd
              className={`numeric mt-0.5 truncate text-[11px] font-bold ${
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
