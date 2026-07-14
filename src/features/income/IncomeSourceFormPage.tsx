import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import { useCreateIncomeSourceMutation } from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type { IncomePayKind } from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";

export function IncomeSourceFormPage() {
  const navigate = useNavigate();
  const { currency } = useWorkspace();
  const createSource = useCreateIncomeSourceMutation();

  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [payKind, setPayKind] = useState<IncomePayKind>("daily");
  const [dailyWage, setDailyWage] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const scale = getCurrencyScale(currency);
  const inputClass =
    "w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink placeholder:text-muted";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setFormError(null);

    try {
      const dailyWageMinor = dailyWage.trim()
        ? toSafeMinorNumber(parseMajorAmount(dailyWage, scale))
        : undefined;
      const monthlySalaryMinor = monthlySalary.trim()
        ? toSafeMinorNumber(parseMajorAmount(monthlySalary, scale))
        : undefined;

      await createSource.mutateAsync({
        name: name.trim(),
        place: place.trim() || undefined,
        payKind,
        dailyWageMinor,
        monthlySalaryMinor,
        currencyCode: currency,
      });
      navigate("/income");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "تعذر إنشاء مصدر الدخل",
      );
    }
  };

  return (
    <div className="px-4 sm:px-6" dir="rtl">
      <PageHeader
        title="مصدر دخل جديد"
        subtitle="وظيفة شهرية أو عمل يومي"
        backTo="/income"
      />

      <AppCard className="rounded-[18px] p-4 sm:p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">
              اسم المصدر *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مقهى الحي، وظيفة الشركة..."
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">
              مكان العمل
            </label>
            <input
              type="text"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="اختياري"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-ink">
              نوع الدفع
            </label>
            <div className="flex gap-2">
              {(
                [
                  { value: "daily", label: "يومي" },
                  { value: "monthly", label: "شهري" },
                  { value: "both", label: "يومي + شهري" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPayKind(opt.value)}
                  className={[
                    "flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors",
                    payKind === opt.value
                      ? "bg-primary text-primary-on"
                      : "bg-surface-subtle text-muted hover:bg-primary-soft hover:text-primary",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(payKind === "daily" || payKind === "both") && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                الأجرة اليومية ({currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={dailyWage}
                onChange={(e) => setDailyWage(e.target.value)}
                placeholder="0"
                className={`numeric ${inputClass}`}
              />
            </div>
          )}

          {(payKind === "monthly" || payKind === "both") && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                الراتب الشهري ({currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                placeholder="0"
                className={`numeric ${inputClass}`}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={createSource.isPending || !name.trim()}
            className="pressable w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-on disabled:opacity-50"
          >
            {createSource.isPending ? "جاري الحفظ..." : "إنشاء مصدر الدخل"}
          </button>

          {formError || createSource.isError ? (
            <p className="text-center text-xs text-danger">
              {formError ||
                (createSource.error instanceof Error
                  ? createSource.error.message
                  : "حدث خطأ")}
            </p>
          ) : null}
        </form>
      </AppCard>
    </div>
  );
}
