import {
  FolderKanban,
  House,
  ReceiptText,
  Scale,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

const navigationItems: NavigationItem[] = [
  { label: "الرئيسية", to: "/", icon: House, end: true },
  { label: "المعاملات", to: "/transactions", icon: ReceiptText },
  { label: "المشاريع", to: "/projects", icon: FolderKanban },
  { label: "المحافظ", to: "/wallets", icon: WalletCards },
  { label: "الديون", to: "/debts", icon: Scale },
];

export function BottomNavigation() {
  return (
    <nav
      dir="rtl"
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-3xl border-t border-line bg-surface/95 px-2 pt-2 pb-[max(8px,var(--safe-bottom))] [box-shadow:var(--shadow-nav)] backdrop-blur-xl lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    "pressable mx-auto flex min-h-14 w-full max-w-20 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium",
                    isActive
                      ? "bg-primary-soft text-primary-ink"
                      : "text-muted hover:bg-surface-subtle hover:text-ink",
                  ].join(" ")
                }
              >
                <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
