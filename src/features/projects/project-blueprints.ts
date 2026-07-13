import {
  Bird,
  Briefcase,
  Coffee,
  LayoutGrid,
  Package,
  PawPrint,
  type LucideIcon,
} from "lucide-react";
import type {
  ProjectCategorySeed,
  ProjectModuleKey,
  ProjectModules,
  ProjectSetupStep,
  ProjectType,
} from "@/features/workspace/workspace-types";

export const PROJECT_TYPES = Object.freeze([
  "birds",
  "animals",
  "goods",
  "food",
  "services",
  "general",
] as const) satisfies readonly ProjectType[];

export const PROJECT_MODULE_KEYS = Object.freeze([
  "transactions",
  "goal",
  "workers",
  "capital",
  "inventory",
  "livestock",
] as const) satisfies readonly ProjectModuleKey[];

export interface ProjectModuleMetadata {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

export const PROJECT_MODULE_METADATA: Readonly<
  Record<ProjectModuleKey, ProjectModuleMetadata>
> = Object.freeze({
  transactions: Object.freeze({
    name: "المعاملات",
    description: "سجّل دخل المشروع ومصروفاته واربطها بمحافظك.",
    required: true,
  }),
  goal: Object.freeze({
    name: "الهدف",
    description: "حدّد هدف الإيرادات وتابع التقدم نحوه.",
    required: false,
  }),
  workers: Object.freeze({
    name: "العمال",
    description: "تابع اليوميات والمكافآت والسحوبات والمستحقات.",
    required: false,
  }),
  capital: Object.freeze({
    name: "رأس المال",
    description: "سجّل رأس المال والمساهمات والسحوبات والتسويات.",
    required: false,
  }),
  inventory: Object.freeze({
    name: "المخزون",
    description: "تابع الأصناف أو الأعداد وكمياتها وتكلفتها.",
    required: false,
  }),
  livestock: Object.freeze({
    name: "الحيوانات",
    description: "تابع الدفعات والأحداث: فقس، ولادة، نفوق، بيع، ونقل.",
    required: false,
  }),
});

export interface ProjectBlueprint {
  readonly type: ProjectType;
  readonly name: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly defaultModules: ProjectModules;
  readonly suggestedCategories: readonly ProjectCategorySeed[];
  readonly setupSteps: readonly ProjectSetupStep[];
}

const SETUP_STEPS = {
  firstTransaction: {
    id: "first_transaction",
    module: "transactions",
    title: "سجّل أول معاملة",
    description: "أضف أول دخل أو مصروف لتبدأ قراءة أداء المشروع.",
  },
  goal: {
    id: "set_goal",
    module: "goal",
    title: "حدّد هدف المشروع",
    description: "ضع هدف إيرادات واضحاً لتتابع تقدمك.",
  },
  worker: {
    id: "first_worker",
    module: "workers",
    title: "أضف أول عامل",
    description: "سجّل العامل وأجره اليومي لتتبع مستحقاته.",
  },
  capital: {
    id: "opening_capital",
    module: "capital",
    title: "سجّل رأس المال الافتتاحي",
    description: "أدخل رأس المال لتعرف نسبة استرداده من الربح.",
  },
  inventory: {
    id: "first_inventory_item",
    module: "inventory",
    title: "أضف أول صنف",
    description: "سجّل الكمية والوحدة والتكلفة التقديرية.",
  },
} as const satisfies Record<string, ProjectSetupStep>;

function defineBlueprint(blueprint: ProjectBlueprint): ProjectBlueprint {
  return Object.freeze({
    ...blueprint,
    defaultModules: Object.freeze({ ...blueprint.defaultModules }),
    suggestedCategories: Object.freeze(
      blueprint.suggestedCategories.map((category) =>
        Object.freeze({ ...category }),
      ),
    ),
    setupSteps: Object.freeze(
      blueprint.setupSteps.map((step) => Object.freeze({ ...step })),
    ),
  });
}

export const PROJECT_BLUEPRINTS: Readonly<
  Record<ProjectType, ProjectBlueprint>
> = Object.freeze({
  birds: defineBlueprint({
    type: "birds",
    name: "تربية طيور وعصافير",
    description: "تابع الطيور والأعلاف والتجهيزات والعمال في مكان واحد.",
    icon: Bird,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: true,
      capital: true,
      inventory: true,
      livestock: true,
    },
    suggestedCategories: [
      { name: "علف", kind: "expense" },
      { name: "أقفاص وتجهيزات", kind: "expense" },
      { name: "أدوية وفيتامينات", kind: "expense" },
      { name: "بيع طيور", kind: "income" },
      { name: "بيع إنتاج", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.capital,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.worker,
      SETUP_STEPS.inventory,
    ],
  }),
  animals: defineBlueprint({
    type: "animals",
    name: "تربية حيوانات ومواشي",
    description: "تابع الرؤوس والأعلاف والرعاية البيطرية وتكاليف العمال.",
    icon: PawPrint,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: true,
      capital: true,
      inventory: true,
      livestock: true,
    },
    suggestedCategories: [
      { name: "أعلاف", kind: "expense" },
      { name: "بيطرة", kind: "expense" },
      { name: "نقل", kind: "expense" },
      { name: "بيع رؤوس", kind: "income" },
      { name: "بيع إنتاج", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.capital,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.worker,
      SETUP_STEPS.inventory,
    ],
  }),
  goods: defineBlueprint({
    type: "goods",
    name: "تجارة بضائع",
    description: "تابع المشتريات والمبيعات والمخزون ورأس المال.",
    icon: Package,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: false,
      capital: true,
      inventory: true,
      livestock: false,
    },
    suggestedCategories: [
      { name: "شراء بضاعة", kind: "expense" },
      { name: "شحن وتخزين", kind: "expense" },
      { name: "تسويق", kind: "expense" },
      { name: "مبيعات", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.capital,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.inventory,
    ],
  }),
  food: defineBlueprint({
    type: "food",
    name: "مطعم ومقهى",
    description: "تابع المواد الخام والمبيعات اليومية والعمال ورأس المال.",
    icon: Coffee,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: true,
      capital: true,
      inventory: true,
      livestock: false,
    },
    suggestedCategories: [
      { name: "مواد خام", kind: "expense" },
      { name: "إيجار", kind: "expense" },
      { name: "رواتب إضافية", kind: "expense" },
      { name: "مبيعات يومية", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.capital,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.worker,
      SETUP_STEPS.inventory,
    ],
  }),
  services: defineBlueprint({
    type: "services",
    name: "خدمات وأعمال حرة",
    description: "تابع العقود والأتعاب والأهداف وفريق العمل.",
    icon: Briefcase,
    defaultModules: {
      transactions: true,
      goal: true,
      workers: true,
      capital: false,
      inventory: false,
      livestock: false,
    },
    suggestedCategories: [
      { name: "أدوات ومعدات", kind: "expense" },
      { name: "مواصلات", kind: "expense" },
      { name: "أتعاب مشاريع", kind: "income" },
      { name: "عقود", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.goal,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.worker,
    ],
  }),
  general: defineBlueprint({
    type: "general",
    name: "مشروع عام",
    description: "ابدأ بالمعاملات وفعّل الوحدات التي تحتاج إليها.",
    icon: LayoutGrid,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: false,
      capital: false,
      inventory: false,
      livestock: false,
    },
    suggestedCategories: [],
    setupSteps: [SETUP_STEPS.firstTransaction],
  }),
});

export function parseProjectType(value: unknown): ProjectType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return PROJECT_TYPES.includes(normalized as ProjectType)
    ? (normalized as ProjectType)
    : null;
}

export function normalizeProjectType(value: unknown): ProjectType {
  return parseProjectType(value) ?? "general";
}

export function getProjectBlueprint(value: unknown): ProjectBlueprint {
  return PROJECT_BLUEPRINTS[normalizeProjectType(value)];
}

export function cloneProjectModules(modules: ProjectModules): ProjectModules {
  return {
    transactions: modules.transactions,
    goal: modules.goal,
    workers: modules.workers,
    capital: modules.capital,
    inventory: modules.inventory,
    livestock: modules.livestock,
  };
}

export function getDefaultProjectModules(value: unknown): ProjectModules {
  return cloneProjectModules(getProjectBlueprint(value).defaultModules);
}

function decodeModuleRecord(value: unknown): Record<string, unknown> | null {
  let decoded = value;
  if (typeof decoded === "string") {
    try {
      decoded = JSON.parse(decoded) as unknown;
    } catch {
      return null;
    }
  }
  return decoded !== null &&
    typeof decoded === "object" &&
    !Array.isArray(decoded)
    ? (decoded as Record<string, unknown>)
    : null;
}

export function parseProjectModules(value: unknown): ProjectModules | null {
  const record = decodeModuleRecord(value);
  if (
    !record ||
    record.transactions !== true ||
    typeof record.goal !== "boolean" ||
    typeof record.workers !== "boolean" ||
    typeof record.capital !== "boolean" ||
    typeof record.inventory !== "boolean"
  ) {
    return null;
  }
  const livestock =
    typeof record.livestock === "boolean" ? record.livestock : false;
  const knownKeys = new Set([
    "transactions",
    "goal",
    "workers",
    "capital",
    "inventory",
    "livestock",
  ]);
  if (Object.keys(record).some((key) => !knownKeys.has(key))) {
    return null;
  }
  return {
    transactions: true,
    goal: record.goal,
    workers: record.workers,
    capital: record.capital,
    inventory: record.inventory,
    livestock,
  };
}

export function normalizeProjectModules(
  value: unknown,
  fallback: ProjectType | ProjectModules = "general",
): ProjectModules {
  const parsed = parseProjectModules(value);
  if (parsed) return parsed;

  const base =
    typeof fallback === "string"
      ? getDefaultProjectModules(fallback)
      : cloneProjectModules(fallback);
  const record = decodeModuleRecord(value);
  return {
    transactions: true,
    goal: typeof record?.goal === "boolean" ? record.goal : base.goal,
    workers:
      typeof record?.workers === "boolean" ? record.workers : base.workers,
    capital:
      typeof record?.capital === "boolean" ? record.capital : base.capital,
    inventory:
      typeof record?.inventory === "boolean"
        ? record.inventory
        : base.inventory,
    livestock:
      typeof record?.livestock === "boolean"
        ? record.livestock
        : base.livestock,
  };
}

export function getBlueprintCategorySeeds(
  value: unknown,
): ProjectCategorySeed[] {
  return getProjectBlueprint(value).suggestedCategories.map((category) => ({
    name: category.name,
    kind: category.kind,
  }));
}
