import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Package,
  Plus,
  Repeat2,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

const quickActions: Array<{
  label: string;
  to: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    label: "دخل",
    to: "/transactions/new?type=income",
    icon: ArrowDownLeft,
    tone: "bg-success-soft text-success",
  },
  {
    label: "مصروف",
    to: "/transactions/new?type=expense",
    icon: ArrowUpRight,
    tone: "bg-danger-soft text-danger",
  },
  {
    label: "تحويل",
    to: "/transfer",
    icon: Repeat2,
    tone: "bg-info-soft text-info",
  },
  {
    label: "دين",
    to: "/debts/new",
    icon: Scale,
    tone: "bg-warning-soft text-warning",
  },
  {
    label: "فاتورة",
    to: "/invoices/new",
    icon: FileText,
    tone: "bg-primary-soft text-primary-ink",
  },
  {
    label: "مشروع",
    to: "/projects/new",
    icon: Plus,
    tone: "bg-primary-soft text-primary-ink",
  },
  {
    label: "مستلزمات",
    to: "/transactions/new?type=expense&title=%D9%85%D8%B3%D8%AA%D9%84%D8%B2%D9%85%D8%A7%D8%AA",
    icon: Package,
    tone: "bg-surface-subtle text-muted",
  },
];

export function QuickActions({
  variant = "mobile",
}: {
  variant?: "mobile" | "desktop";
}) {
  if (variant === "mobile") {
    return (
      <section
        aria-labelledby="quick-actions-mobile-title"
        className="mb-5 md:hidden"
      >
        <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
          <h2
            id="quick-actions-mobile-title"
            className="text-[13px] font-bold text-ink"
          >
            إجراءات سريعة
          </h2>
          <span className="text-[10px] text-muted">لمسّة واحدة</span>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.to}
                className="pressable flex w-[4.65rem] shrink-0 flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-3 text-center shadow-[0_6px_18px_rgb(27_30_60/4%)]"
              >
                <span
                  className={`grid size-11 place-items-center rounded-2xl ${action.tone}`}
                >
                  <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                </span>
                <span className="text-[11px] font-semibold text-ink">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="quick-actions-desktop-title"
      className="mb-5 hidden rounded-[16px] border border-line bg-surface p-5 shadow-[0_2px_18px_rgb(27_30_60/4%)] md:flex md:items-center md:justify-between md:gap-8"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
          <Plus aria-hidden="true" size={22} strokeWidth={1.8} />
        </span>
        <div>
          <h2
            id="quick-actions-desktop-title"
            className="text-sm font-bold text-ink"
          >
            سجّل حركة مالية بسرعة
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            اختر العملية وسيجهز ميزان الحقول المناسبة فقط.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-7 lg:mt-0 lg:min-w-148">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              to={action.to}
              className="pressable group flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-[12px] bg-canvas px-2 py-2.5 text-center text-[11px] font-semibold text-ink ring-1 ring-inset ring-line transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-surface-subtle sm:min-h-18"
            >
              <span
                className={`flex size-8 items-center justify-center rounded-[9px] ${action.tone}`}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
              </span>
              {action.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
