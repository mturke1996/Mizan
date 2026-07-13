import type { DebtSummary } from "@/features/workspace/workspace-types";

export interface DebtAnalytics {
  readonly receivableMinor: bigint;
  readonly payableMinor: bigint;
  readonly netMinor: bigint;
  readonly openCount: number;
  readonly overdueCount: number;
  readonly dueSoonCount: number;
}

export interface ComputeDebtAnalyticsInput {
  readonly debts: ReadonlyArray<DebtSummary>;
  readonly now?: Date;
  readonly dueSoonDays?: number;
  readonly timeZone?: string;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateOnlyToEpochDay(value: string): number | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(timestamp / 86_400_000);
}

function zonedEpochDay(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return Math.floor(
    Date.UTC(value("year"), value("month") - 1, value("day")) / 86_400_000,
  );
}

export function computeDebtAnalytics({
  debts,
  now = new Date(),
  dueSoonDays = 7,
  timeZone = "Africa/Tripoli",
}: ComputeDebtAnalyticsInput): DebtAnalytics {
  if (Number.isNaN(now.getTime())) {
    throw new Error("computeDebtAnalytics: now must be a valid Date");
  }
  if (!Number.isInteger(dueSoonDays) || dueSoonDays < 0) {
    throw new Error("computeDebtAnalytics: dueSoonDays must be nonnegative");
  }

  const today = zonedEpochDay(now, timeZone);
  let receivableMinor = 0n;
  let payableMinor = 0n;
  let openCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;

  for (const debt of debts) {
    const isOutstanding =
      debt.balanceMinor > 0n &&
      debt.status !== "settled" &&
      debt.status !== "written_off";
    if (!isOutstanding) continue;

    if (debt.direction === "receivable") {
      receivableMinor += debt.balanceMinor;
    } else {
      payableMinor += debt.balanceMinor;
    }
    openCount += 1;

    if (!debt.dueOn) continue;
    const dueDay = dateOnlyToEpochDay(debt.dueOn);
    if (dueDay == null) continue;
    if (dueDay < today) {
      overdueCount += 1;
    } else if (dueDay <= today + dueSoonDays) {
      dueSoonCount += 1;
    }
  }

  return {
    receivableMinor,
    payableMinor,
    netMinor: receivableMinor - payableMinor,
    openCount,
    overdueCount,
    dueSoonCount,
  };
}
