import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/features/auth/use-auth";
import {
  deliverInboxToDevice,
  initDeviceNotifications,
} from "@/lib/local-notifications";
import { getSupabaseClient } from "@/lib/supabase";

const POLL_MS = 45_000;

async function fetchRecentUnread(userId: string) {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, kind, created_at")
    .eq("user_id", userId)
    .is("read_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    createdAt: row.created_at,
  }));
}

/**
 * Schedules daily motivational device alerts and mirrors inbox rows
 * to the Android notification shade while the session is active.
 */
export function DeviceNotificationsBridge() {
  const { user, session } = useAuth();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!session?.user.id) return;
    void initDeviceNotifications();
  }, [session?.user.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function syncInbox() {
      if (cancelled || syncingRef.current) return;
      syncingRef.current = true;
      try {
        const rows = await fetchRecentUnread(user!.id);
        if (!cancelled) await deliverInboxToDevice(rows);
      } catch {
        // Offline / RLS — silent.
      } finally {
        syncingRef.current = false;
      }
    }

    void syncInbox();
    const poll = window.setInterval(() => void syncInbox(), POLL_MS);

    let removeAppListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void import("@capacitor/app").then(({ App }) => {
        const sub = App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void syncInbox();
        });
        void sub.then((handle) => {
          removeAppListener = () => {
            void handle.remove();
          };
        });
      });
    } else {
      const onFocus = () => void syncInbox();
      window.addEventListener("focus", onFocus);
      removeAppListener = () => window.removeEventListener("focus", onFocus);
    }

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`device-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            title: string;
            body: string;
            kind: string;
            created_at: string;
            read_at: string | null;
          };
          if (row.read_at) return;
          void deliverInboxToDevice([
            {
              id: row.id,
              title: row.title,
              body: row.body,
              kind: row.kind,
              createdAt: row.created_at,
            },
          ]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      removeAppListener?.();
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
