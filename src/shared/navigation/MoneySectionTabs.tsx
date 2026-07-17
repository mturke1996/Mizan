import { BriefcaseBusiness, FileText, Scale } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

/**
 * Segmented switcher for personal money flows (income / debts / invoices).
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
      className="money-section-tabs relative mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-line/80 bg-surface-subtle/80 p-1"
    >
      <span
        aria-hidden="true"
        className="money-tab-pill pointer-events-none absolute top-1 bottom-1 start-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-surface shadow-[0_6px_18px_rgb(27_30_60/6%)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        style={{
          transform: `translateX(calc(${activeIndex} * -100% - ${activeIndex} * 0.25rem))`,
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
              "pressable relative z-10 flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold transition-colors duration-200 sm:gap-2 sm:text-xs",
              isActive ? "text-primary" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            <Icon
              aria-hidden="true"
              size={15}
              strokeWidth={isActive ? 2.1 : 1.8}
            />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
