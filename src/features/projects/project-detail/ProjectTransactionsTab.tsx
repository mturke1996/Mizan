import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type {
  FinanceTransaction,
  Wallet,
} from "@/domain/finance/finance-state";
import { TransactionList } from "@/features/transactions/TransactionList";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";

interface ProjectTransactionsTabProps {
  error: string | null;
  isLoading: boolean;
  onRetry: () => void;
  projectId: string;
  transactions: FinanceTransaction[];
  wallets: Wallet[];
}

export function ProjectTransactionsTab({
  error,
  isLoading,
  onRetry,
  projectId,
  transactions,
  wallets,
}: ProjectTransactionsTabProps) {
  return (
    <section aria-labelledby="project-transactions-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="text-lg font-bold text-ink"
            id="project-transactions-title"
          >
            معاملات المشروع
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            السجل الكامل للدخل والمصروفات المرتبطة بالمشروع.
          </p>
        </div>
        <Link
          aria-label="إضافة معاملة جديدة"
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
          to={`/transactions/new?project=${encodeURIComponent(projectId)}`}
        >
          <Plus aria-hidden="true" size={17} />
          إضافة معاملة
        </Link>
      </div>

      {isLoading ? (
        <AppCard
          aria-label="جاري تحميل معاملات المشروع"
          className="h-64 animate-pulse bg-surface-subtle motion-reduce:animate-none"
          role="status"
        />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={onRetry}
          title="تعذر تحميل معاملات المشروع"
        />
      ) : (
        <TransactionList
          emptyMessage="لا توجد معاملات مرتبطة بهذا المشروع"
          transactions={transactions}
          wallets={wallets}
        />
      )}
    </section>
  );
}
