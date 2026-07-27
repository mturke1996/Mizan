import { clsx } from "clsx";
import { Check, Search, Sparkles } from "lucide-react";
import { useState, type Ref } from "react";
import {
  PROJECT_BLUEPRINTS,
  PROJECT_MODULE_KEYS,
  PROJECT_MODULE_METADATA,
  PROJECT_TYPES,
} from "../project-blueprints";
import type { ProjectType } from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { Badge } from "@/shared/ui/Badge";

export interface ProjectTypeStepProps {
  headingRef: Ref<HTMLHeadingElement>;
  selectedType: ProjectType | null;
  onSelect: (type: ProjectType) => void;
  onContinue: () => void;
}

type BlueprintFilterGroup =
  | "all"
  | "commerce"
  | "services"
  | "realestate"
  | "farming"
  | "general";

const CATEGORY_GROUPS: { id: BlueprintFilterGroup; label: string; types: ProjectType[] }[] = [
  { id: "all", label: "الكل", types: [] },
  { id: "commerce", label: "تجارة وتجزئة", types: ["goods", "food", "ecommerce", "pharmacy", "auto"] },
  { id: "services", label: "خدمات ومحترفين", types: ["services", "maintenance", "education", "tech", "events", "salon"] },
  { id: "realestate", label: "عقارات ومقاولات", types: ["construction", "rental", "realestate", "delivery"] },
  { id: "farming", label: "زراعة ومواشي", types: ["birds", "animals", "farming"] },
  { id: "general", label: "عام وشخصي", types: ["general", "personal"] },
];

export function ProjectTypeStep({
  headingRef,
  selectedType,
  onSelect,
  onContinue,
}: ProjectTypeStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<BlueprintFilterGroup>("all");

  const filteredTypes = PROJECT_TYPES.filter((type) => {
    const blueprint = PROJECT_BLUEPRINTS[type];
    if (activeGroup !== "all") {
      const group = CATEGORY_GROUPS.find((g) => g.id === activeGroup);
      if (group && !group.types.includes(type)) return false;
    }
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    const matchName = blueprint.name.toLowerCase().includes(query);
    const matchDesc = blueprint.description.toLowerCase().includes(query);
    const matchCat = blueprint.suggestedCategories.some((c) =>
      c.name.toLowerCase().includes(query),
    );
    return matchName || matchDesc || matchCat;
  });

  return (
    <section aria-labelledby="blueprint-step-title">
      <AppCard className="p-4 sm:p-5">
        <div className="mb-5">
          <h2
            ref={headingRef}
            id="blueprint-step-title"
            tabIndex={-1}
            className="text-xl font-bold text-ink flex items-center gap-2"
          >
            ما نوع مشروعك؟
            <Sparkles size={18} className="text-primary" />
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            اختر القالب الأقرب لطبيعة عملك للبدء مباشرة. يمكنك تخصيص الوحدات لاحقاً.
          </p>
        </div>

        {/* Search input & Category Tabs */}
        <div className="mb-5 space-y-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن قالب لمشروعك (مثل: ورشة، صيدلية، عقارات...)"
              className="w-full rounded-xl border border-line bg-canvas py-2.5 pr-10 pl-4 text-xs font-semibold text-ink placeholder:text-muted focus:border-primary focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 subtle-scrollbar">
            {CATEGORY_GROUPS.map((group) => {
              const active = activeGroup === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroup(group.id)}
                  className={[
                    "pressable rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150",
                    active
                      ? "bg-primary text-primary-on shadow-xs"
                      : "bg-surface-subtle text-muted hover:text-ink",
                  ].join(" ")}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </div>

        <fieldset>
          <legend className="sr-only">نوع المشروع</legend>
          {filteredTypes.length === 0 ? (
            <div className="py-10 text-center text-sm font-semibold text-muted">
              لا توجد قوالب تطابق بحثك. جرب البحث عن كلمة أخرى أو تصفح القوائم.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredTypes.map((type) => {
              const blueprint = PROJECT_BLUEPRINTS[type];
              const BlueprintIcon = blueprint.icon;
              const isSelected = selectedType === type;
              const modulePreview = PROJECT_MODULE_KEYS.filter(
                (key) => blueprint.defaultModules[key],
              );
              const descriptionId = `blueprint-${type}-description`;
              return (
                <label key={type} className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="project-blueprint"
                    value={type}
                    checked={isSelected}
                    onChange={() => onSelect(type)}
                    aria-label={blueprint.name}
                    aria-describedby={descriptionId}
                    className="peer sr-only"
                  />
                  <span
                    className={clsx(
                      "block min-h-44 rounded-md border bg-surface p-4 transition-colors duration-150 motion-reduce:transition-none peer-focus-visible:ring-3 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
                      isSelected
                        ? "border-primary bg-primary-soft"
                        : "border-control-border hover:border-primary",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "grid size-11 shrink-0 place-items-center rounded-sm border",
                          isSelected
                            ? "border-primary bg-primary text-primary-on"
                            : "border-line bg-surface-subtle text-primary-ink",
                        )}
                      >
                        <BlueprintIcon size={21} strokeWidth={1.8} />
                      </span>
                      {isSelected ? (
                        <Badge
                          tone="primary"
                          icon={<Check size={13} strokeWidth={2.5} />}
                        >
                          محدد
                        </Badge>
                      ) : (
                        <span className="text-[11px] font-semibold text-muted">
                          اختر هذا النوع
                        </span>
                      )}
                    </span>
                    <strong className="mt-4 block text-base font-bold text-ink">
                      {blueprint.name}
                    </strong>
                    <span
                      id={descriptionId}
                      className="mt-1.5 block text-xs leading-5 text-muted"
                    >
                      {blueprint.description}
                    </span>
                    <span className="mt-4 flex flex-wrap gap-1.5">
                      {modulePreview.map((key) => (
                        <Badge key={key} tone="neutral">
                          {PROJECT_MODULE_METADATA[key].name}
                        </Badge>
                      ))}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          )}
        </fieldset>
      </AppCard>

      <button
        type="button"
        disabled={!selectedType}
        onClick={onContinue}
        className="pressable mt-5 flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        التالي: جهّز مشروعك
      </button>
    </section>
  );
}
