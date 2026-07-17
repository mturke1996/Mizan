import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { summarizeCurrentMonthByCategory } from "@/domain/analytics/compute-analytics";
import { formatMinorAmount } from "@/domain/money/money";
import { BudgetsCard } from "@/features/analytics/BudgetsCard";
import { useAuth } from "@/features/auth/use-auth";
import {
  useAllTransactionsQuery,
  useBudgetsQuery,
  useCategoriesQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";

export function BudgetsPage() {
  const { currency, isDemo = false } = useWorkspace();
  const { profile } = useAuth();
  const budgetsQuery = useBudgetsQuery();
  const categoriesQuery = useCategoriesQuery();
  const allTransactions = useAllTransactionsQuery();

  const categoryName = useMemo(
    () =>
      new Map(
        (categoriesQuery.data ?? []).map((category) => [
          category.id,
          category.name,
        ]),
      ),
    [categoriesQuery.data],
  );

  const spendByCategory = useMemo(
    () =>
      summarizeCurrentMonthByCategory({
        transactions: allTransactions.transactions,
        currency,
        timeZone: profile?.timezone ?? "Africa/Tripoli",
      }),
    [allTransactions.transactions, currency, profile?.timezone],
  );

  const overruns = useMemo(() => {
    if (isDemo) return [];
    return (budgetsQuery.data ?? [])
      .map((budget) => {
        const spent = spendByCategory.get(budget.categoryId) ?? 0n;
        if (spent <= budget.limitMinor) return null;
        return {
          id: budget.id,
          name: categoryName.get(budget.categoryId) ?? "تصنيف",
          overMinor: spent - budget.limitMinor,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [budgetsQuery.data, spendByCategory, categoryName, isDemo]);

  return (
    <div className="px-4 sm:px-6 pb-6" dir="rtl">
      <PageHeader
        title="الميزانيات"
        subtitle="حدود إنفاق شهرية وتنبيهات التجاوز"
        backTo="/analytics"
      />

      {overruns.length > 0 ? (
        <AppCard className="mb-5 border-danger/30 bg-danger-soft p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-danger">
            <AlertTriangle aria-hidden="true" size={16} />
            تجاوز في {overruns.length} ميزانية
          </p>
          <ul className="mt-2 space-y-1 text-xs text-danger">
            {overruns.map((item) => (
              <li key={item.id}>
                {item.name}: تجاوز بمقدار{" "}
                <span className="numeric font-semibold" dir="ltr">
                  {formatMinorAmount(item.overMinor, {
                    currency,
                    locale: "en-US",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </AppCard>
      ) : null}

      <BudgetsCard />
    </div>
  );
}
