import * as Dialog from "@radix-ui/react-dialog";
import {
  Bell,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  FileBarChart2,
  Layers3,
  PiggyBank,
  ReceiptText,
  Repeat2,
  Settings,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

interface MoreLink {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const primaryLinks: MoreLink[] = [
  {
    to: "/analytics",
    label: "التحليلات",
    description: "الاتجاهات والرؤى",
    icon: ChartNoAxesCombined,
  },
  {
    to: "/reports",
    label: "التقارير",
    description: "أرباح وخسائر وتدفق نقدي",
    icon: FileBarChart2,
  },
  {
    to: "/budgets",
    label: "الميزانيات",
    description: "حدود الإنفاق الشهرية",
    icon: PiggyBank,
  },
  {
    to: "/clients",
    label: "العملاء",
    description: "دفتر زبائن أعمالك",
    icon: Users,
  },
  {
    to: "/wallets",
    label: "المحافظ",
    description: "الأرصدة والتحويلات",
    icon: WalletCards,
  },
  {
    to: "/notifications",
    label: "الإشعارات",
    description: "تنبيهات الاشتراك والمعاملات",
    icon: Bell,
  },
];

const settingsLinks: MoreLink[] = [
  {
    to: "/settings",
    label: "الإعدادات",
    description: "الحساب والمساحة",
    icon: Settings,
  },
  {
    to: "/settings/categories",
    label: "الفئات",
    description: "تصنيف الدخل والمصروف",
    icon: Layers3,
  },
  {
    to: "/settings/recurring",
    label: "المعاملات المتكررة",
    description: "جدولة الحركات الدورية",
    icon: Repeat2,
  },
];

const moneyLinks: MoreLink[] = [
  {
    to: "/income",
    label: "دخلي",
    description: "مصادر الدخل والمستحقات",
    icon: BriefcaseBusiness,
  },
  {
    to: "/invoices",
    label: "الفواتير",
    description: "فواتير المبيعات والتحصيل",
    icon: ReceiptText,
  },
];

interface MoreNavSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

function LinkGroup({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: MoreLink[];
  onNavigate(): void;
}) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-[11px] font-bold tracking-wide text-muted">
        {title}
      </h3>
      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={onNavigate}
                className="pressable flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 text-ink transition-colors hover:bg-surface-subtle"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MoreNavSheet({ open, onOpenChange }: MoreNavSheetProps) {
  const close = () => onOpenChange(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby="more-nav-description"
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 shadow-[0_-12px_40px_rgb(27_30_60/16%)] outline-none sm:inset-x-auto sm:start-1/2 sm:bottom-[12%] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:rounded-3xl"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-bold text-ink">
                المزيد
              </Dialog.Title>
              <Dialog.Description
                className="mt-1 text-sm text-muted"
                id="more-nav-description"
              >
                اختصارات للتحليلات والعملاء والإعدادات
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="إغلاق"
                className="pressable grid size-10 place-items-center rounded-full text-muted hover:bg-surface-subtle hover:text-ink"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-5 pb-[max(8px,var(--safe-bottom))]">
            <LinkGroup
              title="الوصول السريع"
              items={primaryLinks}
              onNavigate={close}
            />
            <LinkGroup title="أموالي" items={moneyLinks} onNavigate={close} />
            <LinkGroup
              title="الإعداد والتنظيم"
              items={settingsLinks}
              onNavigate={close}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
