import { AlertCircle } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}
    >
      {label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <article className="rounded-[12px] border border-line bg-surface p-4 shadow-[0_2px_14px_rgb(27_30_60/3%)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted">{label}</p>
          <p className="numeric mt-1.5 text-2xl leading-none font-bold tracking-[-0.03em] text-ink">
            {value}
          </p>
        </div>
        {icon ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-surface-subtle">
            {icon}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-3 truncate text-[10px] text-soft">{hint}</p>
      ) : null}
    </article>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-md bg-surface-subtle"
        />
      ))}
    </div>
  );
}

export function EmptyBlock({
  title,
  description,
  action,
}: PropsWithChildren<{
  title: string;
  description: string;
  action?: ReactNode;
}>) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surface-subtle/50 p-6 text-center">
      <p className="font-bold text-ink">{title}</p>
      <p className="mt-2 text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-md border border-danger/20 bg-danger-soft p-5 text-center"
    >
      <AlertCircle
        aria-hidden="true"
        className="mx-auto text-danger"
        size={24}
      />
      <p className="mt-3 font-bold text-danger">تعذر تحميل البيانات</p>
      <p className="mt-2 text-sm text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="pressable mt-4 min-h-11 rounded-sm bg-danger px-4 text-sm font-bold text-danger-on"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-4 text-sm text-ink placeholder:text-muted"
    />
  );
}
