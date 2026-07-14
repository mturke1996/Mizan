import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "@/features/auth/use-auth";
import {
  cacheOfflineMembership,
  readOfflineMembership,
} from "@/lib/offline-bootstrap";
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
  const [offlineCached, setOfflineCached] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMembership(null);
      setError(null);
      setIsLoading(false);
      setOfflineCached(false);
      return;
    }

    setIsLoading(true);
    try {
      const next = await fetchUserWorkspace(userId);
      if (next) {
        cacheOfflineMembership(userId, next);
        setMembership(next);
        setError(null);
        setOfflineCached(false);
      } else {
        const cached = readOfflineMembership(userId);
        if (cached) {
          setMembership(cached);
          setError(null);
          setOfflineCached(true);
        } else {
          setMembership(null);
          setError("لم يتم العثور على مساحة عمل");
          setOfflineCached(false);
        }
      }
    } catch (err) {
      const cached = readOfflineMembership(userId);
      if (cached) {
        setMembership(cached);
        setError(null);
        setOfflineCached(true);
      } else {
        setMembership(null);
        setError(
          err instanceof Error ? err.message : "تعذر تحميل مساحة العمل",
        );
        setOfflineCached(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (value) return;
    if (authLoading) return;
    // Defer cache hydrate + refresh so we don't sync-setState inside the effect body.
    const timeoutId = window.setTimeout(() => {
      if (userId) {
        const cached = readOfflineMembership(userId);
        if (cached) {
          setMembership(cached);
          setOfflineCached(true);
          setIsLoading(false);
        }
      }
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [authLoading, refresh, userId, value]);

  // Re-sync when the browser comes back online.
  useEffect(() => {
    if (value || !userId) return;
    const onOnline = () => {
      void refresh();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh, userId, value]);

  const liveValue = useMemo<WorkspaceContextValue>(
    () => ({
      membership,
      workspaceId: membership?.workspaceId ?? null,
      currency: membership?.currency ?? "LYD",
      isLoading: authLoading || isLoading,
      error,
      refresh,
      isDemo: false,
      isOfflineCache: offlineCached,
    }),
    [membership, authLoading, isLoading, error, refresh, offlineCached],
  );

  return (
    <WorkspaceContext.Provider value={value ?? liveValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}
