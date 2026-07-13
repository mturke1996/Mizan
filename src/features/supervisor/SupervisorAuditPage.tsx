import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppCard } from "@/shared/ui/AppCard";
import {
  fetchAuditEvents,
  intelligenceKeys,
} from "./supervisor-intelligence-api";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  SearchField,
} from "./SupervisorUi";
import { formatDateAr } from "./supervisor-utils";

const PAGE_SIZE = 20;

const ACTION_PREFIXES = [
  { id: "", label: "كل الإجراءات" },
  { id: "supervisor.", label: "إجراءات المدير" },
  { id: "supervisor.financial", label: "وصول مالي" },
  { id: "supervisor_send", label: "إشعارات" },
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SupervisorAuditPage() {
  const [query, setQuery] = useState("");
  const [actionPrefix, setActionPrefix] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [openMeta, setOpenMeta] = useState<Record<string, boolean>>({});
  const debouncedQuery = useDebouncedValue(query, 300);

  const filters = {
    query: debouncedQuery,
    actionPrefix,
    workspaceId,
    actorUserId,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const auditQuery = useQuery({
    queryKey: intelligenceKeys.audit(filters),
    queryFn: () => fetchAuditEvents(filters),
  });

  const total = auditQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 py-6">
      <div className="lg:hidden">
        <h1 className="text-xl font-bold text-ink">سجل التدقيق</h1>
        <p className="mt-1 text-sm text-muted">أثر القرارات والوصول الحساس</p>
      </div>

      <AppCard className="space-y-3 p-4">
        <SearchField
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="بحث في الإجراء أو العميل أو المنفّذ"
          value={query}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-muted">
            نوع الإجراء
            <select
              className="mt-1 block min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-sm text-ink"
              onChange={(event) => {
                setActionPrefix(event.target.value);
                setPage(1);
              }}
              value={actionPrefix}
            >
              {ACTION_PREFIXES.map((item) => (
                <option key={item.id || "all"} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            معرّف المساحة
            <input
              className="mt-1 block min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-sm text-ink"
              onChange={(event) => {
                setWorkspaceId(event.target.value.trim());
                setPage(1);
              }}
              placeholder="uuid"
              value={workspaceId}
            />
          </label>
          <label className="text-xs font-semibold text-muted">
            معرّف المنفّذ
            <input
              className="mt-1 block min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-sm text-ink"
              onChange={(event) => {
                setActorUserId(event.target.value.trim());
                setPage(1);
              }}
              placeholder="uuid"
              value={actorUserId}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-muted">
              من
              <input
                className="mt-1 block min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-sm text-ink"
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
                type="date"
                value={from}
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              إلى
              <input
                className="mt-1 block min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-sm text-ink"
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
                type="date"
                value={to}
              />
            </label>
          </div>
        </div>
      </AppCard>

      {auditQuery.isLoading ? (
        <LoadingBlock rows={4} />
      ) : auditQuery.isError ? (
        <ErrorBlock
          message={
            auditQuery.error instanceof Error
              ? auditQuery.error.message
              : "تعذر التحميل"
          }
          onRetry={() => void auditQuery.refetch()}
        />
      ) : (auditQuery.data?.rows.length ?? 0) === 0 ? (
        <EmptyBlock description="لا أحداث مطابقة للفلاتر." title="لا نتائج" />
      ) : (
        <ul className="space-y-3">
          {(auditQuery.data?.rows ?? []).map((event) => {
            const metaOpen = Boolean(openMeta[event.id]);
            const before = event.metadata.before ?? event.metadata.from;
            const after = event.metadata.after ?? event.metadata.to;
            return (
              <li
                className="rounded-[12px] border border-line bg-surface p-4"
                key={event.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink">{event.action}</p>
                    <p className="mt-1 text-xs text-muted">
                      {event.actorName || "منفّذ"}
                      {event.customerName ? ` · ${event.customerName}` : ""}
                      {event.workspaceName
                        ? ` · ${event.workspaceName}`
                        : ""}
                    </p>
                  </div>
                  <p className="text-[11px] text-soft">
                    {formatDateAr(event.createdAt)}
                  </p>
                </div>
                <button
                  className="pressable mt-3 text-xs font-bold text-primary"
                  onClick={() =>
                    setOpenMeta((current) => ({
                      ...current,
                      [event.id]: !metaOpen,
                    }))
                  }
                  type="button"
                >
                  {metaOpen ? "إخفاء التفاصيل" : "عرض before/after"}
                </button>
                {metaOpen ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <pre className="overflow-x-auto rounded-sm bg-surface-subtle p-3 text-[11px] text-ink">
                      {JSON.stringify(before ?? event.metadata, null, 2)}
                    </pre>
                    <pre className="overflow-x-auto rounded-sm bg-surface-subtle p-3 text-[11px] text-ink">
                      {JSON.stringify(after ?? {}, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            className="pressable min-h-10 rounded-sm border border-line px-3 text-xs font-bold disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            السابق
          </button>
          <p className="text-xs text-muted">
            صفحة {page} من {totalPages}
          </p>
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
