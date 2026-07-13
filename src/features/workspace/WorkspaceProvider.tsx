import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "@/features/auth/use-auth";
import { fetchUserWorkspace } from "./workspace-api";
import type { WorkspaceMembership } from "./workspace-types";
import {
  WorkspaceContext,
  type WorkspaceContextValue,
} from "./workspace-context";

export type { WorkspaceContextValue } from "./workspace-context";

export function WorkspaceProvider({
  children,
  value,
}: PropsWithChildren<{ value?: WorkspaceContextValue }>) {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const [membership, setMembership] = useState<WorkspaceMembership | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(!value);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMembership(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const next = await fetchUserWorkspace(userId);
      setMembership(next);
      setError(next ? null : "لم يتم العثور على مساحة عمل");
    } catch (err) {
      setMembership(null);
      setError(err instanceof Error ? err.message : "تعذر تحميل مساحة العمل");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (value) return;
    if (authLoading) return;
    const timeoutId = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [authLoading, refresh, value]);

  const liveValue = useMemo<WorkspaceContextValue>(
    () => ({
      membership,
      workspaceId: membership?.workspaceId ?? null,
      currency: membership?.currency ?? "LYD",
      isLoading: authLoading || isLoading,
      error,
      refresh,
      isDemo: false,
    }),
    [membership, authLoading, isLoading, error, refresh],
  );

  return (
    <WorkspaceContext.Provider value={value ?? liveValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}

