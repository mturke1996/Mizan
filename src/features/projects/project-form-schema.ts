import { z } from "zod";
import {
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import type {
  ProjectCategorySeed,
  ProjectColorToken,
  ProjectModules,
  ProjectType,
} from "@/features/workspace/workspace-types";

export const PROJECT_NAME_MAX_LENGTH = 160;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 500;

export const projectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "اكتب اسمًا واضحًا للمشروع")
    .max(
      PROJECT_NAME_MAX_LENGTH,
      "يجب ألا يتجاوز اسم المشروع 160 حرفًا",
    ),
  description: z
    .string()
    .trim()
    .min(5, "أضف وصفًا قصيرًا للمشروع")
    .max(
      PROJECT_DESCRIPTION_MAX_LENGTH,
      "يجب ألا يتجاوز وصف المشروع 500 حرف",
    ),
  colorToken: z.enum(["primary", "success", "warning", "danger", "info"]),
  goal: z.string().optional(),
  openingCapital: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const PROJECT_FORM_DEFAULT_VALUES: ProjectFormValues = {
  name: "",
  description: "",
  goal: "",
  openingCapital: "",
  colorToken: "primary",
};

export type ProjectAmountField = "goal" | "openingCapital";

export class ProjectAmountValidationError extends Error {
  readonly field: ProjectAmountField;

  constructor(field: ProjectAmountField, message: string) {
    super(message);
    this.name = "ProjectAmountValidationError";
    this.field = field;
  }
}

interface NormalizedAmount {
  readonly minor: bigint;
  readonly safeMinor: number;
}

export interface NormalizedLiveProjectPayload {
  readonly name: string;
  readonly description: string;
  readonly colorToken: ProjectColorToken;
  readonly projectType: ProjectType;
  readonly modules: ProjectModules;
  readonly seedCategories: ProjectCategorySeed[];
  readonly goalMinor?: number;
  readonly openingCapitalMinor?: number;
}

export interface NormalizedProjectSubmission {
  readonly livePayload: NormalizedLiveProjectPayload;
  readonly goalMinor?: bigint;
  readonly openingCapitalMinor?: bigint;
}

export interface NormalizeProjectSubmissionInput {
  readonly values: ProjectFormValues;
  readonly projectType: ProjectType;
  readonly modules: ProjectModules;
  readonly selectedCategories: readonly ProjectCategorySeed[];
  readonly currencyScale: number;
}

export interface LiveProjectSubmitIntent {
  readonly payloadFingerprint: string;
  readonly clientId: string;
}

export function categoryKey(category: ProjectCategorySeed): string {
  return `${category.kind}:${category.name}`;
}

function normalizeOptionalAmount(
  field: ProjectAmountField,
  value: string | undefined,
  scale: number,
  positiveMessage: string,
  fallbackMessage: string,
): NormalizedAmount | undefined {
  if (!value?.trim()) return undefined;
  try {
    const minor = parseMajorAmount(value, scale);
    if (minor <= 0n) throw new Error(positiveMessage);
    return {
      minor,
      safeMinor: toSafeMinorNumber(minor),
    };
  } catch (error) {
    throw new ProjectAmountValidationError(
      field,
      error instanceof Error ? error.message : fallbackMessage,
    );
  }
}

function normalizeCreateModules(modules: ProjectModules): ProjectModules {
  return {
    transactions: true,
    goal: modules.goal,
    workers: modules.workers,
    capital: modules.capital,
    inventory: modules.inventory,
    livestock: modules.livestock,
  };
}

export function normalizeProjectSubmission(
  input: NormalizeProjectSubmissionInput,
): NormalizedProjectSubmission {
  const modules = normalizeCreateModules(input.modules);
  const goalAmount = modules.goal
    ? normalizeOptionalAmount(
        "goal",
        input.values.goal,
        input.currencyScale,
        "أدخل هدفًا أكبر من صفر",
        "أدخل هدفًا ماليًا صحيحًا",
      )
    : undefined;
  const openingCapitalAmount = modules.capital
    ? normalizeOptionalAmount(
        "openingCapital",
        input.values.openingCapital,
        input.currencyScale,
        "أدخل رأس مال افتتاحيًا أكبر من صفر",
        "أدخل رأس مال افتتاحيًا صحيحًا",
      )
    : undefined;
  const livePayload: NormalizedLiveProjectPayload = {
    name: input.values.name.trim(),
    description: input.values.description.trim(),
    colorToken: input.values.colorToken,
    projectType: input.projectType,
    modules,
    seedCategories: input.selectedCategories.map((category) => ({
      name: category.name,
      kind: category.kind,
    })),
    ...(goalAmount ? { goalMinor: goalAmount.safeMinor } : {}),
    ...(openingCapitalAmount
      ? { openingCapitalMinor: openingCapitalAmount.safeMinor }
      : {}),
  };

  return {
    livePayload,
    ...(goalAmount ? { goalMinor: goalAmount.minor } : {}),
    ...(openingCapitalAmount
      ? { openingCapitalMinor: openingCapitalAmount.minor }
      : {}),
  };
}

export function createProjectPayloadFingerprint(
  payload: NormalizedLiveProjectPayload,
): string {
  return JSON.stringify({
    name: payload.name,
    description: payload.description,
    colorToken: payload.colorToken,
    projectType: payload.projectType,
    modules: {
      transactions: true,
      goal: payload.modules.goal,
      workers: payload.modules.workers,
      capital: payload.modules.capital,
      inventory: payload.modules.inventory,
      livestock: payload.modules.livestock,
    },
    seedCategories: payload.seedCategories.map((category) => ({
      name: category.name,
      kind: category.kind,
    })),
    ...("goalMinor" in payload ? { goalMinor: payload.goalMinor } : {}),
    ...("openingCapitalMinor" in payload
      ? { openingCapitalMinor: payload.openingCapitalMinor }
      : {}),
  });
}
