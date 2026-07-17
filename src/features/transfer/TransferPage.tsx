import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowLeftRight } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import {
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import { useFinanceStore } from "@/features/finance/finance-store";
import { usePostTransferMutation } from "@/features/workspace/use-finance-data";
import { useFinanceView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { controlClassName } from "@/shared/ui/form-field";
import { PageHeader } from "@/shared/ui/PageHeader";

const transferSchema = z
  .object({
    sourceWalletId: z.string().min(1, "اختر محفظة المصدر"),
    destinationWalletId: z.string().min(1, "اختر محفظة الاستلام"),
    amount: z.string().refine((value) => {
      try {
        return parseMajorAmount(value, 3) > 0n;
      } catch {
        return false;
      }
    }, "أدخل مبلغًا أكبر من صفر"),
    note: z.string().trim().max(200, "الملاحظة أطول من اللازم").optional(),
  })
  .refine(
    (values) => values.sourceWalletId !== values.destinationWalletId,
    {
      path: ["destinationWalletId"],
      message: "يجب اختيار محفظتين مختلفتين",
    },
  );

type TransferFormValues = z.infer<typeof transferSchema>;

export function TransferPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workspaceId, currency, isDemo = false } = useWorkspace();
  const { wallets, isLoading, walletsError, refresh } = useFinanceView();
  const transfer = useFinanceStore((state) => state.transfer);
  const postTransfer = usePostTransferMutation();
  const sourceWallets = wallets.filter((wallet) =>
    wallets.some(
      (candidate) =>
        candidate.id !== wallet.id && candidate.currency === wallet.currency,
    ),
  );
  const requestedSource = sourceWallets.find(
    (wallet) => wallet.id === searchParams.get("from"),
  );
  const initialSource = requestedSource ?? sourceWallets[0];
  const initialDestination = wallets.find(
    (wallet) =>
      wallet.id !== initialSource?.id &&
      wallet.currency === initialSource?.currency,
  );
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      sourceWalletId: initialSource?.id ?? "",
      destinationWalletId: initialDestination?.id ?? "",
      amount: "",
      note: "",
    },
  });

  const sourceWalletId = useWatch({
    control,
    name: "sourceWalletId",
  });
  const sourceWallet = wallets.find(
    (wallet) => wallet.id === sourceWalletId,
  );
  const destinationWallets = wallets.filter(
    (wallet) =>
      wallet.id !== sourceWallet?.id &&
      wallet.currency === sourceWallet?.currency,
  );
  const hasTransferPair = sourceWallets.length >= 2;
  const fieldClassName = `${controlClassName} min-h-12 px-4`;

  useEffect(() => {
    if (!sourceWallets.length) return;

    const currentSource =
      sourceWallets.find((wallet) => wallet.id === sourceWalletId) ??
      requestedSource ??
      sourceWallets[0];
    if (!currentSource) return;

    if (sourceWalletId !== currentSource.id) {
      setValue("sourceWalletId", currentSource.id, { shouldValidate: true });
    }

    const currentDestinationId = getValues("destinationWalletId");
    const validDestinations = wallets.filter(
      (wallet) =>
        wallet.id !== currentSource.id &&
        wallet.currency === currentSource.currency,
    );
    if (
      !validDestinations.some(
        (wallet) => wallet.id === currentDestinationId,
      )
    ) {
      setValue("destinationWalletId", validDestinations[0]?.id ?? "", {
        shouldValidate: true,
      });
    }
  }, [
    getValues,
    requestedSource,
    setValue,
    sourceWalletId,
    sourceWallets,
    wallets,
  ]);

  const swapWallets = () => {
    const source = getValues("sourceWalletId");
    const destination = getValues("destinationWalletId");
    setValue("sourceWalletId", destination, { shouldValidate: true });
    setValue("destinationWalletId", source, { shouldValidate: true });
  };

  const onSubmit = async (values: TransferFormValues) => {
    const source = wallets.find(
      (wallet) => wallet.id === values.sourceWalletId,
    );
    const destination = wallets.find(
      (wallet) => wallet.id === values.destinationWalletId,
    );
    if (!source || !destination) return;
    if (source.currency !== destination.currency) {
      setError("destinationWalletId", {
        message: "اختر محفظة تستخدم عملة المصدر نفسها",
      });
      return;
    }

    try {
      let amountMinor: bigint;
      try {
        amountMinor = parseMajorAmount(
          values.amount,
          getCurrencyScale(source.currency),
        );
      } catch (error) {
        setError("amount", {
          message:
            error instanceof Error ? error.message : "أدخل مبلغًا صحيحًا",
        });
        return;
      }

      if (workspaceId) {
        const clientId = crypto.randomUUID();
        await postTransfer.mutateAsync({
          sourceWalletId: values.sourceWalletId,
          destinationWalletId: values.destinationWalletId,
          amountMinor: toSafeMinorNumber(amountMinor),
          description: values.note?.trim() || "تحويل بين المحافظ",
          clientId,
        });
      } else if (isDemo) {
        transfer({
          id: crypto.randomUUID(),
          sourceWalletId: values.sourceWalletId,
          destinationWalletId: values.destinationWalletId,
          amountMinor,
          currency: source.currency,
          title: "تحويل بين المحافظ",
          occurredAt: new Date().toISOString(),
          ...(values.note ? { note: values.note.trim() } : {}),
        });
      } else {
        throw new Error("مساحة العمل غير متاحة الآن. أعد المحاولة بعد التحديث.");
      }
      navigate("/wallets", { replace: true });
    } catch (error) {
      setError("root", {
        message:
          error instanceof Error
            ? error.message
            : "تعذر إتمام التحويل",
      });
    }
  };

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="تحويل جديد"
        subtitle="انقل المال بين محافظك دون تغيير إجمالي رصيدك."
        backTo="/"
      />

      {isLoading ? (
        <AppCard
          role="status"
          aria-label="جاري تحميل المحافظ"
          className="h-64 animate-pulse bg-surface-subtle"
        />
      ) : walletsError ? (
        <ErrorState message={walletsError} onRetry={() => void refresh()} />
      ) : !hasTransferPair ? (
        <AppCard className="p-7 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-md bg-primary-soft text-primary">
            <ArrowLeftRight aria-hidden="true" size={23} />
          </span>
          <h2 className="mt-4 font-bold text-ink">
            تحتاج محفظتين بالعملة نفسها
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            التحويل الداخلي لا يغيّر العملة. أضف محفظة ثانية بعملة {currency} أو
            بعملة تطابق إحدى محافظك الحالية.
          </p>
          <button
            type="button"
            onClick={() => navigate("/wallets/new")}
            className="pressable mt-5 min-h-11 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on"
          >
            إضافة محفظة
          </button>
        </AppCard>
      ) : (
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <AppCard className="p-4 sm:p-5">
          <div>
            <label htmlFor="transfer-source" className="text-sm font-bold">
              من محفظة
            </label>
            <select
              id="transfer-source"
              className={`mt-2 ${fieldClassName}`}
              {...register("sourceWalletId")}
            >
              {sourceWallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </select>
            {sourceWallet ? (
              <p className="mt-2 text-xs text-muted">
                الرصيد المتاح:{" "}
                <span className="numeric font-bold text-ink">
                  {formatMinorAmount(sourceWallet.balanceMinor, {
                    currency: sourceWallet.currency,
                    locale: "en-US",
                  })}{" "}
                  {sourceWallet.currency}
                </span>
              </p>
            ) : null}
          </div>

          <div className="my-3 flex justify-center">
            <button
              type="button"
              onClick={swapWallets}
              aria-label="تبديل محفظتي الإرسال والاستلام"
              className="pressable flex size-11 items-center justify-center rounded-full border border-line-strong bg-surface-subtle text-primary hover:bg-primary-soft"
            >
              <ArrowDown aria-hidden="true" size={19} />
            </button>
          </div>

          <div>
            <label
              htmlFor="transfer-destination"
              className="text-sm font-bold"
            >
              إلى محفظة
            </label>
            <select
              id="transfer-destination"
              aria-invalid={Boolean(errors.destinationWalletId)}
              aria-describedby={
                errors.destinationWalletId
                  ? "transfer-destination-error"
                  : undefined
              }
              className={`mt-2 ${fieldClassName}`}
              {...register("destinationWalletId")}
            >
              {destinationWallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </select>
            {errors.destinationWalletId ? (
              <p
                id="transfer-destination-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-danger"
              >
                {errors.destinationWalletId.message}
              </p>
            ) : null}
          </div>
        </AppCard>

        <AppCard className="mt-4 space-y-5 p-4 sm:p-5">
          <div>
            <label htmlFor="transfer-amount" className="text-sm font-bold">
              مبلغ التحويل
            </label>
            <div className="relative mt-2">
              <input
                id="transfer-amount"
                type="text"
                inputMode="decimal"
                dir="ltr"
                placeholder={`0.${"0".repeat(
                  getCurrencyScale(sourceWallet?.currency ?? currency),
                )}`}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={
                  errors.amount ? "transfer-amount-error" : undefined
                }
                className={`${fieldClassName} numeric pl-16 text-left text-lg font-bold`}
                {...register("amount")}
              />
              <span className="absolute top-1/2 left-4 -translate-y-1/2 text-xs font-bold text-muted">
                {sourceWallet?.currency ?? currency}
              </span>
            </div>
            {errors.amount ? (
              <p
                id="transfer-amount-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-danger"
              >
                {errors.amount.message}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="transfer-note" className="text-sm font-bold">
              ملاحظة
              <span className="mr-1 font-normal text-muted">(اختياري)</span>
            </label>
            <textarea
              id="transfer-note"
              rows={3}
              className={`${fieldClassName} mt-2 resize-none py-3`}
              {...register("note")}
            />
          </div>
        </AppCard>

        {errors.root ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger"
          >
            {errors.root.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="pressable mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
        >
          <ArrowLeftRight aria-hidden="true" size={19} />
          {isSubmitting ? "جارٍ التحويل..." : "تأكيد التحويل"}
        </button>
      </form>
      )}
    </div>
  );
}
