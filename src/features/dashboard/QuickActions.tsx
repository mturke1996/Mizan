import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  HardHat,
  Package,
  Plus,
  Repeat2,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

type QuickAction = {
  label: string;
  to: string;
  icon: LucideIcon;
  tone: string;
};

function buildQuickActions(workerProjectId?: string | null): QuickAction[] {
  const actions: QuickAction[] = [
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
      label: "مستحق لي",
      to: "/debts/new?direction=receivable",
      icon: Scale,
      tone: "bg-warning-soft text-warning",
    },
    {
      label: "عليّ",
      to: "/debts/new?direction=payable",
      icon: Scale,
      tone: "bg-warning-soft text-warning",
    },
  ];

  if (workerProjectId) {
    actions.push({
      label: "يومية",
      to: `/projects/${encodeURIComponent(workerProjectId)}?tab=workers`,
      icon: HardHat,
      tone: "bg-primary-soft text-primary-ink",
    });
  }

  actions.push(
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
  );

  return actions;
}

export function QuickActions({
  variant = "mobile",
  workerProjectId = null,
}: {
  variant?: "mobile" | "desktop";
  /** Active project with workers module — enables يومية shortcut. */
  workerProjectId?: string | null;
}) {
  const quickActions = buildQuickActions(workerProjectId);

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
                className="pressable flex w-[4.35rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface px-1.5 py-2.5 text-center shadow-[0_4px_14px_rgb(27_30_60/4%)] active:bg-surface-subtle"
              >
                <span
                  className={`grid size-10 place-items-center rounded-xl ${action.tone}`}
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                </span>
                <span className="text-[10px] font-bold text-ink">
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
      className="mb-5 hidden rounded-[16px] border border-line bg-surface p-5 shadow-[0_2px_18px_rgb(27_30_60/4%)] md:flex md:flex-col md:gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
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
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:min-w-148">
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
