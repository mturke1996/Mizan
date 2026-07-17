import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePostRecurringDue } from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";

/**
 * Posts any recurring transactions that are due, then invalidates the affected
 * queries (handled in the mutation). Runs once on mount and again when the
 * tab regains focus or the browser comes back online. Calls are debounced so a
 * burst of focus/online events never triggers more than one batch per 30s.
 */
export function RecurringDuePoster() {
  const { workspaceId, isDemo = false } = useWorkspace();
  const postDue = usePostRecurringDue();
  const postRef = useRef(postDue);
  const lastRun = useRef(0);

  useEffect(() => {
    postRef.current = postDue;
  }, [postDue]);

  useEffect(() => {
    if (!workspaceId || isDemo) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const run = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const now = Date.now();
      if (now - lastRun.current < 30_000) return;
      lastRun.current = now;
      void postRef.current
        .mutateAsync()
        .then((count) => {
          if (count > 0) {
            toast.success(`تم ترحيل ${count} حركة متكررة مستحقة`);
          }
        })
        .catch(() => undefined);
    };

    run();
    window.addEventListener("online", run);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.removeEventListener("online", run);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [workspaceId, isDemo]);

  return null;
}
