import {
  FolderKanban,
  House,
  LayoutGrid,
  ReceiptText,
  Scale,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { hapticSelection } from "@/lib/capacitor-native";
import {
  isMoreNavRoute,
  useMoreNav,
} from "@/shared/navigation/more-nav-context";

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
    label: "المستحقات",
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
  const { openMoreNav } = useMoreNav();
  const moreActive = isMoreNavRoute(pathname);

  return (
    <nav
      dir="rtl"
      aria-label="التنقل الرئيسي"
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-384 border-t border-line bg-surface/95 backdrop-blur-md px-1 pt-1.5 [box-shadow:var(--shadow-nav)] md:hidden"
    >
      <ul className="grid grid-cols-6 items-center">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <NavLink
                to={item.to}
                end={item.end}
                aria-label={item.label}
                onClick={() => {
                  void hapticSelection();
                }}
                className={({ isActive }) => {
                  const active = isItemActive(pathname, item, isActive);
                  return [
                    "pressable relative flex min-h-13 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[11px] font-semibold transition-colors duration-200",
                    active ? "text-primary font-bold" : "text-muted hover:text-ink",
                  ].join(" ");
                }}
              >
                {({ isActive }) => {
                  const active = isItemActive(pathname, item, isActive);
                  return (
                    <>
                      <span
                        className={[
                          "relative grid h-8 w-12 place-items-center rounded-full transition-all duration-200",
                          active
                            ? "bg-primary-soft text-primary shadow-xs scale-102"
                            : "bg-transparent text-muted",
                        ].join(" ")}
                      >
                        <Icon
                          aria-hidden="true"
                          size={19}
                          strokeWidth={active ? 2.2 : 1.7}
                        />
                      </span>
                      <span className="leading-tight">{item.label}</span>
                    </>
                  );
                }}
              </NavLink>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-label="المزيد"
            aria-haspopup="dialog"
            onClick={() => {
              void hapticSelection();
              openMoreNav();
            }}
            className={[
              "pressable relative flex min-h-13 w-full flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[11px] font-semibold transition-colors duration-200",
              moreActive ? "text-primary font-bold" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            <span
              className={[
                "relative grid h-8 w-12 place-items-center rounded-full transition-all duration-200",
                moreActive
                  ? "bg-primary-soft text-primary shadow-xs scale-102"
                  : "bg-transparent text-muted",
              ].join(" ")}
            >
              <LayoutGrid
                aria-hidden="true"
                size={19}
                strokeWidth={moreActive ? 2.2 : 1.7}
              />
            </span>
            <span className="leading-tight">المزيد</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
