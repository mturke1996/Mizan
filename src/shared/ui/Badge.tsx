import { clsx } from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type BadgeTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface BadgeProps
  extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  children: ReactNode;
  icon?: ReactNode;
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  primary: "bg-primary-soft text-primary-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-ink",
  info: "bg-info-soft text-ink",
  neutral: "border border-line bg-surface-subtle text-muted",
};

export function Badge({
  children,
  className,
  icon,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center gap-1.5 rounded-xs px-2 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon != null ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
