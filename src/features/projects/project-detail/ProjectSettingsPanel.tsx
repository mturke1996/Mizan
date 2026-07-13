import { AlertTriangle, LockKeyhole, Settings2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import {
  PROJECT_MODULE_KEYS,
  PROJECT_MODULE_METADATA,
  PROJECT_TYPES,
  getProjectBlueprint,
} from "@/features/projects/project-blueprints";
import { useProjectStore } from "@/features/projects/project-store";
import { useUpdateProjectMutation } from "@/features/workspace/use-finance-data";
import {
  useProjectMembersQuery,
  useSetProjectParentMutation,
  useUpsertProjectMemberMutation,
  useWorkspaceMemberOptionsQuery,
} from "@/features/workspace/use-finance-data";
import { useProjectsView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type {
  ProjectMemberRole,
  ProjectModuleKey,
  ProjectModules,
  ProjectSummary,
  ProjectType,
} from "@/features/workspace/workspace-types";
import { getUserErrorMessage } from "@/lib/user-error";
import { Badge } from "@/shared/ui/Badge";

interface ProjectSettingsPanelProps {
  isDemo: boolean;
  onClose: () => void;
  onSaved: (result: {
    modules: ProjectModules;
    goalMinor?: bigint;
    clearGoal: boolean;
    projectType: ProjectType;
  }) => void;
  project: ProjectSummary;
}

function cloneModules(modules: ProjectModules): ProjectModules {
  return {
    transactions: true,
    goal: modules.goal,
    workers: modules.workers,
    capital: modules.capital,
    inventory: modules.inventory,
    livestock: modules.livestock,
  };
}

function goalInputValue(
  goalMinor: bigint | undefined,
  currency: string,
): string {
  if (goalMinor === undefined) return "";
  return formatMinorAmount(goalMinor, {
    currency,
    locale: "en-US",
  });
}

export function ProjectSettingsPanel({
  isDemo,
  onClose,
  onSaved,
  project,
}: ProjectSettingsPanelProps) {
  const { currency } = useWorkspace();
  const { projects } = useProjectsView();
  const scale = getCurrencyScale(currency);
  const [modules, setModules] = useState(() => cloneModules(project.modules));
  const [projectType, setProjectType] = useState<ProjectType>(
    project.projectType,
  );
  const [parentProjectId, setParentProjectId] = useState(
    project.parentProjectId ?? "",
  );
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] =
    useState<ProjectMemberRole>("contributor");
  const membersQuery = useProjectMembersQuery(isDemo ? undefined : project.id);
  const memberOptionsQuery = useWorkspaceMemberOptionsQuery();
  const upsertMember = useUpsertProjectMemberMutation(project.id);
  const setParent = useSetProjectParentMutation(project.id);
  const parentCandidates = projects.filter(
    (candidate) =>
      candidate.id !== project.id &&
      candidate.status === "active" &&
      !candidate.parentProjectId,
  );
  const [goalAmount, setGoalAmount] = useState(() =>
    goalInputValue(project.goalMinor, currency),
  );
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const updateDemoProject = useProjectStore((state) => state.updateProject);
  const updateProject = useUpdateProjectMutation(project.id);
  const blueprint = getProjectBlueprint(projectType);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const toggleModule = (key: ProjectModuleKey) => {
    if (key === "transactions") return;
    setModules((current) => {
      const next = { ...current, [key]: !current[key] };
      if (key === "goal" && next.goal && !goalAmount.trim() && project.goalMinor) {
        setGoalAmount(goalInputValue(project.goalMinor, currency));
      }
      return next;
    });
  };

  const saveSettings = async () => {
    if (submitLock.current || saving || updateProject.isPending) return;

    const clearGoal = !modules.goal;
    let goalMinor: bigint | undefined;

    if (modules.goal) {
      if (!goalAmount.trim()) {
        toast.error("أدخل هدف الإيرادات أو عطّل وحدة الهدف");
        return;
      }
      try {
        goalMinor = parseMajorAmount(goalAmount, scale);
      } catch {
        toast.error("أدخل هدفًا ماليًا صحيحًا");
        return;
      }
      if (goalMinor <= 0n) {
        toast.error("يجب أن يكون هدف الإيرادات أكبر من صفر");
        return;
      }
    }

    submitLock.current = true;
    setSaving(true);

    try {
      if (isDemo) {
        updateDemoProject(project.id, {
          projectType,
          modules,
          parentProjectId: parentProjectId || null,
          ...(clearGoal
            ? { goalMinor: undefined, progress: 0 }
            : {
                goalMinor,
                progress:
                  goalMinor && project.incomeMinor > 0n
                    ? Number(
                        (project.incomeMinor * 100n) / goalMinor > 100n
                          ? 100n
                          : (project.incomeMinor * 100n) / goalMinor,
                      )
                    : 0,
              }),
        });
      } else {
        await updateProject.mutateAsync({
          projectType,
          modules,
          clearGoal,
          ...(clearGoal || goalMinor === undefined
            ? {}
            : { goalMinor: toSafeMinorNumber(goalMinor) }),
        });
        const nextParent = parentProjectId || null;
        if ((project.parentProjectId ?? null) !== nextParent) {
          await setParent.mutateAsync(nextParent);
        }
      }
      onSaved({
        modules,
        clearGoal,
        projectType,
        ...(goalMinor === undefined ? {} : { goalMinor }),
      });
      toast.success("تم تحديث إعدادات المشروع");
    } catch (error) {
      toast.error(
        getUserErrorMessage(
          error,
          "تعذر حفظ إعدادات المشروع. حاول مرة أخرى.",
        ),
      );
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="project-settings-title"
      aria-modal={false}
      className="mb-5 rounded-lg border border-line bg-surface p-4 [box-shadow:var(--shadow-card)] sm:p-6"
      id="project-settings-panel"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) onClose();
      }}
      role="dialog"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-primary-soft text-primary-ink">
            <Settings2 aria-hidden="true" size={19} />
          </span>
          <div>
            <h2
              className="font-bold text-ink outline-none"
              id="project-settings-title"
              ref={titleRef}
              tabIndex={-1}
            >
              إعدادات المشروع
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              فعّل الأقسام التي يحتاج إليها تشغيل المشروع الآن.
            </p>
          </div>
        </div>
        <button
          aria-label="إغلاق الإعدادات"
          className="pressable grid size-11 shrink-0 place-items-center rounded-sm border border-line bg-surface text-muted hover:bg-surface-subtle hover:text-ink"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="mt-5">
        <label
          className="mb-2 block text-xs font-semibold text-muted"
          htmlFor="project-type-select"
        >
          نوع المشروع
        </label>
        <select
          className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm text-ink"
          disabled={saving}
          id="project-type-select"
          onChange={(event) =>
            setProjectType(event.target.value as ProjectType)
          }
          value={projectType}
        >
          {PROJECT_TYPES.map((type) => (
            <option key={type} value={type}>
              {getProjectBlueprint(type).name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-muted">
          تغيير النوع لا يحذف بيانات الوحدات المخفية. النوع الحالي:{" "}
          <Badge tone="primary">{blueprint.name}</Badge>
        </p>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-bold text-ink">وحدات المشروع</legend>
        <div className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line">
          {PROJECT_MODULE_KEYS.map((key) => {
            const metadata = PROJECT_MODULE_METADATA[key];
            const locked = metadata.required;
            const inputId = `project-module-${key}`;
            return (
              <label
                className="flex min-h-20 cursor-pointer items-start gap-3 bg-surface px-4 py-3.5 has-[:checked]:bg-primary-soft/45"
                htmlFor={inputId}
                key={key}
              >
                <input
                  aria-label={metadata.name}
                  checked={modules[key]}
                  className="mt-1 size-5 accent-primary"
                  disabled={locked || saving}
                  id={inputId}
                  onChange={() => toggleModule(key)}
                  type="checkbox"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                    {metadata.name}
                    {locked ? (
                      <Badge
                        icon={<LockKeyhole aria-hidden="true" size={12} />}
                        tone="neutral"
                      >
                        أساسية
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    {metadata.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {modules.goal ? (
        <div className="mt-5">
          <label
            className="mb-2 block text-sm font-bold text-ink"
            htmlFor="project-goal-amount"
          >
            هدف الإيرادات ({currency})
          </label>
          <input
            className="numeric min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-left text-sm"
            dir="ltr"
            disabled={saving}
            id="project-goal-amount"
            inputMode="decimal"
            onChange={(event) => setGoalAmount(event.target.value)}
            placeholder={`0.${"0".repeat(scale)}`}
            value={goalAmount}
          />
          <p className="mt-2 text-xs leading-5 text-muted">
            يظهر شريط التقدم في نظرة عامة المشروع بعد حفظ الهدف.
          </p>
        </div>
      ) : null}

      <div className="mt-5">
        <label
          className="mb-2 block text-xs font-semibold text-muted"
          htmlFor="project-parent-select"
        >
          المشروع الأب (اختياري)
        </label>
        <select
          className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm text-ink"
          disabled={saving}
          id="project-parent-select"
          onChange={(event) => setParentProjectId(event.target.value)}
          value={parentProjectId}
        >
          <option value="">بدون مشروع أب</option>
          {parentCandidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-muted">
          مستوى واحد فقط: مشروع فرعي تحت أب مباشر.
        </p>
      </div>

      {!isDemo ? (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-bold text-ink">أعضاء المشروع</h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <select
              aria-label="عضو المساحة"
              className="min-h-11 rounded-md border border-control-border bg-surface px-3 text-sm"
              onChange={(event) => setMemberUserId(event.target.value)}
              value={memberUserId}
            >
              <option value="">اختر عضوًا</option>
              {(memberOptionsQuery.data ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName || member.userId.slice(0, 8)}
                </option>
              ))}
            </select>
            <select
              aria-label="دور العضو"
              className="min-h-11 rounded-md border border-control-border bg-surface px-3 text-sm"
              onChange={(event) =>
                setMemberRole(event.target.value as ProjectMemberRole)
              }
              value={memberRole}
            >
              <option value="manager">مدير</option>
              <option value="contributor">مساهم</option>
              <option value="viewer">مشاهد</option>
            </select>
            <button
              className="pressable min-h-11 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on disabled:opacity-60"
              disabled={!memberUserId || upsertMember.isPending}
              onClick={() => {
                void upsertMember
                  .mutateAsync({ userId: memberUserId, role: memberRole })
                  .then(() => {
                    setMemberUserId("");
                    toast.success("تم حفظ عضو المشروع");
                  })
                  .catch((error) =>
                    toast.error(
                      getUserErrorMessage(error, "تعذر حفظ عضو المشروع"),
                    ),
                  );
              }}
              type="button"
            >
              إضافة
            </button>
          </div>
          <ul className="space-y-1 text-xs text-muted">
            {(membersQuery.data ?? []).map((member) => (
              <li key={`${member.userId}-${member.role}`}>
                {member.displayName || member.userId.slice(0, 8)} · {member.role}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex items-start gap-2 rounded-sm bg-warning-soft px-3 py-2.5 text-xs leading-5 text-warning">
        <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
        <p>
          إخفاء الوحدة لا يحذف بياناتها السابقة. تعطيل الهدف يزيل الهدف من
          العرض مع الاحتفاظ ببقية بيانات المشروع.
        </p>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          className="pressable min-h-11 rounded-sm border border-line-strong bg-surface px-4 text-sm font-bold text-ink hover:bg-surface-subtle"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          إلغاء
        </button>
        <button
          className="pressable min-h-11 rounded-sm bg-primary px-5 text-sm font-bold text-primary-on hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
          disabled={saving || updateProject.isPending}
          onClick={() => void saveSettings()}
          type="button"
        >
          {saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
        </button>
      </div>
    </section>
  );
}
