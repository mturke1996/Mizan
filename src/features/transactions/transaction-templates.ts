import {
  PROJECT_BLUEPRINTS,
  getBlueprintCategorySeeds,
} from "@/features/projects/project-blueprints";
import type {
  ProjectCategorySeed,
  ProjectType,
} from "@/features/workspace/workspace-types";

export interface TransactionTemplate {
  readonly id: string;
  readonly label: string;
  readonly kind: "income" | "expense";
  readonly title: string;
  readonly source: "common" | "blueprint";
}

export const COMMON_TRANSACTION_TEMPLATES: readonly TransactionTemplate[] =
  Object.freeze([
    {
      id: "common-expense-rent",
      label: "إيجار",
      kind: "expense",
      title: "إيجار",
      source: "common",
    },
    {
      id: "common-expense-transport",
      label: "نقل",
      kind: "expense",
      title: "نقل",
      source: "common",
    },
    {
      id: "common-expense-supplies",
      label: "مستلزمات",
      kind: "expense",
      title: "مستلزمات",
      source: "common",
    },
    {
      id: "common-income-sale",
      label: "مبيعات",
      kind: "income",
      title: "مبيعات",
      source: "common",
    },
    {
      id: "common-income-service",
      label: "أتعاب خدمة",
      kind: "income",
      title: "أتعاب خدمة",
      source: "common",
    },
  ]);

function seedToTemplate(
  seed: ProjectCategorySeed,
  projectType: ProjectType,
  index: number,
): TransactionTemplate {
  return {
    id: `blueprint-${projectType}-${seed.kind}-${index}`,
    label: seed.name,
    kind: seed.kind,
    title: seed.name,
    source: "blueprint",
  };
}

export function getBlueprintTransactionTemplates(
  projectType: ProjectType | undefined,
): TransactionTemplate[] {
  if (!projectType) return [];
  return getBlueprintCategorySeeds(projectType).map((seed, index) =>
    seedToTemplate(seed, projectType, index),
  );
}

export function getTransactionTemplates(input: {
  kind: "income" | "expense";
  projectType?: ProjectType;
}): TransactionTemplate[] {
  const blueprint = getBlueprintTransactionTemplates(input.projectType).filter(
    (template) => template.kind === input.kind,
  );
  const common = COMMON_TRANSACTION_TEMPLATES.filter(
    (template) => template.kind === input.kind,
  );
  const seen = new Set<string>();
  const merged: TransactionTemplate[] = [];
  for (const template of [...blueprint, ...common]) {
    const key = `${template.kind}:${template.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(template);
  }
  return merged;
}

export function listAllBlueprintTemplateLabels(): string[] {
  return Object.values(PROJECT_BLUEPRINTS).flatMap((blueprint) =>
    blueprint.suggestedCategories.map((category) => category.name),
  );
}
