import { Download, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { FinanceTransaction } from "@/domain/finance/finance-state";
import { downloadCsv, exportRegisterCsv } from "@/lib/csv-export";
import {
  useCategoriesQuery,
  useFilteredTransactionsQuery,
  useProjectsQuery,
  useWalletsQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { fetchAllFilteredTransactions } from "@/features/workspace/workspace-api";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { TransactionList } from "./TransactionList";

type TransactionFilter = "all" | FinanceTransaction["kind"];

const kindFilters: Array<{ value: TransactionFilter; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "income", label: "الدخل" },
  { value: "expense", label: "المصروفات" },
  { value: "transfer", label: "التحويلات" },
];

const selectClass =
  "min-h-11 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none";
const labelClass = "mb-1 block text-xs font-semibold text-muted";

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const requestedFilter = searchParams.get("type");
  const activeKind = kindFilters.some((filter) => filter.value === requestedFilter)
    ? (requestedFilter as TransactionFilter)
    : "all";
  const walletId = searchParams.get("wallet") ?? "";
  const categoryId = searchParams.get("cat") ?? "";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";

  const filters = useMemo(
    () => ({
      kind: activeKind === "all" ? undefined : activeKind,
      walletId: walletId || undefined,
      categoryId: categoryId || undefined,
      search: query.trim() || undefined,
      dateFrom: dateFrom ? `${dateFrom}T00:00:00` : undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59.999` : undefined,
    }),
    [activeKind, walletId, categoryId, query, dateFrom, dateTo],
  );

  const { data: walletsData } = useWalletsQuery();
  const { data: categoriesData } = useCategoriesQuery();
  const { data: projectsData } = useProjectsQuery();
  const { workspaceId, isDemo = false } = useWorkspace();
  const wallets = walletsData ?? [];
  const allCategories = categoriesData ?? [];
  const projects = projectsData ?? [];
  const categories =
    activeKind === "all"
      ? allCategories
      : allCategories.filter((category) => category.kind === activeKind);

  const {
    transactions,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage,
    isRefetching,
    refetch,
  } = useFilteredTransactionsQuery(filters);

  const [isExporting, setIsExporting] = useState(false);

  const walletName = useMemo(
    () => new Map(wallets.map((wallet) => [wallet.id, wallet.name])),
    [wallets],
  );
  const categoryName = useMemo(
    () => new Map(allCategories.map((category) => [category.id, category.name])),
    [allCategories],
  );
  const projectName = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  async function handleExport() {
    setIsExporting(true);
    try {
      let rows: FinanceTransaction[];
      if (workspaceId && !isDemo && hasNextPage) {
        rows = await fetchAllFilteredTransactions(workspaceId, filters);
      } else {
        rows = transactions;
      }
      if (rows.length === 0) {
        toast.message("لا توجد معاملات للتصدير");
        return;
      }
      const csv = exportRegisterCsv(rows, {
        wallet: (id) => walletName.get(id) ?? "",
        category: (id) => categoryName.get(id) ?? "",
        project: (id) => projectName.get(id) ?? "",
      });
      const today = new Date().toISOString().slice(0, 10);
      downloadCsv(`mizan-transactions-${today}.csv`, csv);
      toast.success(`تم تصدير ${rows.length} معاملة`);
    } catch (exportError) {
      toast.error(
        exportError instanceof Error
          ? exportError.message
          : "تعذر تصدير المعاملات",
      );
    } finally {
      setIsExporting(false);
    }
  }

  const setParameter = (name: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (!value || value === "all") {
      nextParams.delete(name);
    } else {
      nextParams.set(name, value);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters =
    activeKind !== "all" ||
    Boolean(walletId) ||
    Boolean(categoryId) ||
    query.trim().length > 0 ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="المعاملات"
        subtitle="سجل واضح لكل حركة مالية، قابل للبحث والتصفية بالكامل."
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

      <div className="relative mb-3">
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
          placeholder="ابحث بالوصف"
          className="min-h-12 w-full rounded-md border border-line-strong bg-surface pr-11 pl-4 text-sm text-ink placeholder:text-muted"
        />
      </div>

      <div
        aria-label="تصفية المعاملات"
        className="subtle-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1"
      >
        {kindFilters.map((filter) => {
          const isActive = activeKind === filter.value;

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

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col">
          <span className={labelClass}>المحفظة</span>
          <select
            aria-label="تصفية حسب المحفظة"
            value={walletId}
            onChange={(event) => setParameter("wallet", event.target.value)}
            className={selectClass}
          >
            <option value="">كل المحافظ</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className={labelClass}>التصنيف</span>
          <select
            aria-label="تصفية حسب التصنيف"
            value={categoryId}
            onChange={(event) => setParameter("cat", event.target.value)}
            className={selectClass}
          >
            <option value="">كل التصنيفات</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className={labelClass}>من تاريخ</span>
          <input
            type="date"
            aria-label="من تاريخ"
            value={dateFrom}
            onChange={(event) => setParameter("from", event.target.value)}
            className={selectClass}
          />
        </label>

        <label className="flex flex-col">
          <span className={labelClass}>إلى تاريخ</span>
          <input
            type="date"
            aria-label="إلى تاريخ"
            value={dateTo}
            onChange={(event) => setParameter("to", event.target.value)}
            className={selectClass}
          />
        </label>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-xs text-muted" aria-live="polite">
          {isLoading
            ? "جاري البحث…"
            : hasActiveFilters
              ? `${transactions.length} معاملة مطابقة`
              : `${transactions.length} معاملة`}
        </p>
        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="pressable rounded-sm border border-line px-3 py-1 text-xs font-semibold text-muted hover:border-line-strong hover:text-ink"
            >
              مسح الفلاتر
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || isLoading || transactions.length === 0}
            className="pressable flex items-center gap-1 rounded-sm border border-line-strong bg-surface px-3 py-1 text-xs font-bold text-ink hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Download aria-hidden="true" size={14} />
            {isExporting ? "جاري التصدير…" : "تصدير CSV"}
          </button>
        </div>
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
      ) : error ? (
        <ErrorState
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <TransactionList
            transactions={transactions}
            wallets={wallets}
            emptyMessage="لا توجد معاملات مطابقة"
          />

          {hasNextPage ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={fetchNextPage}
                disabled={isFetchingNextPage}
                className="pressable min-h-11 rounded-sm border border-line-strong bg-surface px-5 text-sm font-bold text-ink hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {isFetchingNextPage ? "جاري التحميل…" : "تحميل المزيد"}
              </button>
            </div>
          ) : null}

          {isRefetching ? (
            <p className="mt-3 text-center text-xs text-muted" aria-live="polite">
              جاري التحديث…
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
