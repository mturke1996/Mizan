import {
  Bird,
  Briefcase,
  Coffee,
  GraduationCap,
  HardHat,
  KeyRound,
  LayoutGrid,
  Package,
  PawPrint,
  ShoppingCart,
  Sprout,
  Truck,
  Wallet,
  Wrench,
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
  "construction",
  "rental",
  "farming",
  "delivery",
  "maintenance",
  "education",
  "ecommerce",
  "personal",
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
    suggestedCategories: [
      { name: "إيجار ومرافق", kind: "expense" },
      { name: "رواتب وأجور", kind: "expense" },
      { name: "تسويق وإعلانات", kind: "expense" },
      { name: "صيانة وتشغيل", kind: "expense" },
      { name: "مستلزمات وأدوات", kind: "expense" },
      { name: "نقل ومواصلات", kind: "expense" },
      { name: "مبيعات", kind: "income" },
      { name: "خدمات مشاريع", kind: "income" },
      { name: "دفعات عقود", kind: "income" },
    ],
    setupSteps: [SETUP_STEPS.firstTransaction],
  }),
  construction: defineBlueprint({
    type: "construction",
    name: "مقاولات وبناء",
    description: "تابع مواد البناء والعمال والمعدات ودفعات المشاريع.",
    icon: HardHat,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: true,
      capital: true,
      inventory: true,
      livestock: false,
    },
    suggestedCategories: [
      { name: "مواد بناء", kind: "expense" },
      { name: "أجور عمال", kind: "expense" },
      { name: "معدات وإيجار", kind: "expense" },
      { name: "نقل ومشال", kind: "expense" },
      { name: "دفعات مشاريع", kind: "income" },
      { name: "أعمال إضافية", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.capital,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.worker,
      SETUP_STEPS.inventory,
    ],
  }),
  rental: defineBlueprint({
    type: "rental",
    name: "تأجير عقارات ومعدات",
    description: "تابع الإيجارات والصيانة والضرائب والتأمين.",
    icon: KeyRound,
    defaultModules: {
      transactions: true,
      goal: true,
      workers: false,
      capital: true,
      inventory: false,
      livestock: false,
    },
    suggestedCategories: [
      { name: "صيانة وإصلاح", kind: "expense" },
      { name: "تأمين", kind: "expense" },
      { name: "ضرائب ورسوم", kind: "expense" },
      { name: "تسويق وإعلان", kind: "expense" },
      { name: "إيجارات", kind: "income" },
      { name: "تأمينات مستردة", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.capital,
      SETUP_STEPS.goal,
      SETUP_STEPS.firstTransaction,
    ],
  }),
  farming: defineBlueprint({
    type: "farming",
    name: "زراعة ومحاصيل",
    description: "تابع البذور والأسمدة والري ومبيعات المحاصيل.",
    icon: Sprout,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: true,
      capital: true,
      inventory: true,
      livestock: false,
    },
    suggestedCategories: [
      { name: "بذور وشتلات", kind: "expense" },
      { name: "أسمدة ومبيدات", kind: "expense" },
      { name: "مياه وري", kind: "expense" },
      { name: "نقل وحصاد", kind: "expense" },
      { name: "مبيعات محاصيل", kind: "income" },
      { name: "إيجار معدات", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.capital,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.worker,
      SETUP_STEPS.inventory,
    ],
  }),
  delivery: defineBlueprint({
    type: "delivery",
    name: "توصيل ونقل",
    description: "تابع الوقود وصيانة المركبات وأجور السائقين ورسوم التوصيل.",
    icon: Truck,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: true,
      capital: true,
      inventory: false,
      livestock: false,
    },
    suggestedCategories: [
      { name: "وقود", kind: "expense" },
      { name: "صيانة مركبات", kind: "expense" },
      { name: "أجور سائقين", kind: "expense" },
      { name: "رسوم طرق", kind: "expense" },
      { name: "رسوم توصيل", kind: "income" },
      { name: "عقود نقل", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.capital,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.worker,
    ],
  }),
  maintenance: defineBlueprint({
    type: "maintenance",
    name: "صيانة وإصلاح",
    description: "تابع قطع الغيار والأدوات وأجور الفنيين وعقود الصيانة.",
    icon: Wrench,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: true,
      capital: false,
      inventory: true,
      livestock: false,
    },
    suggestedCategories: [
      { name: "قطع غيار", kind: "expense" },
      { name: "أدوات ومعدات", kind: "expense" },
      { name: "نقل ومواصلات", kind: "expense" },
      { name: "أجور فنيين", kind: "expense" },
      { name: "أتعاب صيانة", kind: "income" },
      { name: "عقود صيانة", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.worker,
      SETUP_STEPS.inventory,
    ],
  }),
  education: defineBlueprint({
    type: "education",
    name: "تعليم وتدريب",
    description: "تابع المستلزمات والإيجار والرواتب ورسوم التعليم.",
    icon: GraduationCap,
    defaultModules: {
      transactions: true,
      goal: true,
      workers: true,
      capital: false,
      inventory: false,
      livestock: false,
    },
    suggestedCategories: [
      { name: "مستلزمات تعليمية", kind: "expense" },
      { name: "إيجار ومرافق", kind: "expense" },
      { name: "رواتب مدرّسين", kind: "expense" },
      { name: "تسويق وإعلان", kind: "expense" },
      { name: "رسوم دراسية", kind: "income" },
      { name: "دورات تدريبية", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.goal,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.worker,
    ],
  }),
  ecommerce: defineBlueprint({
    type: "ecommerce",
    name: "تجارة إلكترونية",
    description: "تابع المنتجات والشحن والتسويق والمبيعات عبر الإنترنت.",
    icon: ShoppingCart,
    defaultModules: {
      transactions: true,
      goal: true,
      workers: false,
      capital: true,
      inventory: true,
      livestock: false,
    },
    suggestedCategories: [
      { name: "تكلفة منتجات", kind: "expense" },
      { name: "شحن وتغليف", kind: "expense" },
      { name: "تسويق إعلاني", kind: "expense" },
      { name: "عمولات منصات", kind: "expense" },
      { name: "مبيعات إلكترونية", kind: "income" },
      { name: "اشتراكات", kind: "income" },
    ],
    setupSteps: [
      SETUP_STEPS.capital,
      SETUP_STEPS.goal,
      SETUP_STEPS.firstTransaction,
      SETUP_STEPS.inventory,
    ],
  }),
  personal: defineBlueprint({
    type: "personal",
    name: "مصروفات شخصية",
    description: "تتبّع مصروفاتك ودخلك الشخصي ببساطة.",
    icon: Wallet,
    defaultModules: {
      transactions: true,
      goal: false,
      workers: false,
      capital: false,
      inventory: false,
      livestock: false,
    },
    suggestedCategories: [
      { name: "طعام وشراب", kind: "expense" },
      { name: "مواصلات", kind: "expense" },
      { name: "فواتير ومرافق", kind: "expense" },
      { name: "تسوق وملابس", kind: "expense" },
      { name: "صحة وترفيه", kind: "expense" },
      { name: "راتب", kind: "income" },
      { name: "دخل إضافي", kind: "income" },
      { name: "هدايا وتحويلات", kind: "income" },
    ],
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
