import type { ComponentProps } from "react";
import { clsx } from "clsx";

interface AppCardProps extends ComponentProps<"section"> {
  elevated?: boolean;
}

export function AppCard({
  className,
  elevated = false,
  ...props
}: AppCardProps) {
  return (
    <section
      className={clsx(
        "rounded-md border border-line bg-surface",
        elevated && "[box-shadow:var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}
