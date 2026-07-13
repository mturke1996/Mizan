import {
  CreditCard,
  Eye,
  MessageSquare,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchCustomerControlLedger,
  intelligenceKeys,
} from "./supervisor-intelligence-api";
import { ErrorBlock, LoadingBlock } from "./SupervisorUi";
import { formatDateAr } from "./supervisor-utils";

const PAGE_SIZE = 20;

export interface CustomerControlLedgerProps {
  workspaceId: string;
}

function entryIcon(entryType: string) {
  if (entryType === "payment_review") return CreditCard;
  if (entryType === "subscription_event") return RefreshCw;
  if (entryType === "notification") return MessageSquare;
  if (entryType.includes("financial") || entryType === "audit") {
    return entryType.includes("financial") ? Eye : Shield;
  }
  return Shield;
}

function entryLabel(entryType: string, title: string): string {
  if (entryType === "payment_review") {
    if (title.includes("approved")) return "مراجعة دفع · موافقة";
    if (title.includes("rejected")) return "مراجعة دفع · رفض";
    return "مراجعة دفع";
  }
  if (entryType === "subscription_event") return `اشتراك · ${title}`;
  if (entryType === "notification") return `رسالة · ${title}`;
  if (title.includes("financial_accessed") || title.includes("financial")) {
    return "وصول مالي للقراءة";
  }
  if (entryType === "audit") return `تدقيق · ${title}`;
  return title;
}

export function CustomerControlLedger({
  workspaceId,
}: CustomerControlLedgerProps) {
  const [page, setPage] = useState(1);
  const ledgerQuery = useQuery({
    queryKey: intelligenceKeys.customerLedger(workspaceId, page),
    queryFn: () =>
      fetchCustomerControlLedger(
        workspaceId,
        PAGE_SIZE,
        (page - 1) * PAGE_SIZE,
      ),
  });

  if (ledgerQuery.isLoading) return <LoadingBlock rows={4} />;
  if (ledgerQuery.isError) {
    return (
      <ErrorBlock
        message={
          ledgerQuery.error instanceof Error
            ? ledgerQuery.error.message
            : "تعذر التحميل"
        }
        onRetry={() => void ledgerQuery.refetch()}
      />
    );
  }

  const rows = ledgerQuery.data?.rows ?? [];
  const total = ledgerQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (rows.length === 0) {
    return <p className="text-sm text-muted">لا قرارات مسجّلة لهذا العميل.</p>;
  }

  return (
    <div className="space-y-3">
      <ol className="relative space-y-0 border-s border-line ps-4">
        {rows.map((entry) => {
          const Icon = entryIcon(entry.entryType);
          return (
            <li className="relative pb-4 last:pb-0" key={entry.entryId}>
              <span className="absolute top-0 -start-[1.4rem] grid size-7 place-items-center rounded-full border border-line bg-surface text-primary">
                <Icon aria-hidden="true" size={13} />
              </span>
              <p className="text-sm font-bold text-ink">
                {entryLabel(entry.entryType, entry.title)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {entry.actorName || "نظام"} · {formatDateAr(entry.occurredAt)}
              </p>
            </li>
          );
        })}
      </ol>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <button
            className="pressable min-h-10 rounded-sm border border-line px-3 text-xs font-bold disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            السابق
          </button>
          <span className="text-[11px] text-muted">
            {page} / {totalPages}
          </span>
          <button
            className="pressable min-h-10 rounded-sm border border-line px-3 text-xs font-bold disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            type="button"
          >
            التالي
          </button>
        </div>
      ) : null}
    </div>
  );
}
