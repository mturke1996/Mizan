import type {
  ProjectColorToken,
  ProjectModules,
} from "@/features/workspace/workspace-types";
import type { BadgeTone } from "@/shared/ui/Badge";
import type { SectionTabItem } from "@/shared/ui/SectionTabs";

export type ProjectDetailTabId =
  | "overview"
  | "cash"
  | "capital"
  | "workers"
  | "inventory"
  | "livestock"
  | "transactions";

export const PROJECT_DETAIL_TABS_ID = "project-detail-tabs";

const PROJECT_DETAIL_TAB_IDS = new Set<ProjectDetailTabId>([
  "overview",
  "cash",
  "capital",
  "workers",
  "inventory",
  "livestock",
  "transactions",
]);

const TAB_LABELS: Readonly<Record<ProjectDetailTabId, string>> = {
  overview: "نظرة عامة",
  cash: "الخزينة",
  capital: "رأس المال",
  workers: "العمال",
  inventory: "المخزون",
  livestock: "الحيوانات",
  transactions: "المعاملات",
};

export interface ProjectColorPresentation {
  readonly badgeTone: BadgeTone;
  readonly iconClassName: string;
  readonly surfaceClassName: string;
}

const PROJECT_COLOR_PRESENTATION: Readonly<
  Record<ProjectColorToken, ProjectColorPresentation>
> = {
  primary: {
    badgeTone: "primary",
    iconClassName: "bg-primary text-primary-on",
    surfaceClassName: "bg-primary-soft",
  },
  success: {
    badgeTone: "success",
    iconClassName: "bg-success text-success-on",
    surfaceClassName: "bg-success-soft",
  },
  warning: {
    badgeTone: "warning",
    iconClassName: "bg-warning text-warning-on",
    surfaceClassName: "bg-warning-soft",
  },
  danger: {
    badgeTone: "danger",
    iconClassName: "bg-danger text-danger-on",
    surfaceClassName: "bg-danger-soft",
  },
  info: {
    badgeTone: "info",
    iconClassName: "bg-info text-info-on",
    surfaceClassName: "bg-info-soft",
  },
};

export function getProjectColorPresentation(
  colorToken: ProjectColorToken,
): ProjectColorPresentation {
  return PROJECT_COLOR_PRESENTATION[colorToken];
}

export function getProjectDetailTabs(
  modules: ProjectModules,
  options?: { hasCash?: boolean },
): SectionTabItem<ProjectDetailTabId>[] {
  const ids: ProjectDetailTabId[] = ["overview"];
  if (options?.hasCash) ids.push("cash");
  if (modules.capital) ids.push("capital");
  if (modules.workers) ids.push("workers");
  if (modules.inventory) ids.push("inventory");
  if (modules.livestock) ids.push("livestock");
  ids.push("transactions");
  return ids.map((id) => ({ id, label: TAB_LABELS[id] }));
}

export function parseProjectDetailTabId(
  value: string | null,
): ProjectDetailTabId | undefined {
  return value && PROJECT_DETAIL_TAB_IDS.has(value as ProjectDetailTabId)
    ? (value as ProjectDetailTabId)
    : undefined;
}

export function formatProjectPercent(
  value: number | null,
  maximumFractionDigits = 2,
): string {
  if (value === null || !Number.isFinite(value)) return "غير متاح";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value)}%`;
}

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Recharts accepts numbers, while the ledger stores exact bigint minor units.
 * Clamp only the visual magnitude; exact bigint values remain available to the
 * tooltip and all textual financial values.
 */
export function toProjectChartNumber(value: bigint): number {
  if (value > MAX_SAFE_BIGINT) return Number.MAX_SAFE_INTEGER;
  if (value < -MAX_SAFE_BIGINT) return -Number.MAX_SAFE_INTEGER;
  return Number(value);
}
