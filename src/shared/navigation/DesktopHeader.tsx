import { Bell, Plus, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/use-auth";
import { notificationKeys } from "@/features/notifications/notification-keys";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { getSupabaseClient } from "@/lib/supabase";

interface DesktopHeaderProps {
  onOpenCommandPalette: () => void;
}

export function DesktopHeader({ onOpenCommandPalette }: DesktopHeaderProps) {
  const { user } = useAuth();
  const { membership, refresh, isLoading } = useWorkspace();

  const notificationsQuery = useQuery({
    queryKey: notificationKeys.list(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("notifications")
        .select("id, read_at")
        .eq("user_id", user.id)
        .is("read_at", null)
        .limit(20);
      return data ?? [];
    },
    enabled: Boolean(user?.id),
  });

  const unreadCount = notificationsQuery.data?.length ?? 0;

  return (
    <header
      dir="rtl"
      className="sticky top-0 z-40 hidden h-16 w-full items-center justify-between border-b border-line/70 bg-surface/90 px-6 backdrop-blur-md md:flex"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="pressable flex min-h-10 w-72 items-center justify-between rounded-xl border border-line/80 bg-surface-subtle/80 px-3.5 text-xs font-semibold text-muted hover:border-primary/40 hover:bg-surface hover:text-ink transition-all"
        >
          <span className="flex items-center gap-2">
            <Search size={15} className="text-muted" />
            <span>ابحث أو انتقل سريعًا…</span>
          </span>
          <kbd className="font-mono text-[10px] font-bold text-soft rounded bg-surface px-1.5 py-0.5 border border-line">
            Ctrl+K
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          title="مزامنة البيانات الحالية"
          className="pressable grid size-10 place-items-center rounded-xl border border-line bg-surface hover:bg-surface-subtle text-muted disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-line/70 bg-surface-subtle/70 px-3 py-1.5 text-xs font-bold text-ink">
          <span className="size-2 rounded-full bg-success" />
          {membership?.workspaceName ?? "مساحة ميزان"}
        </span>

        <Link
          to="/notifications"
          className="pressable relative grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink hover:bg-surface-subtle"
          aria-label="الإشعارات"
        >
          <Bell size={17} />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-danger text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Link>

        <Link
          to="/transactions/new"
          className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-on shadow-xs hover:bg-primary-hover transition-transform active:scale-95"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>إضافة معاملة</span>
        </Link>
      </div>
    </header>
  );
}
