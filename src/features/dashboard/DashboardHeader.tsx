import { Bell, ChartNoAxesCombined, Menu, Scale } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/use-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { getArabicGreeting } from "@/lib/date";
import { notificationKeys } from "@/features/notifications/notification-keys";
import { MoreNavSheet } from "@/shared/navigation/MoreNavSheet";

interface DashboardHeaderProps {
  now: Date;
}

function getInitial(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0) : "م";
}

export function DashboardHeader({ now }: DashboardHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { profile, user } = useAuth();
  const displayName =
    profile?.display_name?.trim() ||
    (user?.user_metadata?.display_name as string | undefined)?.trim() ||
    "مستخدم ميزان";
  const unreadQuery = useQuery({
    queryKey: notificationKeys.unread(user?.id),
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
    <>
      <header className="dashboard-header-safe flex items-center justify-between border-b border-line/70 bg-canvas px-4 pb-2.5 sm:px-6 md:min-h-[76px] md:border-line md:bg-surface md:px-6 md:py-0 lg:px-8 xl:px-10">
        <h1 className="sr-only">ملخصك المالي</h1>
        <div className="flex min-w-0 items-center gap-2.5 md:hidden">
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="فتح القائمة"
            className="pressable flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10"
          >
            <span className="text-sm font-bold">{getInitial(displayName)}</span>
          </button>
          <div className="min-w-0">
            <p className="text-[10px] leading-none text-muted">
              {getArabicGreeting(now)}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold tracking-tight text-ink">
              {displayName}
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <p className="text-lg font-bold tracking-tight text-ink">
            ملخصك المالي
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {getArabicGreeting(now)}، راقب أموالك من مكان واحد
          </p>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-full border border-line/80 bg-canvas p-0.5">
            <Link
              to="/debts"
              aria-label="الديون"
              className="pressable flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-warning-soft hover:text-warning md:size-10"
            >
              <Scale aria-hidden="true" size={18} strokeWidth={1.7} />
            </Link>
            <Link
              to="/analytics"
              aria-label="التحليلات"
              className="pressable flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-primary-soft hover:text-primary md:size-10"
            >
              <ChartNoAxesCombined
                aria-hidden="true"
                size={18}
                strokeWidth={1.7}
              />
            </Link>
            <Link
              to="/notifications"
              aria-label="الإشعارات"
              className="pressable relative flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-primary-soft hover:text-primary md:size-10"
            >
              <Bell aria-hidden="true" size={18} strokeWidth={1.7} />
              {unreadCount > 0 ? (
                <span className="absolute top-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-full bg-danger text-[8px] font-bold text-danger-on">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="المزيد"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className="pressable flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-subtle hover:text-ink md:hidden"
          >
            <Menu aria-hidden="true" size={20} strokeWidth={1.7} />
          </button>
          <Link
            to="/settings/profile"
            aria-label={`الملف الشخصي: ${displayName}`}
            className="pressable mr-1 hidden min-h-11 items-center gap-2.5 rounded-[10px] border border-line bg-canvas px-2.5 md:flex"
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
      <MoreNavSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
