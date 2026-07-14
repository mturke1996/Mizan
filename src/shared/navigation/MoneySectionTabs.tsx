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
  return (
    <nav
      aria-label="أقسام أموالي"
      className="mb-5 grid grid-cols-3 gap-1 rounded-2xl border border-line/80 bg-surface-subtle/80 p-1"
    >
      <NavLink
        to="/income"
        aria-current={active === "income" ? "page" : undefined}
        className={[
          "pressable flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:gap-2 sm:text-xs",
          active === "income"
            ? "bg-surface text-primary shadow-[0_6px_18px_rgb(27_30_60/6%)]"
            : "text-muted hover:text-ink",
        ].join(" ")}
      >
        <BriefcaseBusiness aria-hidden="true" size={15} strokeWidth={1.8} />
        دخلي
      </NavLink>
      <NavLink
        to="/debts"
        aria-current={active === "debts" ? "page" : undefined}
        className={[
          "pressable flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:gap-2 sm:text-xs",
          active === "debts"
            ? "bg-surface text-primary shadow-[0_6px_18px_rgb(27_30_60/6%)]"
            : "text-muted hover:text-ink",
        ].join(" ")}
      >
        <Scale aria-hidden="true" size={15} strokeWidth={1.8} />
        الديون
      </NavLink>
      <NavLink
        to="/invoices"
        aria-current={active === "invoices" ? "page" : undefined}
        className={[
          "pressable flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:gap-2 sm:text-xs",
          active === "invoices"
            ? "bg-surface text-primary shadow-[0_6px_18px_rgb(27_30_60/6%)]"
            : "text-muted hover:text-ink",
        ].join(" ")}
      >
        <FileText aria-hidden="true" size={15} strokeWidth={1.8} />
        فواتير
      </NavLink>
    </nav>
  );
}
