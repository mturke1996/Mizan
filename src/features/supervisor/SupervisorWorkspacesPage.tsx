import { Snowflake, TimerReset } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AppCard } from "@/shared/ui/AppCard";
import {
  fetchWorkspaceOverview,
  invalidateSupervisor,
  supervisorExtendTrial,
  supervisorFreeze,
  supervisorKeys,
  supervisorUnfreeze,
} from "./supervisor-api";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  SearchField,
  StatusBadge,
} from "./SupervisorUi";
import {
  daysUntil,
  formatDateAr,
  statusTone,
  subscriptionStatusLabel,
} from "./supervisor-utils";

const filters = [
  { id: "all", label: "الكل" },
  { id: "trialing", label: "تجريبي" },
  { id: "active", label: "نشط" },
  { id: "frozen", label: "مجمّد" },
  { id: "expiring", label: "ينتهي قريبًا" },
  { id: "pending", label: "دفع معلّق" },
] as const;

export function SupervisorWorkspacesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>(
    searchParams.get("filter") ?? "all",
  );

  const workspacesQuery = useQuery({
    queryKey: supervisorKeys.workspaces,
    queryFn: fetchWorkspaceOverview,
  });

  const actionMutation = useMutation({
    mutationFn: async (input: {
      type: "freeze" | "unfreeze" | "extend7" | "extend30";
      workspaceId: string;
    }) => {
      if (input.type === "freeze") await supervisorFreeze(input.workspaceId);
      if (input.type === "unfreeze") await supervisorUnfreeze(input.workspaceId);
      if (input.type === "extend7") {
        await supervisorExtendTrial(input.workspaceId, 7);
      }
      if (input.type === "extend30") {
        await supervisorExtendTrial(input.workspaceId, 30);
      }
    },
    onSuccess: async (_data, variables) => {
      const messages = {
        freeze: "تم التجميد",
        unfreeze: "تم إلغاء التجميد",
        extend7: "تم تمديد 7 أيام",
        extend30: "تم تمديد 30 يومًا",
      };
      toast.success(messages[variables.type]);
      await invalidateSupervisor(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    return (workspacesQuery.data ?? []).filter((row) => {
      const matchesQuery =
        !normalized ||
        row.workspace_name.toLocaleLowerCase("ar").includes(normalized) ||
        (row.owner_display_name ?? "")
          .toLocaleLowerCase("ar")
          .includes(normalized);

      const matchesFilter =
        filter === "all" ||
        (filter === "trialing" && row.subscription_status === "trialing") ||
        (filter === "active" && row.subscription_status === "active") ||
        (filter === "frozen" && row.subscription_status === "frozen") ||
        (filter === "pending" && row.pending_payments > 0) ||
        (filter === "expiring" &&
          row.subscription_status === "trialing" &&
          (daysUntil(row.trial_ends_at) ?? 99) <= 3);

      return matchesQuery && matchesFilter;
    });
  }, [workspacesQuery.data, query, filter]);

  function runAction(
    type: "freeze" | "unfreeze" | "extend7" | "extend30",
    workspaceId: string,
  ) {
    const confirmation = {
      freeze: "تجميد المساحة سيوقف عمليات الكتابة المالية. هل أنت متأكد؟",
      unfreeze: "إلغاء تجميد المساحة وإعادة الوصول للكتابة؟",
      extend7: "تمديد الفترة التجريبية 7 أيام؟",
      extend30: "تمديد الفترة التجريبية 30 يومًا؟",
    }[type];
    if (!window.confirm(confirmation)) return;
    actionMutation.mutate({ type, workspaceId });
  }

  return (
    <div className="page-enter space-y-5 pt-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">مساحات العمل</h1>
        <p className="mt-1 text-sm text-muted">
          تحكم بالاشتراك، التجميد، وتمديد التجربة.
        </p>
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="بحث بالاسم أو المالك..."
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`pressable min-h-11 rounded-full px-3 py-2 text-xs font-bold ${
              filter === item.id
                ? "bg-primary text-primary-on"
                : "bg-surface-subtle text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {workspacesQuery.isLoading ? (
        <LoadingBlock rows={4} />
      ) : workspacesQuery.isError ? (
        <ErrorBlock
          message={
            workspacesQuery.error instanceof Error
              ? workspacesQuery.error.message
              : "حاول مرة أخرى"
          }
          onRetry={() => void workspacesQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          title="لا نتائج"
          description="جرّب تغيير البحث أو الفلتر."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const trialDays = daysUntil(row.trial_ends_at);
            return (
              <AppCard key={row.workspace_id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-ink">{row.workspace_name}</h2>
                      <StatusBadge
                        label={
                          subscriptionStatusLabel[
                            row.subscription_status ?? ""
                          ] ?? "—"
                        }
                        tone={statusTone(row.subscription_status)}
                      />
                      {row.pending_payments > 0 ? (
                        <StatusBadge
                          label={`${row.pending_payments} دفع`}
                          tone="bg-warning-soft text-warning"
                        />
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {row.owner_display_name || "بدون مالك"} ·{" "}
                      {row.plan_name || "بدون خطة"}
                    </p>
                    <div className="mt-3 grid gap-1 text-[11px] text-soft sm:grid-cols-2">
                      <p>
                        التجربة: {formatDateAr(row.trial_ends_at)}
                        {trialDays != null && trialDays >= 0
                          ? ` (${trialDays} يوم)`
                          : ""}
                      </p>
                      <p>
                        الفترة: {formatDateAr(row.current_period_ends_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {row.subscription_status === "frozen" ? (
                      <button
                        type="button"
                        disabled={actionMutation.isPending}
                        className="pressable min-h-11 rounded-sm bg-success-soft px-3 text-xs font-bold text-success disabled:opacity-50"
                        onClick={() =>
                          runAction("unfreeze", row.workspace_id)
                        }
                      >
                        إلغاء التجميد
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionMutation.isPending}
                        className="pressable flex min-h-11 items-center gap-1 rounded-sm bg-info-soft px-3 text-xs font-bold text-info disabled:opacity-50"
                        onClick={() => runAction("freeze", row.workspace_id)}
                      >
                        <Snowflake size={14} />
                        تجميد
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={actionMutation.isPending}
                      className="pressable flex min-h-11 items-center gap-1 rounded-sm bg-warning-soft px-3 text-xs font-bold text-warning disabled:opacity-50"
                      onClick={() => runAction("extend7", row.workspace_id)}
                    >
                      <TimerReset size={14} />
                      +7
                    </button>
                    <button
                      type="button"
                      disabled={actionMutation.isPending}
                      className="pressable min-h-11 rounded-sm bg-primary-soft px-3 text-xs font-bold text-primary disabled:opacity-50"
                      onClick={() => runAction("extend30", row.workspace_id)}
                    >
                      +30 يوم
                    </button>
                  </div>
                </div>
              </AppCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
