import { getCurrencyScale } from "@/domain/money/money";

/** Normalize nullable text for PDF rendering. */
export function ar(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value).trim();
}

/** Format an ISO date (YYYY-MM-DD) for Arabic display. */
export function arDate(value: string | null | undefined): string {
  const raw = ar(value);
  if (!raw) return "—";
  const date = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("ar-LY", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function currencySymbol(currencyCode: string): string {
  const code = currencyCode.toUpperCase();
  if (code === "LYD") return "د.ل";
  return code;
}

/**
 * Format minor units as a major amount with currency label.
 * LYD uses scale 3 (dirhams); other currencies follow Intl scale.
 */
export function arMoney(
  amountMinor: bigint | number | string,
  currencyCode: string,
): string {
  const minor =
    typeof amountMinor === "bigint"
      ? amountMinor
      : typeof amountMinor === "number"
        ? BigInt(Math.trunc(amountMinor))
        : BigInt(amountMinor);
  const scale = getCurrencyScale(currencyCode);
  const major = Number(minor) / 10 ** scale;
  const formatted = new Intl.NumberFormat("ar-LY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: scale,
    useGrouping: true,
  }).format(major);
  return `${formatted} ${currencySymbol(currencyCode)}`;
}
