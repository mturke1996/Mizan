const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export interface FormatMinorAmountOptions {
  currency: string;
  locale?: string;
  fractionDigits?: number;
}

export function getCurrencyScale(currency: string): number {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function normalizeDigits(value: string): string {
  return [...value]
    .map((character) => {
      const arabicIndex = ARABIC_DIGITS.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);

      const persianIndex = PERSIAN_DIGITS.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);

      return character;
    })
    .join("");
}

export function parseMajorAmount(value: string, scale: number): bigint {
  const normalizedDigits = normalizeDigits(value.trim());
  const ungroupedPattern = /^-?\d+(?:[.٫]\d+)?$/;
  const groupedPattern = /^-?\d{1,3}(?:[,٬]\d{3})+(?:[.٫]\d+)?$/;

  if (
    !ungroupedPattern.test(normalizedDigits) &&
    !groupedPattern.test(normalizedDigits)
  ) {
    throw new Error("أدخل مبلغًا صحيحًا");
  }

  const normalized = normalizedDigits
    .replaceAll("٬", "")
    .replaceAll(",", "")
    .replace("٫", ".");

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = "0", fraction = ""] = unsigned.split(".");

  if (fraction.length > scale) {
    throw new Error(`الحد الأقصى للأجزاء العشرية هو ${scale}`);
  }

  const factor = 10n ** BigInt(scale);
  const fractionMinor = BigInt(fraction.padEnd(scale, "0") || "0");
  const amountMinor = BigInt(whole) * factor + fractionMinor;

  return negative ? -amountMinor : amountMinor;
}

export function formatMajorInputAmount(
  amountMinor: bigint,
  scale: number,
): string {
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  const factor = 10n ** BigInt(scale);
  const whole = absolute / factor;
  const fraction = absolute % factor;
  const fractionText =
    scale > 0
      ? fraction.toString().padStart(scale, "0").replace(/0+$/, "")
      : "";
  const body = fractionText.length > 0 ? `${whole}.${fractionText}` : `${whole}`;
  return negative ? `-${body}` : body;
}

export function toSafeMinorNumber(amountMinor: bigint): number {
  if (
    amountMinor > BigInt(Number.MAX_SAFE_INTEGER) ||
    amountMinor < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error("المبلغ أكبر من الحد الآمن للحفظ");
  }
  return Number(amountMinor);
}

export function formatMinorAmount(
  amountMinor: bigint,
  options: FormatMinorAmountOptions,
): string {
  const scale = getCurrencyScale(options.currency);

  if (
    amountMinor > BigInt(Number.MAX_SAFE_INTEGER) ||
    amountMinor < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error("المبلغ أكبر من نطاق العرض المدعوم");
  }

  const fractionDigits = options.fractionDigits ?? scale;
  const majorAmount = Number(amountMinor) / 10 ** scale;

  return new Intl.NumberFormat(options.locale ?? "ar-LY", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(majorAmount);
}
