import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FinanceTransaction } from "@/domain/finance/finance-state";
import { formatMinorAmount } from "@/domain/money/money";
import { AppCard } from "@/shared/ui/AppCard";

interface FinancialCalendarViewProps {
  transactions: readonly FinanceTransaction[];
  currency: string;
}

export function FinancialCalendarView({
  transactions,
  currency,
}: FinancialCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("ar-SA", {
    month: "long",
    year: "numeric",
  });

  // Calculate day-by-day aggregates
  const dayAggregates = useMemo(() => {
    const map: Record<
      string,
      { income: bigint; expense: bigint; items: FinanceTransaction[] }
    > = {};

    transactions.forEach((tx) => {
      const date = new Date(tx.occurredAt);
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      if (!map[dayKey]) {
        map[dayKey] = { income: 0n, expense: 0n, items: [] };
      }

      map[dayKey].items.push(tx);
      if (tx.kind === "income") {
        map[dayKey].income += BigInt(tx.amountMinor);
      } else if (tx.kind === "expense") {
        map[dayKey].expense += BigInt(tx.amountMinor);
      }
    });

    return map;
  }, [transactions]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    const totalDays = lastDayOfMonth.getDate();

    const days: Array<{
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      income: bigint;
      expense: bigint;
      itemsCount: number;
    }> = [];

    // Empty padding days for month start alignment
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({
        dateKey: `pad-${i}`,
        dayNumber: 0,
        isCurrentMonth: false,
        income: 0n,
        expense: 0n,
        itemsCount: 0,
      });
    }

    // Days of current month
    for (let day = 1; day <= totalDays; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const data = dayAggregates[dateKey] || {
        income: 0n,
        expense: 0n,
        items: [],
      };

      days.push({
        dateKey,
        dayNumber: day,
        isCurrentMonth: true,
        income: data.income,
        expense: data.expense,
        itemsCount: data.items.length,
      });
    }

    return days;
  }, [year, month, dayAggregates]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayKey(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayKey(null);
  };

  const selectedDayData = selectedDayKey ? dayAggregates[selectedDayKey] : null;

  const weekDayNames = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

  return (
    <div className="space-y-4">
      <AppCard className="p-4 sm:p-6">
        {/* Calendar Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 dark:border-dark-surface-raised">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink dark:text-dark-ink">
                التقويم المالي
              </h3>
              <p className="text-xs text-muted dark:text-dark-muted">
                معاينة تدفقات اليوم وحركاتها النقدية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-ink transition hover:bg-surface-subtle active:scale-95 dark:border-dark-surface-raised dark:bg-dark-surface dark:text-dark-ink"
              title="الشهر السابق"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="min-w-32 text-center text-sm font-bold text-ink dark:text-dark-ink">
              {monthName}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-ink transition hover:bg-surface-subtle active:scale-95 dark:border-dark-surface-raised dark:bg-dark-surface dark:text-dark-ink"
              title="الشهر التالي"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted dark:text-dark-muted">
          {weekDayNames.map((dayName) => (
            <div key={dayName} className="py-1">
              {dayName}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="h-16 rounded-xl bg-surface-subtle/30 dark:bg-dark-surface-raised/20"
                />
              );
            }

            const isSelected = selectedDayKey === cell.dateKey;
            const hasData = cell.income > 0n || cell.expense > 0n;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => setSelectedDayKey(cell.dateKey)}
                className={`group relative flex h-20 flex-col justify-between rounded-xl border p-1.5 text-right transition-all sm:p-2 ${
                  isSelected
                    ? "border-primary bg-primary-soft/40 shadow-sm dark:bg-primary/20"
                    : hasData
                      ? "border-border bg-surface hover:border-primary/50 dark:border-dark-surface-raised dark:bg-dark-surface"
                      : "border-border/40 bg-surface/50 opacity-80 hover:opacity-100 dark:border-dark-surface-raised/40 dark:bg-dark-surface/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isSelected
                        ? "text-primary"
                        : "text-ink dark:text-dark-ink"
                    }`}
                  >
                    {cell.dayNumber}
                  </span>
                  {cell.itemsCount > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-strong text-[10px] font-bold text-muted dark:bg-dark-surface-raised dark:text-dark-muted">
                      {cell.itemsCount}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5 text-[10px] font-bold tracking-tight">
                  {cell.income > 0n && (
                    <div className="truncate text-success">
                      +{formatMinorAmount(cell.income, { currency })}
                    </div>
                  )}
                  {cell.expense > 0n && (
                    <div className="truncate text-danger">
                      -{formatMinorAmount(cell.expense, { currency })}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </AppCard>

      {/* Day Details Drawer/Card */}
      {selectedDayKey && (
        <AppCard className="p-4 sm:p-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3 dark:border-dark-surface-raised">
            <h4 className="text-sm font-bold text-ink dark:text-dark-ink">
              معاملات يوم {selectedDayKey}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedDayKey(null)}
              className="text-xs font-medium text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-ink"
            >
              إغلاق
            </button>
          </div>

          {!selectedDayData || selectedDayData.items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted dark:text-dark-muted">
              لا توجد معاملات مسجلة في هذا اليوم.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDayData.items.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-surface p-3 transition hover:bg-surface-subtle dark:border-dark-surface-raised dark:bg-dark-surface"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        tx.kind === "income"
                          ? "bg-success-soft text-success"
                          : "bg-danger-soft text-danger"
                      }`}
                    >
                      {tx.kind === "income" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-ink dark:text-dark-ink">
                        {tx.title}
                      </div>
                      <div className="text-[10px] text-muted dark:text-dark-muted">
                        {tx.kind === "income" ? "دخل" : "مصروف"}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold dir-ltr ${
                      tx.kind === "income" ? "text-success" : "text-danger"
                    }`}
                  >
                    {tx.kind === "income" ? "+" : "-"}
                    {formatMinorAmount(tx.amountMinor, { currency })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AppCard>
      )}
    </div>
  );
}
