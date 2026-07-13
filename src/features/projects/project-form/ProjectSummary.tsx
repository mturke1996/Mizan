import {
  PROJECT_MODULE_KEYS,
  PROJECT_MODULE_METADATA,
  type ProjectBlueprint,
} from "../project-blueprints";
import { categoryKey } from "../project-form-schema";
import type {
  ProjectCategorySeed,
  ProjectModules,
} from "@/features/workspace/workspace-types";
import { Badge } from "@/shared/ui/Badge";

export interface ProjectSummaryProps {
  blueprint: ProjectBlueprint;
  modules: ProjectModules;
  selectedCategories: readonly ProjectCategorySeed[];
}

export function ProjectSummary({
  blueprint,
  modules,
  selectedCategories,
}: ProjectSummaryProps) {
  const enabledModuleKeys = PROJECT_MODULE_KEYS.filter((key) => modules[key]);

  return (
    <section
      aria-labelledby="project-summary-title"
      className="rounded-sm border border-line bg-surface-subtle p-4"
    >
      <h3 id="project-summary-title" className="text-sm font-bold text-ink">
        ملخص المخطط
      </h3>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-xs text-muted">نوع المشروع</dt>
          <dd className="mt-1 font-bold text-ink">{blueprint.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">الوحدات المفعّلة</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {enabledModuleKeys.map((key) => (
              <Badge key={key} tone="primary">
                {PROJECT_MODULE_METADATA[key].name}
              </Badge>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">التصنيفات التي ستُنشأ</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {selectedCategories.length > 0 ? (
              selectedCategories.map((category) => (
                <Badge
                  key={categoryKey(category)}
                  tone={category.kind === "income" ? "success" : "danger"}
                >
                  {category.kind === "income" ? "دخل" : "مصروف"}:{" "}
                  {category.name}
                </Badge>
              ))
            ) : (
              <span className="text-xs font-semibold text-muted">
                لا توجد تصنيفات أولية
              </span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
