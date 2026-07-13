import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppCard } from "@/shared/ui/AppCard";
import {
  fetchRevenueSeries,
  groupRevenueByCurrency,
  intelligenceKeys,
} from "./supervisor-intelligence-api";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "./SupervisorUi";
import { formatMinorCurrency } from "./supervisor-utils";

type RangePreset = "30d" | "90d" | "12m" | "custom";

function rangeForPreset(preset: RangePreset, customFrom: string, customTo: string) {
  const to = new Date();
  const from = new Date();
  if (preset === "30d") from.setUTCDate(from.getUTCDate() - 30);
  else if (preset === "90d") from.setUTCDate(from.getUTCDate() - 90);
  else if (preset === "12m") from.setUTCMonth(from.getUTCMonth() - 12);
  else {
    return {
      from: customFrom
        ? new Date(customFrom).toISOString()
        : new Date(Date.now() - 90 * 86400000).toISOString(),
      to: customTo ? new Date(customTo).toISOString() : to.toISOString(),
    };
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function bucketForPreset(preset: RangePreset): "day" | "week" | "month" {
  if (preset === "30d") return "day";
  if (preset === "90d") return "week";
  return "month";
}

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "30d", label: "30 يوم" },
  { id: "90d", label: "90 يوم" },
  { id: "12m", label: "12 شهر" },
  { id: "custom", label: "مخصص" },
];

export function SupervisorRevenuePage() {
  const [preset, setPreset] = useState<RangePreset>("90d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(
    () => rangeForPreset(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  const bucket = bucketForPreset(preset);

  const revenueQuery = useQuery({
    queryKey: intelligenceKeys.revenue(range.from, range.to, bucket),
    queryFn: () =>
      fetchRevenueSeries({
        from: range.from,
        to: range.to,
        bucket,
      }),
  });

  const byCurrency = groupRevenueByCurrency(revenueQuery.data ?? []);

  return (
    <div className="space-y-6 py-6">
      <div className="lg:hidden">
        <h1 className="text-xl font-bold text-ink">الإيرادات</h1>
        <p className="mt-1 text-sm text-muted">مدفوعات معتمدة حسب العملة</p>
      </div>

      <AppCard className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <button
              className={[
                "pressable min-h-10 rounded-sm px-3 text-xs font-bold",
                preset === item.id
                  ? "bg-primary text-primary-on"
                  : "bg-surface-subtle text-muted hover:text-ink",
              ].join(" ")}
              key={item.id}
              onClick={() => setPreset(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-semibold text-muted">
              من
              <input
                className="mt-1 block min-h-11 rounded-sm border border-line bg-surface px-3 text-sm text-ink"
                onChange={(event) => setCustomFrom(event.target.value)}
                type="date"
                value={customFrom}
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              إلى
              <input
                className="mt-1 block min-h-11 rounded-sm border border-line bg-surface px-3 text-sm text-ink"
                onChange={(event) => setCustomTo(event.target.value)}
                type="date"
                value={customTo}
              />
            </label>
          </div>
        ) : null}
        <p className="text-xs text-muted">
          المؤشر يعرض «مدفوعات معتمدة» من قرارات المراجعة اليدوية، وليس إيرادًا
          مصرفيًا محصّلًا.
        </p>
      </AppCard>

      {revenueQuery.isLoading ? (
        <LoadingBlock rows={4} />
      ) : revenueQuery.isError ? (
        <ErrorBlock
          message={
            revenueQuery.error instanceof Error
              ? revenueQuery.error.message
              : "تعذر التحميل"
          }
          onRetry={() => void revenueQuery.refetch()}
        />
      ) : byCurrency.size === 0 ? (
        <EmptyBlock
          description="لا مدفوعات معتمدة في هذا النطاق."
          title="لا بيانات"
        />
      ) : (
        [...byCurrency.entries()].map(([currency, points]) => {
          const chartData = points.map((point) => ({
            bucket: point.bucketStart,
            amount: point.approvedAmountMinor / 100,
            count: point.approvedCount,
          }));
          const totalMinor = points.reduce(
            (sum, point) => sum + point.approvedAmountMinor,
            0,
          );

          return (
            <AppCard className="space-y-4 p-5" key={currency}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-ink">
                    مدفوعات معتمدة · {currency}
                  </h2>
                  <p className="numeric mt-1 text-2xl font-bold text-ink">
                    {formatMinorCurrency(totalMinor, currency)}
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer height="100%" width="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="var(--mizan-line)" strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      dataKey="amount"
                      name="مدفوعات معتمدة"
                      stroke="var(--mizan-primary)"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="h-48 w-full">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="var(--mizan-line)" strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill="var(--mizan-success)"
                      name="عدد الدفعات"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-subtle text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 text-start font-bold">الفترة</th>
                      <th className="px-3 py-2 text-start font-bold">المبلغ</th>
                      <th className="px-3 py-2 text-start font-bold">العدد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr
                        className="border-t border-line"
                        key={`${point.bucketStart}-${point.currencyCode}`}
                      >
                        <td className="px-3 py-2">{point.bucketStart}</td>
                        <td className="numeric px-3 py-2">
                          {formatMinorCurrency(
                            point.approvedAmountMinor,
                            point.currencyCode,
                          )}
                        </td>
                        <td className="numeric px-3 py-2">
                          {point.approvedCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppCard>
          );
        })
      )}
    </div>
  );
}
