import { BriefcaseBusiness, FileText, Scale } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

/**
 * Compact segmented switcher for personal money flows (income / debts / invoices).
 * Wallets live as a first-class bottom-nav destination.
 */
export function MoneySectionTabs({
  active,
}: {
  active: "income" | "debts" | "invoices";
}) {
  const location = useLocation();
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
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === active),
  );

  return (
    <nav
      aria-label="أقسام أموالي"
      className="money-section-tabs relative mb-3 grid grid-cols-3 gap-0.5 rounded-xl border border-line/70 bg-surface-subtle/70 p-0.5"
    >
      <span
        aria-hidden="true"
        className="money-tab-pill pointer-events-none absolute top-0.5 bottom-0.5 start-0.5 w-[calc((100%-0.25rem)/3)] rounded-lg bg-surface shadow-[0_2px_8px_rgb(27_30_60/5%)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        style={{
          transform: `translateX(calc(${activeIndex} * -100% - ${activeIndex} * 0.125rem))`,
        }}
      />
      {tabs.map(({ id, to, label, Icon }) => {
        const isActive = active === id;
        const keepSearch =
          id === "debts" && location.pathname.startsWith("/debts")
            ? location.search
            : "";
        return (
          <NavLink
            key={id}
            to={`${to}${keepSearch}`}
            aria-current={isActive ? "page" : undefined}
            className={[
              "pressable relative z-10 flex min-h-9 items-center justify-center gap-1 rounded-lg text-[11px] font-bold transition-colors duration-200",
              isActive ? "text-primary" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            <Icon
              aria-hidden="true"
              size={14}
              strokeWidth={isActive ? 2.1 : 1.75}
            />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
