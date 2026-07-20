import {
  FolderKanban,
  House,
  ReceiptText,
  Scale,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  matchPrefixes?: string[];
}

const navigationItems: NavigationItem[] = [
  { label: "الرئيسية", to: "/", icon: House, end: true },
  { label: "المعاملات", to: "/transactions", icon: ReceiptText },
  {
    label: "أموالي",
    to: "/debts",
    icon: Scale,
    matchPrefixes: ["/income", "/debts", "/invoices"],
  },
  { label: "المشاريع", to: "/projects", icon: FolderKanban },
  {
    label: "المحافظ",
    to: "/wallets",
    icon: WalletCards,
    matchPrefixes: ["/wallets", "/transfer"],
  },
];

function isItemActive(pathname: string, item: NavigationItem, navActive: boolean) {
  if (item.matchPrefixes) {
    return item.matchPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  }
  return navActive;
}

export function BottomNavigation() {
  const { pathname } = useLocation();

  return (
    <nav
      dir="rtl"
      aria-label="التنقل الرئيسي"
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-384 border-t border-line bg-surface px-1.5 pt-1 [box-shadow:var(--shadow-nav)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <NavLink
                to={item.to}
                end={item.end}
                aria-label={item.label}
                className={({ isActive }) => {
                  const active = isItemActive(pathname, item, isActive);
                  return [
                    "pressable flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-[10px] font-bold transition-colors",
                    active ? "text-primary" : "text-muted",
                  ].join(" ");
                }}
              >
                {({ isActive }) => {
                  const active = isItemActive(pathname, item, isActive);
                  return (
                    <>
                      <span
                        className={[
                          "grid size-8 place-items-center rounded-lg transition-[background-color,transform] duration-200",
                          active ? "bg-primary-soft scale-105" : "bg-transparent",
                        ].join(" ")}
                      >
                        <Icon
                          aria-hidden="true"
                          size={18}
                          strokeWidth={active ? 2.15 : 1.75}
                        />
                      </span>
                      <span className="leading-none">{item.label}</span>
                    </>
                  );
                }}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
