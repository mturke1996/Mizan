import {
  Bell,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  FileBarChart2,
  FileText,
  FolderKanban,
  House,
  PiggyBank,
  Plus,
  ReceiptText,
  Scale,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/features/auth/use-auth";
import { useWorkspace } from "@/features/workspace/use-workspace";

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

const mainItems: NavigationItem[] = [
  { label: "لوحة الملخص", to: "/", icon: House, end: true },
  { label: "المعاملات", to: "/transactions", icon: ReceiptText },
  { label: "المحافظ", to: "/wallets", icon: WalletCards },
  { label: "دخلي", to: "/income", icon: BriefcaseBusiness },
  { label: "الديون", to: "/debts", icon: Scale },
  { label: "فواتير", to: "/invoices", icon: FileText },
  { label: "المشاريع", to: "/projects", icon: FolderKanban },
  { label: "العملاء", to: "/clients", icon: Users },
  { label: "التحليلات", to: "/analytics", icon: ChartNoAxesCombined },
  { label: "التقارير", to: "/reports", icon: FileBarChart2 },
  { label: "الميزانيات", to: "/budgets", icon: PiggyBank },
];

const utilityItems: NavigationItem[] = [
  { label: "الإشعارات", to: "/notifications", icon: Bell },
  { label: "الإعدادات", to: "/settings", icon: Settings },
];

function getInitial(value: string): string {
  return value.trim().charAt(0) || "م";
}

function SidebarLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={item.to === "/notifications" ? "مركز الإشعارات" : undefined}
      className={({ isActive }) =>
        [
          "group flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[13px] font-semibold transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          isActive
            ? "bg-primary-soft text-primary font-bold shadow-xs border border-primary/20"
            : "text-muted hover:translate-x-[-2px] hover:bg-surface-subtle hover:text-ink",
        ].join(" ")
      }
    >
      <Icon
        aria-hidden="true"
        size={18}
        strokeWidth={1.75}
        className="shrink-0"
      />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function DesktopSidebar() {
  const { profile, user } = useAuth();
  const { membership } = useWorkspace();
  const displayName =
    profile?.display_name?.trim() ||
    (user?.user_metadata?.display_name as string | undefined)?.trim() ||
    "مستخدم ميزان";
  const roleLabel = {
    owner: "مالك المساحة",
    admin: "مدير المساحة",
    member: "عضو",
    viewer: "مشاهدة فقط",
  }[membership?.role ?? "viewer"];

  return (
    <aside
      dir="rtl"
      className="hidden h-dvh flex-col overflow-hidden border-e border-line bg-surface text-ink md:sticky md:top-0 md:flex"
    >
      <div className="flex h-[76px] items-center border-b border-line px-5">
        <Link to="/" className="flex items-center gap-3.5 group" aria-label="ميزان">
          <img 
            src="/icons/mizan-mark.svg" 
            alt="شعار ميزان" 
            className="size-10 rounded-[12px] shadow-[0_8px_24px_rgba(16,185,129,0.25)] transition-transform duration-200 group-hover:scale-105"
          />
          <span>
            <strong className="block text-[16px] font-extrabold tracking-tight text-ink group-hover:text-primary transition-colors">
              ميزان
            </strong>
            <span className="mt-0.5 block text-[10px] font-bold text-primary">
              إدارة أموالك بوضوح
            </span>
          </span>
        </Link>
      </div>

      <div className="subtle-scrollbar flex-1 overflow-y-auto px-3 py-5">
        <Link
          to="/transactions/new"
          className="group mb-6 flex min-h-11 items-center justify-between rounded-[12px] bg-primary px-3.5 text-[13px] font-bold text-primary-on shadow-md transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0"
        >
          <span>إضافة معاملة</span>
          <span className="grid size-7 place-items-center rounded-lg bg-white/20">
            <Plus aria-hidden="true" size={16} />
          </span>
        </Link>

        <nav aria-label="التنقل الرئيسي لسطح المكتب" className="space-y-1">
          {mainItems.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="my-5 h-px bg-line" />

        <nav aria-label="الخدمات والإعدادات" className="space-y-1">
          {utilityItems.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
          {profile?.system_role === "supervisor" ? (
            <NavLink
              to="/supervisor"
              className="mt-3 flex min-h-12 items-center gap-3 rounded-[12px] bg-primary-soft px-3 text-[13px] font-bold text-primary ring-1 ring-inset ring-primary/25 transition-colors hover:bg-primary/22 hover:text-ink"
            >
              <ShieldCheck aria-hidden="true" size={18} strokeWidth={1.75} />
              مركز إدارة المنصة
            </NavLink>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-line p-3">
        <Link
          to="/settings/profile"
          className="flex items-center gap-3 rounded-[12px] p-2.5 transition-colors hover:bg-surface-subtle"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-primary-soft text-sm font-bold text-primary ring-1 ring-inset ring-primary/20">
            {getInitial(displayName)}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs font-semibold text-ink">
              {displayName}
            </strong>
            <span className="mt-0.5 block truncate text-[10px] text-muted">
              {membership?.workspaceName ?? "مساحة ميزان"} · {roleLabel}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
