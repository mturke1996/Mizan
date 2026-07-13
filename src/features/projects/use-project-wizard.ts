import { useEffect, useRef, useState } from "react";
import {
  PROJECT_BLUEPRINTS,
  getBlueprintCategorySeeds,
  getDefaultProjectModules,
} from "./project-blueprints";
import { categoryKey } from "./project-form-schema";
import { WIZARD_STEPS } from "./project-form/project-form-config";
import type {
  ProjectCategorySeed,
  ProjectModuleKey,
  ProjectModules,
  ProjectType,
} from "@/features/workspace/workspace-types";

export type WizardStep = 1 | 2 | 3;

export function useProjectWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedType, setSelectedType] = useState<ProjectType | null>(null);
  const [modules, setModules] = useState<ProjectModules | null>(null);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>(
    [],
  );
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<WizardStep>(step);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    stepHeadingRef.current?.focus();
  }, [step]);

  const selectedBlueprint = selectedType
    ? PROJECT_BLUEPRINTS[selectedType]
    : null;
  const selectedCategories =
    selectedBlueprint?.suggestedCategories.filter((category) =>
      selectedCategoryKeys.includes(categoryKey(category)),
    ) ?? [];
  const currentStep = WIZARD_STEPS[step - 1]!;

  const chooseBlueprint = (type: ProjectType) => {
    if (type === selectedType) return;
    const categories = getBlueprintCategorySeeds(type);
    setSelectedType(type);
    setModules(getDefaultProjectModules(type));
    setSelectedCategoryKeys(categories.map(categoryKey));
  };

  const toggleModule = (key: ProjectModuleKey) => {
    if (key === "transactions") return;
    setModules((current) =>
      current
        ? {
            ...current,
            transactions: true,
            [key]: !current[key],
          }
        : current,
    );
  };

  const toggleCategory = (category: ProjectCategorySeed) => {
    const key = categoryKey(category);
    setSelectedCategoryKeys((current) =>
      current.includes(key)
        ? current.filter((candidate) => candidate !== key)
        : [...current, key],
    );
  };

  const continueFromType = () => {
    if (selectedType) setStep(2);
  };

  const continueFromSetup = () => {
    if (selectedType && modules) setStep(3);
  };

  const goBack = () => {
    setStep((current) => (current === 3 ? 2 : 1));
  };

  return {
    step,
    currentStep,
    stepHeadingRef,
    selectedType,
    selectedBlueprint,
    modules,
    selectedCategoryKeys,
    selectedCategories,
    chooseBlueprint,
    toggleModule,
    toggleCategory,
    continueFromType,
    continueFromSetup,
    goBack,
  };
}
