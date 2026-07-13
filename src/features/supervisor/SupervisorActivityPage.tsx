import { useQuery } from "@tanstack/react-query";
import { AppCard } from "@/shared/ui/AppCard";
import { fetchRecentActivity, supervisorKeys } from "./supervisor-api";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "./SupervisorUi";
import {
  formatDateAr,
  subscriptionStatusLabel,
  supervisorEventLabel,
} from "./supervisor-utils";

export function SupervisorActivityPage() {
  const activityQuery = useQuery({
    queryKey: supervisorKeys.activity,
    queryFn: fetchRecentActivity,
  });

  const events = activityQuery.data ?? [];

  return (
    <div className="page-enter space-y-5 pt-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">سجل النشاط</h1>
        <p className="mt-1 text-sm text-muted">
          آخر 50 حدث اشتراك وتدخل إداري.
        </p>
      </div>

      {activityQuery.isLoading ? (
        <LoadingBlock rows={5} />
      ) : activityQuery.isError ? (
        <ErrorBlock
          message={
            activityQuery.error instanceof Error
              ? activityQuery.error.message
              : "حاول مرة أخرى"
          }
          onRetry={() => void activityQuery.refetch()}
        />
      ) : events.length === 0 ? (
        <EmptyBlock
          title="السجل فارغ"
          description="ستظهر هنا أحداث الاشتراك والمدفوعات."
        />
      ) : (
        <div className="relative space-y-0">
          {events.map((event, index) => (
            <div key={event.id} className="relative flex gap-4 pb-6">
              {index < events.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-3 bottom-0 right-[7px] w-px bg-line"
                />
              ) : null}
              <span
                aria-hidden="true"
                className="relative z-10 mt-1 size-3.5 shrink-0 rounded-full border-2 border-primary bg-surface"
              />
              <AppCard className="min-w-0 flex-1 p-4">
                <p className="font-bold text-ink">
                  {supervisorEventLabel[event.event_type] ?? event.event_type}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {subscriptionStatusLabel[event.from_status ?? ""] ??
                    event.from_status ??
                    "—"}{" "}
                  →{" "}
                  {subscriptionStatusLabel[event.to_status ?? ""] ??
                    event.to_status ??
                    "—"}
                </p>
                <p className="mt-2 text-[11px] text-soft">
                  {formatDateAr(event.created_at)} · مساحة{" "}
                  {event.workspace_id.slice(0, 8)}…
                </p>
              </AppCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
