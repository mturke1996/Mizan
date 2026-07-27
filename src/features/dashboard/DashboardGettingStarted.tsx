import { ArrowLeft, Plus, Scale, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardGettingStartedProps {
  hasWallets: boolean;
  hasTransactions: boolean;
  hasDebts: boolean;
}

const steps = [
  {
    id: "wallet",
    title: "أنشئ محفظتك الأولى",
    description: "ضع فلوسك في مكان واضح — نقد، مصرف، أو محفظة عمل.",
    to: "/wallets/new",
    cta: "إضافة محفظة",
    icon: WalletCards,
    doneKey: "hasWallets" as const,
  },
  {
    id: "tx",
    title: "سجّل أول حركة",
    description: "دخل أو مصروف بسيط يكفي لبدء الصورة الحقيقية.",
    to: "/transactions/new?type=income",
    cta: "تسجيل دخل",
    icon: Plus,
    doneKey: "hasTransactions" as const,
  },
  {
    id: "debt",
    title: "أضف مستحقًا إن وُجد",
    description: "ما لك أو ما عليك — حتى لا يضيع شيء خارج الرصيد.",
    to: "/debts/new",
    cta: "تسجيل مستحق",
    icon: Scale,
    doneKey: "hasDebts" as const,
  },
];

export function DashboardGettingStarted({
  hasWallets,
  hasTransactions,
  hasDebts,
}: DashboardGettingStartedProps) {
  const flags = { hasWallets, hasTransactions, hasDebts };
  const remaining = steps.filter((step) => !flags[step.doneKey]);
  if (remaining.length === 0) return null;

  const doneCount = steps.length - remaining.length;

  return (
    <section
      aria-labelledby="getting-started-title"
      className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_10px_28px_rgb(27_30_60/5%)]"
    >
      <div className="border-b border-line bg-[linear-gradient(135deg,rgb(67_56_202/10%),rgb(247_248_252)_55%)] px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold tracking-wide text-primary">
          ابدأ من هنا
        </p>
        <h2
          id="getting-started-title"
          className="mt-1 text-lg font-bold tracking-tight text-ink"
        >
          ثلاث خطوات لرؤية واضحة لأموالك
        </h2>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          أنجزت {doneCount} من {steps.length} — أكمل الباقي وميزان يصبح مفيدًا فورًا.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="divide-y divide-line">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const done = flags[step.doneKey];
          return (
            <li
              key={step.id}
              className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
            >
              <span
                className={[
                  "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold",
                  done
                    ? "bg-success-soft text-success"
                    : "bg-primary-soft text-primary",
                ].join(" ")}
              >
                {done ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={[
                    "text-sm font-bold",
                    done ? "text-muted line-through decoration-line" : "text-ink",
                  ].join(" ")}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-muted">
                  {step.description}
                </p>
                {!done ? (
                  <Link
                    to={step.to}
                    className="pressable mt-2.5 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-on"
                  >
                    <Icon aria-hidden="true" size={14} />
                    {step.cta}
                    <ArrowLeft aria-hidden="true" size={14} />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
