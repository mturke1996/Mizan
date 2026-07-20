import { zodResolver } from "@hookform/resolvers/zod";
import { WalletCards } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import { useFinanceStore } from "@/features/finance/finance-store";
import { useCreateWalletMutation } from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { toast } from "sonner";

const walletSchema = z
  .object({
    name: z.string().trim().min(2, "اكتب اسمًا واضحًا للمحفظة"),
    currency: z.enum(["LYD", "USD", "EUR"]),
    openingBalance: z.string(),
  })
  .superRefine((values, context) => {
    try {
      if (
        parseMajorAmount(
          values.openingBalance || "0",
          getCurrencyScale(values.currency),
        ) < 0n
      ) {
        throw new Error();
      }
    } catch {
      context.addIssue({
        code: "custom",
        path: ["openingBalance"],
        message: "أدخل رصيدًا افتتاحيًا صحيحًا",
      });
    }
  });

type WalletFormValues = z.infer<typeof walletSchema>;

export function WalletFormPage() {
  const navigate = useNavigate();
  const {
    workspaceId,
    currency,
    isLoading,
    error: workspaceError,
    refresh,
    isDemo = false,
  } = useWorkspace();
  const initialCurrency =
    currency === "USD" || currency === "EUR" ? currency : "LYD";
  const addWallet = useFinanceStore((state) => state.addWallet);
  const createWallet = useCreateWalletMutation();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: "",
      currency: initialCurrency,
      openingBalance: "",
    },
  });
  const selectedCurrency = useWatch({ control, name: "currency" });
  const fieldClassName =
    "min-h-12 w-full rounded-md border border-line-strong bg-surface px-4 text-sm text-ink";

  if (!isDemo && isLoading) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title="محفظة جديدة"
          subtitle="أضف أي مكان تحتفظ فيه بأموالك."
          backTo="/wallets"
        />
        <AppCard
          role="status"
          aria-label="جاري تحميل نموذج المحفظة"
          className="h-64 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  if (!isDemo && workspaceError) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title="محفظة جديدة"
          subtitle="أضف أي مكان تحتفظ فيه بأموالك."
          backTo="/wallets"
        />
        <ErrorState
          message={workspaceError}
          onRetry={() => void refresh()}
        />
      </div>
    );
  }

  const onSubmit = async (values: WalletFormValues) => {
    const scale = getCurrencyScale(values.currency);
    let openingBalanceMinor: bigint;
    try {
      openingBalanceMinor = parseMajorAmount(
        values.openingBalance || "0",
        scale,
      );
    } catch (error) {
      setError("openingBalance", {
        message:
          error instanceof Error ? error.message : "أدخل رصيدًا افتتاحيًا صحيحًا",
      });
      return;
    }

    try {
      if (workspaceId) {
        const clientId = crypto.randomUUID();
        await createWallet.mutateAsync({
          name: values.name.trim(),
          currencyCode: values.currency,
          openingBalanceMinor: toSafeMinorNumber(openingBalanceMinor),
          clientId,
        });
      } else if (isDemo) {
        addWallet({
          id: crypto.randomUUID(),
          name: values.name.trim(),
          kind: "cash",
          currency: values.currency,
          balanceMinor: openingBalanceMinor,
        });
      } else {
        throw new Error("مساحة العمل غير متاحة الآن. أعد المحاولة بعد التحديث.");
      }
      navigate("/wallets", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر الإنشاء");
    }
  };

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="محفظة جديدة"
        subtitle="أضف أي مكان تحتفظ فيه بأموالك."
        backTo="/wallets"
      />

      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <AppCard className="space-y-5 p-4 sm:p-5">
          <div>
            <label htmlFor="wallet-name" className="text-sm font-bold">
              اسم المحفظة
            </label>
            <input
              id="wallet-name"
              type="text"
              placeholder="مثل: مصروف المنزل"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "wallet-name-error" : undefined}
              className={`mt-2 ${fieldClassName}`}
              {...register("name")}
            />
            {errors.name ? (
              <p
                id="wallet-name-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-danger"
              >
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="wallet-currency" className="text-sm font-bold">
              العملة
            </label>
            <select
              id="wallet-currency"
              className={`mt-2 ${fieldClassName}`}
              {...register("currency")}
            >
              <option value="LYD">الدينار الليبي (LYD)</option>
              <option value="USD">الدولار الأمريكي (USD)</option>
              <option value="EUR">اليورو (EUR)</option>
            </select>
          </div>

          <div>
            <label htmlFor="wallet-balance" className="text-sm font-bold">
              الرصيد الافتتاحي
            </label>
            <p className="mt-1 text-xs text-muted">
              المبلغ الموجود أصلًا عند بدء استخدام هذه المحفظة. لاحقًا استخدم
              تمويل أو سحب الخزينة.
            </p>
            <input
              id="wallet-balance"
              type="text"
              inputMode="decimal"
              dir="ltr"
              placeholder={`0.${"0".repeat(
                getCurrencyScale(selectedCurrency),
              )}`}
              aria-invalid={Boolean(errors.openingBalance)}
              aria-describedby={
                errors.openingBalance ? "wallet-balance-error" : undefined
              }
              className={`mt-2 ${fieldClassName} numeric text-left`}
              {...register("openingBalance")}
            />
            {errors.openingBalance ? (
              <p
                id="wallet-balance-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-danger"
              >
                {errors.openingBalance.message}
              </p>
            ) : null}
          </div>
        </AppCard>

        <button
          type="submit"
          disabled={isSubmitting}
          className="pressable mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
        >
          <WalletCards aria-hidden="true" size={19} />
          {isSubmitting ? "جارٍ الإنشاء..." : "إنشاء المحفظة"}
        </button>
      </form>
    </div>
  );
}
