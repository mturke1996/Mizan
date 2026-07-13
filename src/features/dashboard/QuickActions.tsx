import {
  ArrowDownLeft,
  ArrowUpRight,
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
    label: "مستلزمات",
    to: "/transactions/new?type=expense&title=%D9%85%D8%B3%D8%AA%D9%84%D8%B2%D9%85%D8%A7%D8%AA",
    icon: Package,
    tone: "bg-warning-soft text-warning",
  },
  {
    label: "تحويل",
    to: "/transfer",
    icon: Repeat2,
    tone: "bg-info-soft text-info",
  },
  {
    label: "مشروع",
    to: "/projects/new",
    icon: Plus,
    tone: "bg-primary-soft text-primary-ink",
  },
  {
    label: "دين",
    to: "/debts/new",
    icon: Scale,
    tone: "bg-warning-soft text-warning",
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
        className="mb-6 lg:hidden"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="quick-actions-mobile-title"
            className="text-lg font-bold text-ink"
          >
            إجراءات سريعة
          </h2>
          <span className="text-[11px] text-muted">كل شيء بخطوة واحدة</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.to}
                className="pressable flex min-h-24 flex-col items-center justify-center gap-2 rounded-[12px] border border-line bg-surface px-1.5 py-3 text-center text-[11px] font-semibold text-ink shadow-[0_2px_12px_rgb(27_30_60/3%)]"
              >
                <span
                  className={`grid size-11 place-items-center rounded-[11px] ${action.tone}`}
                >
                  <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
                </span>
                {action.label}
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
      className="mb-5 hidden rounded-[12px] border border-line bg-surface p-5 shadow-[0_2px_18px_rgb(27_30_60/4%)] lg:flex lg:items-center lg:justify-between lg:gap-8"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
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
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:mt-0 lg:min-w-148">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              to={action.to}
              className="pressable group flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-[10px] bg-canvas px-2 py-2.5 text-center text-[11px] font-semibold text-ink ring-1 ring-inset ring-line transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-surface-subtle sm:min-h-18"
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
