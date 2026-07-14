import { BriefcaseBusiness, FileText, Scale } from "lucide-react";
import { NavLink } from "react-router-dom";

/**
 * Shared switcher between personal income, debts, and invoices.
 * Keeps money flows one tap apart on mobile and desktop.
 */
export function MoneySectionTabs({
  active,
}: {
  active: "income" | "debts" | "invoices";
}) {
  const tabs = [
    {
      id: "income" as const,
      to: "/income",
      label: "دخلي",
      Icon: BriefcaseBusiness,
    },
    {
      id: "debts" as const,
      to: "/debts",
      label: "الديون",
      Icon: Scale,
    },
    {
      id: "invoices" as const,
      to: "/invoices",
      label: "فواتير",
      Icon: FileText,
    },
  ];

  return (
    <nav
      aria-label="أقسام أموالي"
      className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-line/80 bg-surface-subtle/80 p-1"
    >
      {tabs.map(({ id, to, label, Icon }) => {
        const isActive = active === id;
        return (
          <NavLink
            key={id}
            to={to}
            aria-current={isActive ? "page" : undefined}
            className={[
              "pressable flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:gap-2 sm:text-xs",
              isActive
                ? "bg-surface text-primary shadow-[0_6px_18px_rgb(27_30_60/6%)]"
                : "text-muted hover:text-ink",
            ].join(" ")}
          >
            <Icon aria-hidden="true" size={15} strokeWidth={isActive ? 2.1 : 1.8} />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
