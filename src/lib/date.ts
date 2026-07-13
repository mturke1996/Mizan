export function getArabicGreeting(date: Date): string {
  return date.getHours() < 12 ? "صباح الخير" : "مساء الخير";
}

export function formatDashboardDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function getDateKeyInTimeZone(
  date: Date,
  timeZone: string,
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatPlainDateAr(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
