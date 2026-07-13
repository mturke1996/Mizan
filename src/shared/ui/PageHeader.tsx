import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  action?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  backTo,
  action,
}: PageHeaderProps) {
  return (
    <header className="safe-top mb-6">
      {(backTo || action) && (
        <div className="mb-5 flex min-h-11 items-center justify-between">
          {backTo ? (
            <Link
              to={backTo}
              aria-label="العودة"
              className="pressable flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
            >
              <ArrowRight aria-hidden="true" size={20} />
            </Link>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      <h1 className="text-[28px] leading-tight font-bold tracking-[-0.025em] text-ink">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
    </header>
  );
}
