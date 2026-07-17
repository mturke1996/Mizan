import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownLeft, ArrowUpRight, Save } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useConfirm } from "@/shared/ui/confirm-dialog";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
  formatMajorInputAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import { useFinanceStore } from "@/features/finance/finance-store";
import { useProjectStore } from "@/features/projects/project-store";
import { getTransactionTemplates } from "@/features/transactions/transaction-templates";
import {
  useCategoriesQuery,
  useClientsQuery,
  usePostTransactionMutation,
  useReplaceTransactionMutation,
} from "@/features/workspace/use-finance-data";
import {
  useFinanceView,
  useProjectsView,
} from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { controlClassName } from "@/shared/ui/form-field";
import { PageHeader } from "@/shared/ui/PageHeader";

const transactionSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.string().refine((value) => {
    try {
      return parseMajorAmount(value, 3) > 0n;
    } catch {
      return false;
    }
  }, "أدخل مبلغًا أكبر من صفر"),
  title: z.string().trim().min(2, "اكتب بيانًا واضحًا للمعاملة"),
  walletId: z.string().min(1, "اختر المحفظة"),
  projectId: z.string().optional(),
  categoryId: z.string().optional(),
  businessClientId: z.string().optional(),
  note: z.string().trim().max(300, "الملاحظة أطول من اللازم").optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

function splitTitleAndNote(description: string): {
  title: string;
  note: string;
} {
  const separator = " — ";
  const index = description.indexOf(separator);
  if (index === -1) {
    return { title: description, note: "" };
  }
  return {
    title: description.slice(0, index).trim(),
    note: description.slice(index + separator.length).trim(),
  };
}

export function TransactionFormPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { transactionId } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(transactionId);
  const { workspaceId, currency, isDemo = false } = useWorkspace();
  const {
    wallets,
    transactions,
    isLoading: financeLoading,
    walletsError,
    refresh: refreshFinance,
  } = useFinanceView();
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjectsView();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const updateTransaction = useFinanceStore((state) => state.updateTransaction);
  const applyProjectTransaction = useProjectStore(
    (state) => state.applyProjectTransaction,
  );
  const adjustProjectTransaction = useProjectStore(
    (state) => state.adjustProjectTransaction,
  );
  const postTransaction = usePostTransactionMutation();
  const replaceTransaction = useReplaceTransactionMutation();
  const categoriesQuery = useCategoriesQuery();
  const clientsQuery = useClientsQuery();
  const existing = isEdit
    ? transactions.find((item) => item.id === transactionId)
    : undefined;
  const requestedType = searchParams.get("type");
  const initialKind =
    existing && existing.kind !== "transfer"
      ? existing.kind
      : requestedType === "expense"
        ? "expense"
        : "income";
  const requestedWallet = wallets.find(
    (wallet) => wallet.id === searchParams.get("wallet"),
  );
  const requestedTitle = searchParams.get("title")?.trim() ?? "";
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      kind: initialKind,
      amount: "",
      title: requestedTitle,
      walletId: requestedWallet?.id ?? wallets[0]?.id ?? "",
      projectId: searchParams.get("project") ?? "",
      categoryId: searchParams.get("category") ?? "",
      businessClientId: searchParams.get("client") ?? "",
      note: "",
    },
  });
  const selectedWalletId = useWatch({ control, name: "walletId" });
  const selectedKind = useWatch({ control, name: "kind" });
  const selectedProjectId = useWatch({ control, name: "projectId" });
  const selectedWallet = wallets.find(
    (wallet) => wallet.id === selectedWalletId,
  );
  const canAttachProject = selectedWallet?.currency === currency;
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const categories = (categoriesQuery.data ?? []).filter(
    (category) => category.kind === selectedKind,
  );
  const clients = clientsQuery.data ?? [];
  const templates = useMemo(
    () =>
      getTransactionTemplates({
        kind: selectedKind,
        projectType: selectedProject?.projectType,
      }),
    [selectedKind, selectedProject?.projectType],
  );

  useEffect(() => {
    if (!existing || existing.kind === "transfer") return;
    const parts = splitTitleAndNote(existing.title);
    reset({
      kind: existing.kind,
      amount: formatMajorInputAmount(
        existing.amountMinor,
        getCurrencyScale(existing.currency),
      ),
      title: parts.title || existing.title,
      walletId: existing.walletId,
      projectId: existing.projectId ?? "",
      categoryId: existing.categoryId ?? "",
      businessClientId: "",
      note: existing.note ?? parts.note,
    });
  }, [existing, reset]);

  useEffect(() => {
    if (isEdit) return;
    if (getValues("walletId") || wallets.length === 0) return;
    setValue("walletId", requestedWallet?.id ?? wallets[0]?.id ?? "", {
      shouldValidate: true,
    });
  }, [getValues, isEdit, requestedWallet, setValue, wallets]);

  useEffect(() => {
    if (selectedWallet && !canAttachProject && getValues("projectId")) {
      setValue("projectId", "", { shouldValidate: true });
    }
  }, [canAttachProject, getValues, selectedWallet, setValue]);

  useEffect(() => {
    const currentCategoryId = getValues("categoryId");
    if (!currentCategoryId) return;
    const stillValid = categories.some(
      (category) => category.id === currentCategoryId,
    );
    if (!stillValid) {
      setValue("categoryId", "", { shouldValidate: true });
    }
  }, [categories, getValues, setValue]);

  const onSubmit = async (values: TransactionFormValues) => {
    const wallet = wallets.find((item) => item.id === values.walletId);
    if (!wallet) return;

    let amountMinor: bigint;
    try {
      amountMinor = parseMajorAmount(
        values.amount,
        getCurrencyScale(wallet.currency),
      );
    } catch (error) {
      setError("amount", {
        message:
          error instanceof Error ? error.message : "أدخل مبلغًا أكبر من صفر",
      });
      return;
    }

    // Lite approval: large expenses need an explicit in-app confirm.
    const approvalThreshold =
      1000n * 10n ** BigInt(getCurrencyScale(wallet.currency));
    if (values.kind === "expense" && amountMinor >= approvalThreshold) {
      const ok = await confirm({
        title: "تأكيد مصروف كبير؟",
        description: `المبلغ يعادل أو يتجاوز 1,000 ${wallet.currency}. راجع التفاصيل قبل التسجيل.`,
        tone: "warning",
        confirmLabel: "تسجيل المصروف",
      });
      if (!ok) return;
    }

    const title = values.title.trim();
    const description = values.note?.trim()
      ? `${title} — ${values.note.trim()}`
      : title;
    const projectId = values.projectId || undefined;
    const categoryId = values.categoryId || undefined;
    const businessClientId = values.businessClientId || undefined;

    try {
      if (isEdit) {
        if (!existing || existing.kind === "transfer" || !transactionId) {
          throw new Error("تعديل التحويلات غير مدعوم من هذه الشاشة");
        }

        if (workspaceId) {
          const newEventId = await replaceTransaction.mutateAsync({
            eventId: transactionId,
            walletId: wallet.id,
            kind: values.kind,
            amountMinor: toSafeMinorNumber(amountMinor),
            clientId: crypto.randomUUID(),
            description,
            ...(projectId ? { projectId } : { projectId: null }),
            ...(categoryId ? { categoryId } : {}),
            occurredAt: existing.occurredAt,
          });
          toast.success("تم تعديل المعاملة");
          navigate(`/transactions/${newEventId}`, { replace: true });
          return;
        }

        if (isDemo) {
          updateTransaction(transactionId, {
            id: transactionId,
            kind: values.kind,
            walletId: wallet.id,
            amountMinor,
            currency: wallet.currency,
            title,
            occurredAt: existing.occurredAt,
            ...(projectId ? { projectId } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(values.note?.trim() ? { note: values.note.trim() } : {}),
          });

          if (existing.projectId) {
            adjustProjectTransaction({
              projectId: existing.projectId,
              kind: existing.kind,
              deltaMinor: -existing.amountMinor,
            });
          }
          if (projectId) {
            adjustProjectTransaction({
              projectId,
              kind: values.kind,
              deltaMinor: amountMinor,
            });
          }
          toast.success("تم تعديل المعاملة");
          navigate(`/transactions/${transactionId}`, { replace: true });
          return;
        }

        throw new Error("مساحة العمل غير متاحة الآن. أعد المحاولة بعد التحديث.");
      }

      if (workspaceId) {
        const clientId = crypto.randomUUID();
        if (!navigator.onLine) {
          const { enqueuePostTransaction } = await import("@/lib/offline-queue");
          await enqueuePostTransaction({
            workspaceId,
            clientId,
            walletId: wallet.id,
            kind: values.kind,
            amountMinor: toSafeMinorNumber(amountMinor),
            description,
            ...(projectId ? { projectId } : {}),
            ...(categoryId ? { categoryId } : {}),
          });
          toast.success("حُفظت المعاملة محليًا وستُزامن عند الاتصال");
          navigate("/transactions", { replace: true });
          return;
        }
        await postTransaction.mutateAsync({
          walletId: wallet.id,
          kind: values.kind,
          amountMinor: toSafeMinorNumber(amountMinor),
          clientId,
          description,
          ...(projectId ? { projectId } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(businessClientId ? { businessClientId } : {}),
        });
      } else if (isDemo) {
        addTransaction({
          id: crypto.randomUUID(),
          kind: values.kind,
          walletId: wallet.id,
          amountMinor,
          currency: wallet.currency,
          title,
          occurredAt: new Date().toISOString(),
          ...(projectId ? { projectId } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(values.note ? { note: values.note.trim() } : {}),
        });
        if (projectId) {
          applyProjectTransaction({
            projectId,
            kind: values.kind,
            amountMinor,
          });
        }
      } else {
        throw new Error("مساحة العمل غير متاحة الآن. أعد المحاولة بعد التحديث.");
      }
      navigate("/transactions", { replace: true });
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر الحفظ"));
    }
  };

  const inputClassName = `${controlClassName} min-h-12 px-4`;
  const formError = walletsError ?? projectsError;
  const pageTitle = isEdit ? "تعديل المعاملة" : "معاملة جديدة";
  const pageSubtitle = isEdit
    ? "عدّل المحفظة أو المبلغ أو المشروع ثم احفظ."
    : "تُحفظ مباشرة في دفترك المالي.";
  const backTo = isEdit
    ? `/transactions/${transactionId}`
    : "/transactions";

  if (financeLoading || projectsLoading) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          backTo={backTo}
        />
        <AppCard
          role="status"
          aria-label="جاري تحميل نموذج المعاملة"
          className="h-72 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  if (formError) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          backTo={backTo}
        />
        <ErrorState
          message={formError}
          onRetry={() =>
            void Promise.all([refreshFinance(), refreshProjects()])
          }
        />
      </div>
    );
  }

  if (isEdit && !existing) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title="المعاملة غير موجودة"
          subtitle="قد تكون حُذفت أو تغير رابطها."
          backTo="/transactions"
        />
      </div>
    );
  }

  if (isEdit && existing?.kind === "transfer") {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title="تعديل التحويل غير متاح"
          subtitle="يمكن حذف التحويل وإعادة إنشائه من شاشة التحويل."
          backTo={`/transactions/${transactionId}`}
        />
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          backTo={backTo}
        />
        <AppCard className="p-7 text-center">
          <h2 className="font-bold text-ink">أضف محفظة أولًا</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            كل معاملة يجب أن ترتبط بمحفظة حتى يبقى رصيدك دقيقًا.
          </p>
          <Link
            to="/wallets/new"
            className="pressable mt-5 inline-flex min-h-11 items-center rounded-sm bg-primary px-4 text-sm font-bold text-primary-on"
          >
            إنشاء محفظة
          </Link>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        backTo={backTo}
      />

      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <AppCard className="mb-4 p-4 sm:p-5">
          <fieldset>
            <legend className="mb-3 text-sm font-bold text-ink">
              نوع المعاملة
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="relative">
                <input
                  type="radio"
                  value="income"
                  className="peer sr-only"
                  {...register("kind")}
                />
                <span className="pressable flex min-h-14 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface text-sm font-bold text-muted peer-checked:border-success peer-checked:bg-success-soft peer-checked:text-success peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                  <ArrowDownLeft aria-hidden="true" size={19} />
                  دخل
                </span>
              </label>
              <label className="relative">
                <input
                  type="radio"
                  value="expense"
                  className="peer sr-only"
                  {...register("kind")}
                />
                <span className="pressable flex min-h-14 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface text-sm font-bold text-muted peer-checked:border-danger peer-checked:bg-danger-soft peer-checked:text-danger peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                  <ArrowUpRight aria-hidden="true" size={19} />
                  مصروف
                </span>
              </label>
            </div>
          </fieldset>
        </AppCard>

        {!isEdit && templates.length > 0 ? (
          <AppCard className="mb-4 p-4 sm:p-5">
            <h2 className="text-sm font-bold text-ink">قوالب سريعة</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              املأ البيان والنوع بسرعة من اختصارات شائعة أو فئات المشروع.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {templates.map((template) => (
                <button
                  className="pressable min-h-10 rounded-sm border border-line bg-surface-subtle px-3 text-xs font-bold text-ink hover:bg-primary-soft hover:text-primary-ink"
                  key={template.id}
                  onClick={() => {
                    setValue("kind", template.kind, { shouldValidate: true });
                    setValue("title", template.title, { shouldValidate: true });
                    const matched = (categoriesQuery.data ?? []).find(
                      (category) =>
                        category.kind === template.kind &&
                        category.name === template.title,
                    );
                    setValue("categoryId", matched?.id ?? "", {
                      shouldValidate: true,
                    });
                  }}
                  type="button"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </AppCard>
        ) : null}

        <AppCard className="space-y-5 p-4 sm:p-5">
          <div>
            <label htmlFor="transaction-amount" className="text-sm font-bold">
              المبلغ
            </label>
            <div className="relative mt-2">
              <input
                id="transaction-amount"
                type="text"
                inputMode="decimal"
                dir="ltr"
                placeholder={`0.${"0".repeat(
                  getCurrencyScale(selectedWallet?.currency ?? currency),
                )}`}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={
                  errors.amount ? "transaction-amount-error" : undefined
                }
                className={`${inputClassName} numeric pl-16 text-left text-lg font-bold`}
                {...register("amount")}
              />
              <span className="absolute top-1/2 left-4 -translate-y-1/2 text-xs font-bold text-muted">
                {selectedWallet?.currency ?? currency}
              </span>
            </div>
            {errors.amount ? (
              <p
                id="transaction-amount-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-danger"
              >
                {errors.amount.message}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="transaction-title" className="text-sm font-bold">
              البيان
            </label>
            <input
              id="transaction-title"
              type="text"
              placeholder="مثل: دفعة من عميل"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={
                errors.title ? "transaction-title-error" : undefined
              }
              className={`mt-2 ${inputClassName}`}
              {...register("title")}
            />
            {errors.title ? (
              <p
                id="transaction-title-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-danger"
              >
                {errors.title.message}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="transaction-wallet" className="text-sm font-bold">
              المحفظة / الخزنة
            </label>
            <select
              id="transaction-wallet"
              className={`mt-2 ${inputClassName}`}
              {...register("walletId")}
            >
              {wallets.length === 0 ? (
                <option value="">لا محافظ — أنشئ محفظة أولًا</option>
              ) : null}
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} • {wallet.currency}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="transaction-project" className="text-sm font-bold">
              المشروع
              <span className="mr-1 font-normal text-muted">(اختياري)</span>
            </label>
            <select
              id="transaction-project"
              disabled={!canAttachProject}
              className={`mt-2 ${inputClassName}`}
              {...register("projectId")}
            >
              <option value="">بدون مشروع</option>
              {projects
                .filter((project) => project.status === "active")
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
            {!canAttachProject ? (
              <p className="mt-2 text-xs leading-5 text-warning">
                ربط المشاريع متاح فقط لمحافظ العملة الأساسية {currency} حتى
                تبقى الأرباح ومستحقات العمال قابلة للمقارنة.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="transaction-client" className="text-sm font-bold">
              العميل
              <span className="mr-1 font-normal text-muted">(اختياري)</span>
            </label>
            <select
              id="transaction-client"
              className={`mt-2 ${inputClassName}`}
              {...register("businessClientId")}
            >
              <option value="">بدون عميل</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                  {client.phone ? ` • ${client.phone}` : ""}
                </option>
              ))}
            </select>
            {workspaceId && clientsQuery.isLoading ? (
              <p className="mt-2 text-xs text-muted">جارٍ تحميل العملاء…</p>
            ) : clients.length === 0 && workspaceId ? (
              <p className="mt-2 text-xs text-muted">
                لا يوجد عملاء بعد — يمكنك إضافتهم من{" "}
                <Link to="/clients" className="font-semibold text-primary">
                  العملاء
                </Link>
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="transaction-category" className="text-sm font-bold">
              الفئة
              <span className="mr-1 font-normal text-muted">(اختياري)</span>
            </label>
            <select
              id="transaction-category"
              className={`mt-2 ${inputClassName}`}
              {...register("categoryId")}
            >
              <option value="">بدون فئة</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {workspaceId && categoriesQuery.isLoading ? (
              <p className="mt-2 text-xs text-muted">جارٍ تحميل الفئات…</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="transaction-note" className="text-sm font-bold">
              ملاحظة
              <span className="mr-1 font-normal text-muted">(اختياري)</span>
            </label>
            <textarea
              id="transaction-note"
              rows={3}
              className={`mt-2 resize-none py-3 ${inputClassName}`}
              {...register("note")}
            />
          </div>
        </AppCard>

        <button
          type="submit"
          disabled={
            isSubmitting ||
            wallets.length === 0 ||
            postTransaction.isPending ||
            replaceTransaction.isPending
          }
          className="pressable mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
        >
          <Save aria-hidden="true" size={19} />
          {isSubmitting
            ? "جارٍ الحفظ..."
            : isEdit
              ? "حفظ التعديلات"
              : "حفظ المعاملة"}
        </button>
      </form>
    </div>
  );
}
