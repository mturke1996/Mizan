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
import { MoneyField, TextField } from "@/shared/ui/form-field";
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
          <TextField
            label="اسم المصدر"
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: مقهى الحي، وظيفة الشركة..."
            required
            value={name}
          />

          <TextField
            label="مكان العمل"
            onChange={(e) => setPlace(e.target.value)}
            placeholder="اختياري"
            value={place}
          />

          <div>
            <p className="mb-2 text-xs font-bold text-muted">نوع الدفع</p>
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
                    "pressable flex-1 rounded-sm py-2.5 text-xs font-bold transition-colors",
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
            <MoneyField
              currency={currency}
              label="الأجرة اليومية"
              onChange={(e) => setDailyWage(e.target.value)}
              placeholder="0"
              value={dailyWage}
            />
          )}

          {(payKind === "monthly" || payKind === "both") && (
            <MoneyField
              currency={currency}
              label="الراتب الشهري"
              onChange={(e) => setMonthlySalary(e.target.value)}
              placeholder="0"
              value={monthlySalary}
            />
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
