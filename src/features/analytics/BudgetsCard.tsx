import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { summarizeCurrentMonthByCategory } from "@/domain/analytics/compute-analytics";
import { formatMinorAmount, getCurrencyScale } from "@/domain/money/money";
import {
  useAllTransactionsQuery,
  useBudgetsQuery,
  useCategoriesQuery,
  useDeleteBudget,
  useUpsertBudget,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { useAuth } from "@/features/auth/use-auth";
import { AppCard } from "@/shared/ui/AppCard";
import { controlClassName } from "@/shared/ui/form-field";

const inputClass = controlClassName;

function parseMajorToMinor(value: string, scale: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return BigInt(Math.round(parsed * 10 ** scale));
}

export function BudgetsCard() {
  const { currency, isDemo = false } = useWorkspace();
  const { profile } = useAuth();
  const budgetsQuery = useBudgetsQuery();
  const categoriesQuery = useCategoriesQuery();
  const allTransactions = useAllTransactionsQuery();
  const upsertBudget = useUpsertBudget();
  const deleteBudget = useDeleteBudget();

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const budgets = budgetsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const categoryName = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const budgetedCategoryIds = useMemo(
    () => new Set(budgets.map((budget) => budget.categoryId)),
    [budgets],
  );
  const availableCategories = categories.filter(
    (category) =>
      category.kind === "expense" && !budgetedCategoryIds.has(category.id),
  );

  const spendByCategory = useMemo(
    () =>
      summarizeCurrentMonthByCategory({
        transactions: allTransactions.transactions,
        currency,
        timeZone: profile?.timezone ?? "Africa/Tripoli",
      }),
    [allTransactions.transactions, currency, profile?.timezone],
  );

  function handleAdd() {
    const limitMinor = parseMajorToMinor(amount, getCurrencyScale(currency));
    if (!categoryId) {
      toast.error("اختر تصنيفًا");
      return;
    }
    if (limitMinor === null) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    upsertBudget.mutate(
      { categoryId, currencyCode: currency, limitMinor },
      {
        onSuccess: () => {
          setCategoryId("");
          setAmount("");
          toast.success("تم تعيين الميزانية");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function handleDelete(budgetId: string, name: string) {
    deleteBudget.mutate(budgetId, {
      onSuccess: () => toast.success(`حُذفت ميزانية ${name}`),
      onError: (error) => toast.error(error.message),
    });
  }

  if (isDemo) {
    return (
      <AppCard className="mb-5 p-4 sm:p-5">
        <h2 className="font-bold text-ink">الميزانيات</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          الميزانيات الشهرية وتنبيهات الاستهلاك متاحة في مساحة العمل الفعلية.
        </p>
      </AppCard>
    );
  }

  return (
    <AppCard className="mb-5 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="font-bold text-ink">الميزانيات</h2>
        <p className="mt-1 text-xs text-muted">
          حدود إنفاق شهرية لكل تصنيف، مع تنبيه عند الاقتراب من الحد أو تجاوزه.
        </p>
      </div>

      {budgets.length === 0 ? (
        <p className="mb-4 text-sm text-muted">
          لم تُعيّن أي ميزانية بعد. ابدأ بتحديد تصنيف ومبلغ شهري أدناه.
        </p>
      ) : (
        <ul className="mb-4 space-y-4">
          {budgets.map((budget) => {
            const name = categoryName.get(budget.categoryId) ?? "تصنيف";
            const spent = spendByCategory.get(budget.categoryId) ?? 0n;
            const ratio =
              budget.limitMinor > 0n
                ? Number((spent * 100n) / budget.limitMinor)
                : 0;
            const over = spent > budget.limitMinor;
            const near = !over && ratio >= 80;
            const tone = over
              ? "text-danger"
              : near
                ? "text-warning"
                : "text-success";
            const barAccent = over
              ? "accent-danger"
              : near
                ? "accent-warning"
                : "accent-success";

            return (
              <li key={budget.id}>
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-ink">{name}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(budget.id, name)}
                    disabled={deleteBudget.isPending}
                    aria-label={`حذف ميزانية ${name}`}
                    className="pressable flex size-8 items-center justify-center rounded-sm text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <progress
                    max={100}
                    value={Math.min(ratio, 100)}
                    aria-label={`استهلاك ميزانية ${name}`}
                    className={`h-2 flex-1 overflow-hidden rounded-full ${barAccent}`}
                  />
                  <span className={`numeric w-9 text-left text-xs font-bold ${tone}`}>
                    {ratio}%
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
                  <span className="numeric" dir="ltr">
                    مُنفَق{" "}
                    {formatMinorAmount(spent, {
                      currency,
                      locale: "en-US",
                    })}
                  </span>
                  <span className="numeric" dir="ltr">
                    الحد{" "}
                    {formatMinorAmount(budget.limitMinor, {
                      currency,
                      locale: "en-US",
                    })}
                  </span>
                </div>
                {over ? (
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-danger">
                    <AlertTriangle aria-hidden="true" size={13} />
                    تجاوز الحد بمقدار{" "}
                    {formatMinorAmount(spent - budget.limitMinor, {
                      currency,
                      locale: "en-US",
                    })}
                  </p>
                ) : near ? (
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-warning">
                    <AlertTriangle aria-hidden="true" size={13} />
                    اقتربت من الحد
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {availableCategories.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <select
            aria-label="تصنيف الميزانية"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={`${inputClass} flex-1`}
          >
            <option value="">اختر تصنيفًا…</option>
            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            aria-label="الحد الشهري"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAdd();
            }}
            placeholder={`الحد الشهري (${currency})`}
            className={`${inputClass} w-40`}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!categoryId || !amount || upsertBudget.isPending}
            className="pressable flex min-h-11 items-center gap-1 rounded-sm bg-primary px-3 text-sm font-bold text-primary-on disabled:opacity-50"
          >
            <Plus aria-hidden="true" size={16} />
            تعيين
          </button>
        </div>
      ) : budgets.length > 0 ? (
        <p className="border-t border-line pt-3 text-[11px] text-muted">
          لكل تصنيفات المصروفات ميزانية معيّنة. أضف تصنيفات جديدة من الإعدادات
          لوضع ميزانيات أخرى.
        </p>
      ) : null}
    </AppCard>
  );
}
