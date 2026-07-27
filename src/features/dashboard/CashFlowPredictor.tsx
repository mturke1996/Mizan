import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  TrendingUp,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Zap,
  SlidersHorizontal,
} from "lucide-react";

interface CashFlowPredictorProps {
  totalBalanceMinor: bigint;
  incomeMinor: bigint;
  expenseMinor: bigint;
  currency: string;
}

export function CashFlowPredictor({
  totalBalanceMinor,
  incomeMinor,
  expenseMinor,
  currency,
}: CashFlowPredictorProps) {
  const [expenseMultiplier, setExpenseMultiplier] = useState<number>(100);

  const analytics = useMemo(() => {
    const totalBalance = Number(totalBalanceMinor) / 100;
    const baseMonthlyExpense = Number(expenseMinor) / 100;
    const baseMonthlyIncome = Number(incomeMinor) / 100;

    const adjustedExpense = (baseMonthlyExpense * expenseMultiplier) / 100;
    const monthlyNet = baseMonthlyIncome - adjustedExpense;

    const monthlyBurn = adjustedExpense > baseMonthlyIncome ? adjustedExpense - baseMonthlyIncome : 0;
    const runwayMonths = monthlyBurn > 0 ? (totalBalance / monthlyBurn) : 99;
    const runwayDays = Math.min(Math.round(runwayMonths * 30), 999);

    const projected30 = totalBalance + monthlyNet;
    const projected60 = totalBalance + monthlyNet * 2;
    const projected90 = totalBalance + monthlyNet * 3;

    let statusTone: "emerald" | "amber" | "rose" = "emerald";
    let statusText = "موقف مالي ممتاز ومستدام";
    if (runwayMonths < 3) {
      statusTone = "rose";
      statusText = "تحذير: سيولة حرجة (أقل من 3 أشهر)";
    } else if (runwayMonths < 6 || monthlyNet < 0) {
      statusTone = "amber";
      statusText = "مستوى سيولة متوسط - يلزم التحفظ";
    }

    return {
      totalBalance,
      adjustedExpense,
      monthlyNet,
      monthlyBurn,
      runwayMonths,
      runwayDays,
      projected30,
      projected60,
      projected90,
      statusTone,
      statusText,
    };
  }, [totalBalanceMinor, incomeMinor, expenseMinor, expenseMultiplier]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="relative overflow-hidden rounded-[24px] border border-line bg-surface p-5 backdrop-blur-md shadow-card md:p-6"
    >
      {/* Top Decorative Glow Accent */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/10 blur-3xl" />

      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/25">
            <Sparkles size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-ink flex items-center gap-2">
              مُحاكي التدفق النقدي والمسار المالي
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                AI Engine
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              توقعات الرصيد والسيولة المتبقية على مدار 90 يوماً القادمة
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border ${
            analytics.statusTone === "emerald"
              ? "bg-success-soft text-success border-success/30"
              : analytics.statusTone === "amber"
              ? "bg-warning-soft text-warning border-warning/30"
              : "bg-danger-soft text-danger border-danger/30"
          }`}
        >
          {analytics.statusTone === "emerald" ? (
            <CheckCircle2 size={14} />
          ) : analytics.statusTone === "amber" ? (
            <Clock size={14} />
          ) : (
            <ShieldAlert size={14} />
          )}
          <span>{analytics.statusText}</span>
        </div>
      </div>

      {/* Main Analytics Grid */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {/* Runway Indicator */}
        <div className="rounded-2xl border border-line bg-surface-subtle p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>المسار الآمن (Runway)</span>
            <Clock size={15} className="text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-ink">
              {analytics.runwayMonths >= 99 ? "∞" : `${analytics.runwayDays} يوم`}
            </span>
            {analytics.runwayMonths < 99 && (
              <span className="text-xs text-muted font-semibold">
                (~{analytics.runwayMonths.toFixed(1)} شهر)
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            الفترة الزمنية حتى نفاد السيولة عند الاستهلاك الحالي
          </p>
        </div>

        {/* Net Monthly Cash Flow */}
        <div className="rounded-2xl border border-line bg-surface-subtle p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>صافي التغير الشهري المتوقع</span>
            <TrendingUp
              size={15}
              className={analytics.monthlyNet >= 0 ? "text-success" : "text-danger"}
            />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-ink dir-ltr text-right">
            <span className={analytics.monthlyNet >= 0 ? "text-success" : "text-danger"}>
              {analytics.monthlyNet >= 0 ? "+" : ""}
              {analytics.monthlyNet.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
            <span className="ms-1.5 text-xs text-muted font-sans">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            الفارق بين الإيرادات والمصروفات المقدرة
          </p>
        </div>

        {/* 90-Day Forecast */}
        <div className="rounded-2xl border border-line bg-surface-subtle p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>الرصيد المتوقع بعد 90 يوماً</span>
            <Zap size={15} className="text-warning" />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-ink dir-ltr text-right">
            <span>{analytics.projected90.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span className="ms-1.5 text-xs text-muted font-sans">{currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            بناءً على المحاكاة الدورية المستمرة
          </p>
        </div>
      </div>

      {/* Simulation Slider */}
      <div className="mt-5 rounded-2xl border border-line bg-surface-subtle p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-ink">
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-primary" />
            اختبار حساسية المصروفات الشهري: ({expenseMultiplier}%)
          </span>
          <span className="font-mono text-primary dir-ltr font-bold">
            {analytics.adjustedExpense.toLocaleString("en-US", { maximumFractionDigits: 0 })} {currency}
          </span>
        </div>
        <input
          type="range"
          min="50"
          max="200"
          step="5"
          value={expenseMultiplier}
          onChange={(e) => setExpenseMultiplier(Number(e.target.value))}
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-strong accent-primary"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted font-mono">
          <span>-50% خفض تكاليف</span>
          <span>100% مصروف حالي</span>
          <span>+100% مضاعفة تكاليف</span>
        </div>
      </div>
    </motion.div>
  );
}
