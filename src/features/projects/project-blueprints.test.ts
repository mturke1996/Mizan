import {
  PROJECT_BLUEPRINTS,
  PROJECT_MODULE_METADATA,
  getBlueprintCategorySeeds,
  getDefaultProjectModules,
  normalizeProjectModules,
  normalizeProjectType,
  parseProjectType,
} from "./project-blueprints";

describe("PROJECT_BLUEPRINTS", () => {
  it("defines the six supported project types", () => {
    expect(Object.keys(PROJECT_BLUEPRINTS)).toEqual([
      "birds",
      "animals",
      "goods",
      "food",
      "services",
      "general",
    ]);
  });

  it("provides Arabic metadata and type-specific defaults", () => {
    expect(PROJECT_BLUEPRINTS.birds).toMatchObject({
      name: "تربية طيور وعصافير",
      defaultModules: {
        transactions: true,
        goal: false,
        workers: true,
        capital: true,
        inventory: true,
        livestock: true,
      },
    });
    expect(PROJECT_BLUEPRINTS.birds.suggestedCategories).toContainEqual({
      name: "علف",
      kind: "expense",
    });
    expect(PROJECT_BLUEPRINTS.services.defaultModules).toEqual({
      transactions: true,
      goal: true,
      workers: true,
      capital: false,
      inventory: false,
    livestock: false,
    });
    expect(PROJECT_BLUEPRINTS.general.suggestedCategories).toEqual([
      { name: "إيجار ومرافق", kind: "expense" },
      { name: "رواتب وأجور", kind: "expense" },
      { name: "تسويق وإعلانات", kind: "expense" },
      { name: "صيانة وتشغيل", kind: "expense" },
      { name: "مستلزمات وأدوات", kind: "expense" },
      { name: "نقل ومواصلات", kind: "expense" },
      { name: "مبيعات", kind: "income" },
      { name: "خدمات مشاريع", kind: "income" },
      { name: "دفعات عقود", kind: "income" },
    ]);
  });

  it("normalizes unknown project types and module JSON safely", () => {
    expect(parseProjectType("  BIRDS ")).toBe("birds");
    expect(parseProjectType("unknown")).toBeNull();
    expect(normalizeProjectType(null)).toBe("general");
    expect(
      normalizeProjectModules(
        '{"transactions":false,"goal":true,"workers":"yes","capital":true}',
        "general",
      ),
    ).toEqual({
      transactions: true,
      goal: true,
      workers: false,
      capital: true,
      inventory: false,
    livestock: false,
    });
  });

  it("returns fresh module and category defaults without shared mutation", () => {
    const modules = getDefaultProjectModules("birds");
    const categories = getBlueprintCategorySeeds("birds");

    (modules as { inventory: boolean }).inventory = false;
    (categories[0] as { name: string }).name = "متغيّر";

    expect(getDefaultProjectModules("birds").inventory).toBe(true);
    expect(getBlueprintCategorySeeds("birds")[0]?.name).toBe("علف");
  });

  it("keeps Arabic module and setup metadata aligned with enabled modules", () => {
    expect(PROJECT_MODULE_METADATA.capital).toMatchObject({
      name: "رأس المال",
      required: false,
    });
    for (const blueprint of Object.values(PROJECT_BLUEPRINTS)) {
      for (const step of blueprint.setupSteps) {
        expect(blueprint.defaultModules[step.module]).toBe(true);
        expect(step.title.trim()).not.toBe("");
      }
    }
  });

  it("deep-freezes public module and setup metadata", () => {
    expect(Object.isFrozen(PROJECT_MODULE_METADATA)).toBe(true);
    expect(Object.isFrozen(PROJECT_MODULE_METADATA.capital)).toBe(true);
    expect(Object.isFrozen(PROJECT_BLUEPRINTS.birds.defaultModules)).toBe(true);
    expect(
      Object.isFrozen(PROJECT_BLUEPRINTS.birds.suggestedCategories[0]),
    ).toBe(true);
    expect(Object.isFrozen(PROJECT_BLUEPRINTS.birds.setupSteps)).toBe(true);
    expect(Object.isFrozen(PROJECT_BLUEPRINTS.birds.setupSteps[0])).toBe(true);
  });
});
