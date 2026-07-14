import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface CashFlowPoint {
  month: string;
  income: number;
  expense: number;
}

const compactNumber = new Intl.NumberFormat("ar-LY-u-nu-latn", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function CashFlowChart({
  data,
  currency,
}: {
  data: CashFlowPoint[];
  currency: string;
}) {
  const hasData = data.some((item) => item.income > 0 || item.expense > 0);

  return (
    <section
      aria-labelledby="cash-flow-title"
      className="rounded-[18px] border border-line bg-surface p-4 shadow-[0_8px_24px_rgb(27_30_60/4%)] sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-4 sm:mb-5">
        <div>
          <h2 id="cash-flow-title" className="text-sm font-bold text-ink">
            حركة الدخل والمصروف
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            آخر {data.length} أشهر · القيم بعملة {currency}
          </p>
        </div>
        <Link
          to="/analytics"
          className="pressable inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl bg-primary-soft px-2.5 text-[11px] font-bold text-primary"
        >
          التفاصيل
          <ArrowLeft aria-hidden="true" size={13} />
        </Link>
      </div>

      <div className="mb-3 flex items-center gap-4 text-[10px] font-medium text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          الدخل
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-danger" />
          المصروف
        </span>
      </div>

      {hasData ? (
        <div
          className="h-44 w-full sm:h-56 lg:h-72"
          role="img"
          aria-label="مخطط الدخل والمصروف الشهري"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 0, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id="dashboard-income" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--mizan-success)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--mizan-success)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="dashboard-expense"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--mizan-danger)"
                    stopOpacity={0.14}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--mizan-danger)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--mizan-border)"
                strokeDasharray="4 5"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--mizan-text-muted)", fontSize: 10 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--mizan-text-muted)", fontSize: 10 }}
                tickFormatter={(value: number) => compactNumber.format(value)}
              />
              <Tooltip
                formatter={(value) => [
                  `${compactNumber.format(Number(value))} ${currency}`,
                ]}
                contentStyle={{
                  background: "var(--mizan-surface)",
                  border: "1px solid var(--mizan-border)",
                  borderRadius: "10px",
                  boxShadow: "var(--shadow-card)",
                  direction: "rtl",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="income"
                name="الدخل"
                stroke="var(--mizan-success)"
                strokeWidth={2.5}
                fill="url(#dashboard-income)"
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="المصروف"
                stroke="var(--mizan-danger)"
                strokeWidth={2.25}
                fill="url(#dashboard-expense)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid h-44 place-items-center rounded-[14px] bg-canvas text-center sm:h-56 lg:h-72">
          <div className="max-w-xs px-5">
            <p className="text-sm font-bold text-ink">المخطط ينتظر أول حركة</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              أضف دخلاً أو مصروفًا وسيظهر الاتجاه الشهري هنا تلقائيًا.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
