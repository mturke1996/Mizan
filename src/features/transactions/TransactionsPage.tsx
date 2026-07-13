import { Plus, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { FinanceTransaction } from "@/domain/finance/finance-state";
import { useFinanceView } from "@/features/workspace/use-finance-view";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { TransactionList } from "./TransactionList";

type TransactionFilter = "all" | FinanceTransaction["kind"];

const filters: Array<{ value: TransactionFilter; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "income", label: "الدخل" },
  { value: "expense", label: "المصروفات" },
  { value: "transfer", label: "التحويلات" },
];

export function TransactionsPage() {
  const {
    wallets,
    transactions,
    isLoading,
    transactionsError,
    refresh,
  } = useFinanceView();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const requestedFilter = searchParams.get("type");
  const activeFilter = filters.some(
    (filter) => filter.value === requestedFilter,
  )
    ? (requestedFilter as TransactionFilter)
    : "all";

  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesType =
      activeFilter === "all" || transaction.kind === activeFilter;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      transaction.title.toLocaleLowerCase("ar").includes(normalizedQuery);

    return matchesType && matchesQuery;
  });

  const setParameter = (name: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (!value || value === "all") {
      nextParams.delete(name);
    } else {
      nextParams.set(name, value);
    }

    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="المعاملات"
        subtitle="سجل واضح لكل حركة مالية."
        action={
          <Link
            to="/transactions/new"
            aria-label="إضافة معاملة"
            className="pressable flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
          >
            <Plus aria-hidden="true" size={18} />
            إضافة
          </Link>
        }
      />

      <div className="relative mb-4">
        <Search
          aria-hidden="true"
          size={19}
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          aria-label="البحث في المعاملات"
          value={query}
          onChange={(event) => setParameter("q", event.target.value)}
          placeholder="ابحث بالاسم أو الوصف"
          className="min-h-12 w-full rounded-md border border-line-strong bg-surface pr-11 pl-4 text-sm text-ink placeholder:text-muted"
        />
      </div>

      <div
        aria-label="تصفية المعاملات"
        className="subtle-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1"
      >
        {filters.map((filter) => {
          const isActive = activeFilter === filter.value;

          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setParameter("type", filter.value)}
              className={`pressable min-h-11 shrink-0 rounded-sm border px-4 text-sm font-semibold ${
                isActive
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3" role="status">
          {[0, 1, 2].map((item) => (
            <AppCard
              key={item}
              className="h-20 animate-pulse bg-surface-subtle"
            />
          ))}
          <span className="sr-only">جاري تحميل المعاملات</span>
        </div>
      ) : transactionsError ? (
        <ErrorState
          message={transactionsError}
          onRetry={() => void refresh()}
        />
      ) : (
        <TransactionList
          transactions={filteredTransactions}
          wallets={wallets}
          emptyMessage="لا توجد معاملات مطابقة"
        />
      )}
    </div>
  );
}
