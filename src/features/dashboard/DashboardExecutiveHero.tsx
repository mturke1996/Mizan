import { ArrowDownLeft, ArrowUpRight, HandCoins, Landmark } from "lucide-react";
import { Link } from "react-router-dom";
import { formatMinorAmount } from "@/domain/money/money";

interface DashboardExecutiveHeroProps {
  balanceMinor: bigint;
  currency: string;
  walletCount: number;
  monthlyTrend: Array<{ month: string; income: number; expense: number }>;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  savingsRate: number;
}

function getSparkline(
  trend: DashboardExecutiveHeroProps["monthlyTrend"],
): { line: string; area: string } | null {
  const values = trend.map((item) => item.income - item.expense);
  if (values.length < 2 || values.every((value) => value === 0)) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 220;
  const height = 72;
  const padY = 8;

  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - padY - ((value - min) / range) * (height - padY * 2);
    return { x, y };
  });

  return {
    line: coords.map((point) => `${point.x},${point.y}`).join(" "),
    area: [
      `0,${height}`,
      ...coords.map((point) => `${point.x},${point.y}`),
      `${width},${height}`,
    ].join(" "),
  };
}

export function DashboardExecutiveHero({
  balanceMinor,
  currency,
  walletCount,
  monthlyTrend,
  incomeMinor,
  expenseMinor,
  netMinor,
  savingsRate,
}: DashboardExecutiveHeroProps) {
  const spark = getSparkline(monthlyTrend);
  const netPositive = netMinor >= 0n;
  const money = { currency, locale: "en-US" as const };

  return (
    <section
      aria-labelledby="executive-balance-title"
      className="relative hidden overflow-hidden rounded-[24px] border border-primary/15 shadow-[0_12px_36px_rgb(67_56_202/14%)] md:block"
      style={{
        background:
          "linear-gradient(145deg, var(--mizan-auth-panel) 0%, var(--mizan-primary) 48%, #5f67d8 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -left-16 size-56 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-10 size-64 rounded-full bg-white/5 blur-3xl"
      />

      <div className="relative grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold text-white/85">
              <Landmark aria-hidden="true" size={12} />
              {walletCount} {walletCount === 1 ? "محفظة" : "محافظ"}
            </span>
            <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold text-white/85">
              ادخار {savingsRate.toFixed(1)}%
            </span>
          </div>

          <p
            id="executive-balance-title"
            className="mt-4 text-xs font-semibold tracking-wide text-white/70"
          >
            إجمالي السيولة المتاحة
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-3">
            <strong
              className="numeric text-[40px] leading-none font-black tracking-[-0.04em] text-white lg:text-[46px]"
              dir="ltr"
            >
              {formatMinorAmount(balanceMinor, money)}
            </strong>
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white/90">
              {currency}
            </span>
          </p>

          <dl className="mt-5 grid max-w-lg grid-cols-3 gap-2">
            {[
              {
                label: "دخل الشهر",
                value: incomeMinor,
                icon: ArrowDownLeft,
              },
              {
                label: "مصروف الشهر",
                value: expenseMinor,
                icon: ArrowUpRight,
              },
              {
                label: "صافي الشهر",
                value: netMinor,
                icon: HandCoins,
                tone: netPositive ? "text-[#b8f5df]" : "text-[#ffc4cb]",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl bg-black/15 px-3 py-2.5 backdrop-blur-sm"
                >
                  <dt className="flex items-center gap-1 text-[10px] text-white/65">
                    <Icon aria-hidden="true" size={11} />
                    {item.label}
                  </dt>
                  <dd
                    className={`numeric mt-1 truncate text-sm font-bold text-white ${item.tone ?? ""}`}
                    dir="ltr"
                  >
                    {formatMinorAmount(item.value, money)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="flex flex-col items-stretch gap-3 lg:min-w-56 lg:items-end">
          {spark ? (
            <svg
              viewBox="0 0 220 72"
              className="h-16 w-full max-w-xs lg:h-[4.5rem] lg:w-56"
              role="img"
              aria-label="اتجاه صافي التدفق خلال الأشهر الأخيرة"
            >
              <defs>
                <linearGradient id="exec-spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={spark.area} fill="url(#exec-spark-fill)" />
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
          <Link
            to="/wallets"
            className="pressable inline-flex min-h-11 items-center justify-center rounded-xl bg-white/15 px-4 text-xs font-bold text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/22"
          >
            إدارة المحافظ
          </Link>
        </div>
      </div>
    </section>
  );
}
