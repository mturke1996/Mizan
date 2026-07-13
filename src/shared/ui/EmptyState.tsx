import { clsx } from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useId } from "react";

export interface EmptyStateProps
  extends Omit<ComponentPropsWithoutRef<"section">, "children"> {
  action?: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  title: string;
}

export function EmptyState({
  action,
  "aria-labelledby": ariaLabelledby,
  className,
  description,
  icon,
  title,
  ...props
}: EmptyStateProps) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;

  return (
    <section
      aria-labelledby={ariaLabelledby ?? titleId}
      className={clsx(
        "rounded-sm border border-dashed border-line bg-surface p-6 text-center sm:p-8",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="mx-auto grid size-12 place-items-center rounded-sm bg-surface-subtle text-primary-ink"
      >
        {icon}
      </span>
      <h2 id={titleId} className="mt-4 text-base font-bold text-ink">
        {title}
      </h2>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        {description}
      </div>
      {action != null ? (
        <div className="mt-5 flex justify-center">{action}</div>
      ) : null}
    </section>
  );
}
