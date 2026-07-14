import {
  BriefcaseBusiness,
  FolderKanban,
  House,
  ReceiptText,
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
    icon: BriefcaseBusiness,
    matchPrefixes: ["/income", "/debts", "/clients", "/invoices"],
  },
  { label: "المشاريع", to: "/projects", icon: FolderKanban },
  { label: "المحافظ", to: "/wallets", icon: WalletCards },
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
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-3xl border-t border-line bg-surface/95 px-2 pt-2 pb-[max(8px,var(--safe-bottom))] [box-shadow:var(--shadow-nav)] backdrop-blur-xl lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.label}>
              <NavLink to={item.to} end={item.end}>
                {({ isActive }) => {
                  const active = isItemActive(pathname, item, isActive);
                  return (
                    <span
                      className={[
                        "pressable mx-auto flex min-h-14 w-full max-w-20 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium",
                        active
                          ? "text-primary"
                          : "text-muted hover:bg-surface-subtle hover:text-ink",
                      ].join(" ")}
                    >
                      <Icon
                        aria-hidden="true"
                        size={21}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      <span className={active ? "font-bold" : undefined}>
                        {item.label}
                      </span>
                      <span
                        aria-hidden="true"
                        className={[
                          "mt-0.5 h-0.5 w-5 rounded-full",
                          active ? "bg-primary" : "bg-transparent",
                        ].join(" ")}
                      />
                    </span>
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
