import {
  Activity,
  ArrowRight,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Package,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/use-auth";
import { fetchPlatformStats, supervisorKeys } from "./supervisor-api";

const navGroups = [
  {
    label: "التشغيل",
    items: [
      {
        to: "/supervisor",
        label: "مركز العمليات",
        icon: LayoutDashboard,
        end: true,
      },
    ],
  },
  {
    label: "العملاء",
    items: [
      { to: "/supervisor/customers", label: "العملاء", icon: Users },
      {
        to: "/supervisor/subscriptions",
        label: "الاشتراكات",
        icon: RefreshCw,
      },
    ],
  },
  {
    label: "الفوترة",
    items: [
      {
        to: "/supervisor/payments",
        label: "المدفوعات",
        icon: CreditCard,
        badgeKey: "payments" as const,
      },
      { to: "/supervisor/plans", label: "الخطط", icon: Package },
      { to: "/supervisor/revenue", label: "الإيرادات", icon: TrendingUp },
    ],
  },
  {
    label: "التواصل",
    items: [
      { to: "/supervisor/messages", label: "الرسائل", icon: MessageSquare },
    ],
  },
  {
    label: "الحوكمة",
    items: [
      { to: "/supervisor/audit", label: "سجل التدقيق", icon: Activity },
    ],
  },
];

export function SupervisorNav() {
  const { profile } = useAuth();
  const displayName = profile?.display_name?.trim() || "مدير المنصة";
  const statsQuery = useQuery({
    queryKey: supervisorKeys.stats,
    queryFn: fetchPlatformStats,
    staleTime: 30_000,
  });
  const pendingPayments = statsQuery.data?.pending_payments ?? 0;

  function renderBadge(badgeKey?: "payments") {
    if (badgeKey !== "payments" || pendingPayments <= 0) return null;
    return (
      <span className="ms-auto inline-flex min-w-5 items-center justify-center rounded-sm bg-warning px-1.5 text-[10px] font-bold text-warning-on">
        {pendingPayments > 99 ? "99+" : pendingPayments}
      </span>
    );
  }

  return (
    <>
      <aside
        dir="rtl"
        className="hidden h-dvh flex-col overflow-hidden bg-[#111528] text-white lg:sticky lg:top-0 lg:flex"
      >
        <div className="flex h-[76px] items-center border-b border-white/7 px-5">
          <Link to="/supervisor" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[11px] bg-primary text-primary-on shadow-[0_10px_28px_rgb(75_82_199/35%)]">
              <Shield aria-hidden="true" size={19} />
            </span>
            <span>
              <strong className="block text-[14px] font-bold">إدارة ميزان</strong>
              <span className="mt-0.5 block text-[10px] text-slate-500">
                مركز تشغيل المنصة
              </span>
            </span>
          </Link>
        </div>

        <nav
          aria-label="تنقل لوحة المدير لسطح المكتب"
          className="subtle-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-5"
        >
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[9px] font-bold tracking-[0.12em] text-slate-600">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <NavLink
                      key={tab.to}
                      to={tab.to}
                      end={"end" in tab ? tab.end : false}
                      className={({ isActive }) =>
                        [
                          "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[13px] font-semibold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                          isActive
                            ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/8%)]"
                            : "text-slate-400 hover:translate-x-[-2px] hover:bg-white/6 hover:text-white",
                        ].join(" ")
                      }
                    >
                      <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                      {tab.label}
                      {renderBadge(
                        "badgeKey" in tab ? tab.badgeKey : undefined,
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/7 p-3">
          <Link
            to="/"
            className="mb-2 flex min-h-11 items-center justify-between rounded-[10px] bg-white/5 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/9 hover:text-white"
          >
            <span>العودة إلى التطبيق</span>
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
          <div className="flex items-center gap-3 rounded-[11px] px-2 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-primary/18 text-xs font-bold text-[#c9ccff] ring-1 ring-inset ring-primary/25">
              {displayName.charAt(0)}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs font-semibold text-white">
                {displayName}
              </strong>
              <span className="mt-0.5 block text-[10px] text-slate-500">
                صلاحية مشرف النظام
              </span>
            </span>
          </div>
        </div>
      </aside>

      <header
        dir="rtl"
        className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-xl lg:hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
              <Shield aria-hidden="true" size={20} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">إدارة ميزان</p>
              <p className="text-[10px] text-muted">مركز تشغيل المنصة</p>
            </div>
          </div>
          <Link
            to="/"
            className="pressable flex min-h-10 items-center gap-1.5 rounded-[9px] px-3 text-xs font-bold text-primary hover:bg-primary-soft"
          >
            التطبيق
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>

        <nav
          aria-label="تنقل لوحة المدير"
          className="flex gap-1.5 overflow-x-auto px-4 pb-3 sm:px-6 [scrollbar-width:none]"
        >
          {navGroups.flatMap((group) =>
            group.items.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={"end" in tab ? tab.end : false}
                  className={({ isActive }) =>
                    [
                      "pressable flex min-h-10 shrink-0 items-center gap-1.5 rounded-[9px] px-3 py-2 text-[11px] font-bold transition-colors",
                      isActive
                        ? "bg-primary text-primary-on"
                        : "bg-surface-subtle text-muted hover:text-ink",
                    ].join(" ")
                  }
                >
                  <Icon aria-hidden="true" size={14} />
                  {tab.label}
                  {"badgeKey" in tab &&
                  tab.badgeKey === "payments" &&
                  pendingPayments > 0 ? (
                    <span className="inline-flex min-w-4 items-center justify-center rounded-sm bg-warning px-1 text-[9px] font-bold text-warning-on">
                      {pendingPayments > 99 ? "99+" : pendingPayments}
                    </span>
                  ) : null}
                </NavLink>
              );
            }),
          )}
        </nav>
      </header>
    </>
  );
}
