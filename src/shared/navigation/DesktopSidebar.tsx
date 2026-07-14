import {
  Bell,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  FileText,
  FolderKanban,
  House,
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
  { label: "أموالي · دخلي", to: "/income", icon: BriefcaseBusiness },
  { label: "أموالي · الديون", to: "/debts", icon: Scale },
  { label: "أموالي · فواتير", to: "/invoices", icon: FileText },
  { label: "المحافظ", to: "/wallets", icon: WalletCards },
  { label: "المشاريع", to: "/projects", icon: FolderKanban },
  { label: "العملاء", to: "/clients", icon: Users },
  { label: "التحليلات", to: "/analytics", icon: ChartNoAxesCombined },
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
          "group flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[13px] font-semibold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          isActive
            ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/8%)]"
            : "text-slate-400 hover:translate-x-[-2px] hover:bg-white/6 hover:text-white",
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
      className="hidden h-dvh flex-col overflow-hidden bg-[#111528] text-white lg:sticky lg:top-0 lg:flex"
    >
      <div className="flex h-[76px] items-center border-b border-white/7 px-5">
        <Link to="/" className="flex items-center gap-3" aria-label="ميزان">
          <span className="grid size-10 place-items-center rounded-[11px] bg-primary text-base font-black text-primary-on shadow-[0_10px_28px_rgb(75_82_199/35%)]">
            م
          </span>
          <span>
            <strong className="block text-[15px] font-bold tracking-tight">
              ميزان
            </strong>
            <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
              إدارة مالية موثوقة
            </span>
          </span>
        </Link>
      </div>

      <div className="subtle-scrollbar flex-1 overflow-y-auto px-3 py-5">
        <Link
          to="/transactions/new"
          className="group mb-6 flex min-h-11 items-center justify-between rounded-[10px] bg-primary px-3.5 text-[13px] font-bold text-primary-on shadow-[0_12px_26px_rgb(75_82_199/24%)] transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0"
        >
          <span>إضافة معاملة</span>
          <span className="grid size-7 place-items-center rounded-lg bg-white/14">
            <Plus aria-hidden="true" size={16} />
          </span>
        </Link>

        <nav aria-label="التنقل الرئيسي لسطح المكتب" className="space-y-1">
          {mainItems.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="my-5 h-px bg-white/7" />

        <nav aria-label="الخدمات والإعدادات" className="space-y-1">
          {utilityItems.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
          {profile?.system_role === "supervisor" ? (
            <NavLink
              to="/supervisor"
              className="mt-3 flex min-h-12 items-center gap-3 rounded-[10px] bg-primary/14 px-3 text-[13px] font-bold text-[#bfc3ff] ring-1 ring-inset ring-primary/25 transition-colors hover:bg-primary/22 hover:text-white"
            >
              <ShieldCheck aria-hidden="true" size={18} strokeWidth={1.75} />
              مركز إدارة المنصة
            </NavLink>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-white/7 p-3">
        <Link
          to="/settings/profile"
          className="flex items-center gap-3 rounded-[12px] p-2.5 transition-colors hover:bg-white/6"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-white/9 text-sm font-bold text-white ring-1 ring-inset ring-white/8">
            {getInitial(displayName)}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs font-semibold text-white">
              {displayName}
            </strong>
            <span className="mt-0.5 block truncate text-[10px] text-slate-500">
              {membership?.workspaceName ?? "مساحة ميزان"} · {roleLabel}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
