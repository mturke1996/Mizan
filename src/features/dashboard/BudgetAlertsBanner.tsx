import { AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { summarizeCurrentMonthByCategory } from "@/domain/analytics/compute-analytics";
import { formatMinorAmount } from "@/domain/money/money";
import { useAuth } from "@/features/auth/use-auth";
import {
  useAllTransactionsQuery,
  useBudgetsQuery,
  useCategoriesQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";

export function BudgetAlertsBanner() {
  const { currency, isDemo = false, workspaceId } = useWorkspace();
  const { profile } = useAuth();
  const budgetsQuery = useBudgetsQuery();
  const categoriesQuery = useCategoriesQuery();
  const allTransactions = useAllTransactionsQuery();

  const overruns = useMemo(() => {
    if (isDemo || !workspaceId) return [];
    const spend = summarizeCurrentMonthByCategory({
      transactions: allTransactions.transactions,
      currency,
      timeZone: profile?.timezone ?? "Africa/Tripoli",
    });
    const names = new Map(
      (categoriesQuery.data ?? []).map((category) => [
        category.id,
        category.name,
      ]),
    );
    return (budgetsQuery.data ?? [])
      .map((budget) => {
        const spent = spend.get(budget.categoryId) ?? 0n;
        if (spent <= budget.limitMinor) return null;
        return {
          id: budget.id,
          name: names.get(budget.categoryId) ?? "تصنيف",
          spent,
          limit: budget.limitMinor,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [
    allTransactions.transactions,
    budgetsQuery.data,
    categoriesQuery.data,
    currency,
    isDemo,
    profile?.timezone,
    workspaceId,
  ]);

  if (overruns.length === 0) return null;

  const money = { currency, locale: "en-US" as const };

  return (
    <AppCard className="mb-4 border-warning/30 bg-warning-soft p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-warning">
          <AlertTriangle aria-hidden="true" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">تجاوز ميزانية</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {overruns.slice(0, 3).map((row) => (
              <li key={row.id}>
                {row.name}:{" "}
                <bdi className="numeric font-semibold text-ink" dir="ltr">
                  {formatMinorAmount(row.spent, money)}
                </bdi>{" "}
                من{" "}
                <bdi className="numeric" dir="ltr">
                  {formatMinorAmount(row.limit, money)}
                </bdi>
              </li>
            ))}
          </ul>
          <Link
            to="/budgets"
            className="mt-3 inline-flex text-xs font-bold text-primary"
          >
            إدارة الميزانيات
          </Link>
        </div>
      </div>
    </AppCard>
  );
}
