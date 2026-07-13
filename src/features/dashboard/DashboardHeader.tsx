import { Bell, ChartNoAxesCombined, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/use-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { getArabicGreeting } from "@/lib/date";

interface DashboardHeaderProps {
  now: Date;
}

function getInitial(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0) : "م";
}

export function DashboardHeader({ now }: DashboardHeaderProps) {
  const { profile, user } = useAuth();
  const displayName =
    profile?.display_name?.trim() ||
    (user?.user_metadata?.display_name as string | undefined)?.trim() ||
    "مستخدم ميزان";
  const unreadQuery = useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const unreadCount = unreadQuery.data ?? 0;

  return (
    <header className="safe-top flex items-center justify-between border-b border-line bg-surface px-4 pb-4 sm:px-6 lg:min-h-[76px] lg:px-8 lg:py-0 xl:px-10">
      <h1 className="sr-only">ملخصك المالي</h1>
      <div className="flex items-center gap-3 lg:hidden">
        <Link
          to="/settings"
          aria-label="فتح الإعدادات"
          className="pressable flex size-12 items-center justify-center rounded-full border border-line bg-surface text-ink [box-shadow:var(--shadow-card)]"
        >
          <span className="text-lg font-bold">{getInitial(displayName)}</span>
        </Link>
        <div>
          <p className="text-sm text-muted">{getArabicGreeting(now)}</p>
          <p className="font-semibold text-ink">{displayName}</p>
        </div>
      </div>

      <div className="hidden lg:block">
        <p className="text-lg font-bold tracking-tight text-ink">
          ملخصك المالي
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {getArabicGreeting(now)}، راقب أموالك من مكان واحد
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 rounded-full border border-line/80 bg-canvas/80 p-1">
          <Link
            to="/analytics"
            aria-label="التحليلات"
            className="pressable flex size-10 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-primary-soft hover:text-primary"
          >
            <ChartNoAxesCombined
              aria-hidden="true"
              size={20}
              strokeWidth={1.7}
            />
          </Link>
          <Link
            to="/notifications"
            aria-label="الإشعارات"
            className="pressable relative flex size-10 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-primary-soft hover:text-primary"
          >
            <Bell aria-hidden="true" size={20} strokeWidth={1.7} />
            {unreadCount > 0 ? (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-danger-on">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>
        </div>
        <Link
          to="/settings"
          aria-label="القائمة والإعدادات"
          className="pressable flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-subtle hover:text-ink lg:hidden"
        >
          <Menu aria-hidden="true" size={22} strokeWidth={1.7} />
        </Link>
        <Link
          to="/settings/profile"
          aria-label={`الملف الشخصي: ${displayName}`}
          className="pressable mr-1 hidden min-h-11 items-center gap-2.5 rounded-[10px] border border-line bg-canvas px-2.5 lg:flex"
        >
          <span className="grid size-8 place-items-center rounded-[9px] bg-primary-soft text-xs font-bold text-primary">
            {getInitial(displayName)}
          </span>
          <span className="hidden text-right xl:block">
            <strong className="block max-w-28 truncate text-xs font-semibold text-ink">
              {displayName}
            </strong>
            <span className="block text-[10px] text-muted">الحساب الشخصي</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
