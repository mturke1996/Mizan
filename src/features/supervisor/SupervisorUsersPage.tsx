import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppCard } from "@/shared/ui/AppCard";
import {
  fetchUserDirectory,
  invalidateSupervisor,
  supervisorKeys,
  supervisorSetAccountStatus,
} from "./supervisor-api";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  SearchField,
  StatusBadge,
} from "./SupervisorUi";
import {
  accountStatusLabel,
  formatDateAr,
  statusTone,
  subscriptionStatusLabel,
} from "./supervisor-utils";

export function SupervisorUsersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const usersQuery = useQuery({
    queryKey: supervisorKeys.users,
    queryFn: fetchUserDirectory,
  });

  const statusMutation = useMutation({
    mutationFn: (input: {
      userId: string;
      status: "active" | "suspended" | "disabled";
    }) => supervisorSetAccountStatus(input.userId, input.status),
    onSuccess: async () => {
      toast.success("تم تحديث حالة الحساب");
      await invalidateSupervisor(queryClient);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    return (usersQuery.data ?? []).filter((user) => {
      if (!normalized) return true;
      return (
        (user.display_name ?? "").toLocaleLowerCase("ar").includes(normalized) ||
        (user.workspace_name ?? "").toLocaleLowerCase("ar").includes(normalized)
      );
    });
  }, [usersQuery.data, query]);

  function updateStatus(
    userId: string,
    status: "active" | "suspended" | "disabled",
  ) {
    if (
      status !== "active" &&
      !window.confirm(
        status === "disabled"
          ? "تعطيل الحساب يمنع صاحبه من استخدام التطبيق. هل أنت متأكد؟"
          : "إيقاف الحساب سيمنع الوصول مؤقتًا. هل أنت متأكد؟",
      )
    ) {
      return;
    }
    statusMutation.mutate({ userId, status });
  }

  return (
    <div className="page-enter space-y-5 pt-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">المستخدمون</h1>
        <p className="mt-1 text-sm text-muted">
          إيقاف أو تفعيل الحسابات — لا يمكن تعديل حسابك.
        </p>
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="بحث بالاسم أو المساحة..."
      />

      {usersQuery.isLoading ? (
        <LoadingBlock rows={4} />
      ) : usersQuery.isError ? (
        <ErrorBlock
          message={
            usersQuery.error instanceof Error
              ? usersQuery.error.message
              : "حاول مرة أخرى"
          }
          onRetry={() => void usersQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyBlock title="لا مستخدمين" description="لا نتائج للبحث." />
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <AppCard key={user.user_id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">
                      {user.display_name || "بدون اسم"}
                    </p>
                    <StatusBadge
                      label={accountStatusLabel[user.account_status] ?? "—"}
                      tone={statusTone(user.account_status)}
                    />
                    {user.subscription_status ? (
                      <StatusBadge
                        label={
                          subscriptionStatusLabel[user.subscription_status] ??
                          user.subscription_status
                        }
                        tone={statusTone(user.subscription_status)}
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {user.workspace_name || "بدون مساحة"} · انضم{" "}
                    {formatDateAr(user.created_at)}
                  </p>
                  <p className="mt-1 text-[10px] text-soft">
                    {user.user_id.slice(0, 8)}…
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {user.account_status !== "active" ? (
                    <button
                      type="button"
                      disabled={statusMutation.isPending}
                      className="pressable min-h-11 rounded-sm bg-success-soft px-3 text-xs font-bold text-success disabled:opacity-50"
                      onClick={() => updateStatus(user.user_id, "active")}
                    >
                      تفعيل
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={statusMutation.isPending}
                        className="pressable min-h-11 rounded-sm bg-warning-soft px-3 text-xs font-bold text-warning disabled:opacity-50"
                        onClick={() => updateStatus(user.user_id, "suspended")}
                      >
                        إيقاف
                      </button>
                      <button
                        type="button"
                        disabled={statusMutation.isPending}
                        className="pressable min-h-11 rounded-sm bg-danger-soft px-3 text-xs font-bold text-danger disabled:opacity-50"
                        onClick={() => updateStatus(user.user_id, "disabled")}
                      >
                        تعطيل
                      </button>
                    </>
                  )}
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      )}
    </div>
  );
}
