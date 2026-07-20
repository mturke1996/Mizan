import type { ReactNode } from "react";
import { Landmark, Scale, FileText, Briefcase, Wallet } from "lucide-react";
import { formatMinorAmount } from "@/domain/money/money";
import type { EconomicPosition } from "@/domain/analytics/compute-economic-position";
import { AppCard } from "@/shared/ui/AppCard";

interface EconomicPositionCardProps {
  position: EconomicPosition;
  currency: string;
}

function Row({
  label,
  amount,
  currency,
  tone = "default",
  icon,
}: {
  label: string;
  amount: bigint;
  currency: string;
  tone?: "default" | "positive" | "negative";
  icon: ReactNode;
}) {
  const amountClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-danger"
        : "text-ink";
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-subtle text-primary">
          {icon}
        </span>
        {label}
      </span>
      <span className={`numeric shrink-0 text-sm font-bold ${amountClass}`} dir="ltr">
        {formatMinorAmount(amount, { currency, locale: "en-US" })}
      </span>
    </div>
  );
}

export function EconomicPositionCard({
  position,
  currency,
}: EconomicPositionCardProps) {
  const money = { currency, locale: "en-US" as const };
  const netPositive = position.netPositionMinor >= 0n;

  return (
    <AppCard className="mb-4 overflow-hidden rounded-[20px] p-0 sm:mb-5">
      <div className="border-b border-line bg-[linear-gradient(135deg,rgb(67_56_202/8%),rgb(99_102_241/3%))] px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold text-muted">الموقف المالي الموحّد</p>
        <p className="mt-1 text-xs text-muted">
          نقد + مستحقات − التزامات — صورة واحدة لكل مصادر المال
        </p>
        <p
          className={`numeric mt-3 text-2xl font-black tracking-[-0.03em] ${
            netPositive ? "text-success" : "text-danger"
          }`}
          dir="ltr"
        >
          {formatMinorAmount(position.netPositionMinor, money)}
          <span className="ms-2 text-sm font-bold text-muted">{currency}</span>
        </p>
      </div>
      <div className="divide-y divide-line px-4 sm:px-5">
        <Row
          label="نقد في المحافظ"
          amount={position.cashMinor}
          currency={currency}
          icon={<Wallet aria-hidden="true" size={14} />}
        />
        {position.invoiceReceivableMinor > 0n ? (
          <Row
            label="فواتير مستحقة التحصيل"
            amount={position.invoiceReceivableMinor}
            currency={currency}
            tone="positive"
            icon={<FileText aria-hidden="true" size={14} />}
          />
        ) : null}
        {position.debtReceivableMinor > 0n ? (
          <Row
            label="ديون لي"
            amount={position.debtReceivableMinor}
            currency={currency}
            tone="positive"
            icon={<Landmark aria-hidden="true" size={14} />}
          />
        ) : null}
        {position.incomeOutstandingMinor > 0n ? (
          <Row
            label="دخل مستحق (لم يُسحب)"
            amount={position.incomeOutstandingMinor}
            currency={currency}
            tone="positive"
            icon={<Briefcase aria-hidden="true" size={14} />}
          />
        ) : null}
        {position.debtPayableMinor > 0n ? (
          <Row
            label="ديون عليّ"
            amount={position.debtPayableMinor}
            currency={currency}
            tone="negative"
            icon={<Scale aria-hidden="true" size={14} />}
          />
        ) : null}
      </div>
    </AppCard>
  );
}
