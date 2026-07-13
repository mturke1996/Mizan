import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyBlock, LoadingBlock } from "./SupervisorUi";

export interface SupervisorDataTableColumn<T> {
  id: string;
  header: string;
  cell(row: T): ReactNode;
  className?: string;
}

export interface SupervisorDataTableProps<T> {
  rows: T[];
  rowKey(row: T): string;
  columns: Array<SupervisorDataTableColumn<T>>;
  renderMobileRow(row: T): ReactNode;
  selectedId?: string;
  page: number;
  pageCount: number;
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  onRowSelect(row: T): void;
  onPageChange(page: number): void;
}

export function SupervisorDataTable<T>({
  rows,
  rowKey,
  columns,
  renderMobileRow,
  selectedId,
  page,
  pageCount,
  isLoading,
  emptyTitle,
  emptyDescription = "لا توجد نتائج مطابقة للفلاتر الحالية.",
  onRowSelect,
  onPageChange,
}: SupervisorDataTableProps<T>) {
  if (isLoading) {
    return <LoadingBlock rows={4} />;
  }

  if (rows.length === 0) {
    return <EmptyBlock title={emptyTitle} description={emptyDescription} />;
  }

  const canPrev = page > 1;
  const canNext = page < pageCount;

  return (
    <div className="space-y-3">
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead className="bg-surface-subtle text-start">
              <tr>
                {columns.map((column) => (
                  <th
                    className={`px-3 py-3 text-xs font-bold text-muted ${column.className ?? ""}`}
                    key={column.id}
                    scope="col"
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = rowKey(row);
                const selected = selectedId === id;
                return (
                  <tr
                    aria-selected={selected}
                    className={`cursor-pointer border-t border-line transition-colors ${
                      selected
                        ? "bg-primary-soft/60"
                        : "hover:bg-surface-subtle/70"
                    }`}
                    data-selected={selected ? "true" : undefined}
                    key={id}
                    onClick={() => onRowSelect(row)}
                  >
                    {columns.map((column) => (
                      <td
                        className={`truncate px-3 py-3 text-ink ${column.className ?? ""}`}
                        key={column.id}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((row) => {
          const id = rowKey(row);
          const selected = selectedId === id;
          return (
            <div
              aria-pressed={selected}
              className={`pressable w-full cursor-pointer rounded-lg border p-3 text-start transition-colors ${
                selected
                  ? "border-primary bg-primary-soft/50"
                  : "border-line bg-surface hover:bg-surface-subtle"
              }`}
              key={id}
              onClick={() => onRowSelect(row)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowSelect(row);
                }
              }}
              role="button"
              tabIndex={0}
            >
              {renderMobileRow(row)}
            </div>
          );
        })}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            aria-label="الصفحة السابقة"
            className="pressable inline-flex min-h-11 items-center gap-1 rounded-sm border border-line-strong bg-surface px-3 text-sm font-bold text-ink disabled:opacity-40"
            disabled={!canPrev}
            onClick={() => onPageChange(page - 1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={16} />
            السابق
          </button>
          <p className="text-xs font-semibold text-muted">
            صفحة {page} من {pageCount}
          </p>
          <button
            aria-label="الصفحة التالية"
            className="pressable inline-flex min-h-11 items-center gap-1 rounded-sm border border-line-strong bg-surface px-3 text-sm font-bold text-ink disabled:opacity-40"
            disabled={!canNext}
            onClick={() => onPageChange(page + 1)}
            type="button"
          >
            التالي
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
