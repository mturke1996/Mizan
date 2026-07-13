import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface ProgressRingProps {
  className?: string;
  helper?: ReactNode;
  label: string;
  size?: number;
  value: number | null;
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function normalizeProgress(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

export function ProgressRing({
  className,
  helper,
  label,
  size = 112,
  value,
}: ProgressRingProps) {
  const normalizedValue = normalizeProgress(value);
  const isUnavailable = normalizedValue === null;
  const clampedValue = normalizedValue ?? 0;
  const displayValue = isUnavailable ? "—" : `${Math.round(clampedValue)}%`;
  const dashOffset = CIRCUMFERENCE * (1 - clampedValue / 100);

  return (
    <figure
      className={clsx(
        "m-0 inline-flex max-w-full flex-col items-center text-center",
        className,
      )}
    >
      <div className="relative shrink-0">
        <svg
          aria-label={isUnavailable ? `${label}: غير متاح` : label}
          aria-valuemax={isUnavailable ? undefined : 100}
          aria-valuemin={isUnavailable ? undefined : 0}
          aria-valuenow={isUnavailable ? undefined : clampedValue}
          aria-valuetext={isUnavailable ? undefined : displayValue}
          height={size}
          role={isUnavailable ? "img" : "progressbar"}
          viewBox="0 0 100 100"
          width={size}
        >
          <circle
            className="text-surface-strong"
            cx="50"
            cy="50"
            fill="none"
            r={RADIUS}
            stroke="currentColor"
            strokeWidth="8"
          />
          <circle
            className={clsx(
              "transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none",
              isUnavailable ? "text-soft" : "text-primary",
            )}
            cx="50"
            cy="50"
            data-testid="progress-ring-value"
            fill="none"
            r={RADIUS}
            stroke="currentColor"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth="8"
            transform="rotate(-90 50 50)"
          />
          <line
            className="text-surface"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.5"
            x1="50"
            x2="50"
            y1="9"
            y2="14"
          />
        </svg>
        <span
          aria-hidden="true"
          className="numeric pointer-events-none absolute inset-0 grid place-items-center text-lg font-bold text-ink"
          dir="ltr"
        >
          {displayValue}
        </span>
      </div>
      <figcaption className="mt-3">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {helper != null ? (
          <span className="mt-1 block max-w-44 text-xs leading-5 text-muted">
            {helper}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
