import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  Pencil,
  Pause,
  Play,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatMinorAmount, getCurrencyScale } from "@/domain/money/money";
import {
  useCategoriesQuery,
  useDeleteRecurring,
  useProjectsQuery,
  useRecurringQuery,
  useUpsertRecurring,
  useWalletsQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type {
  CategoryKind,
  RecurringFrequency,
  RecurringRecord,
} from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { controlClassName } from "@/shared/ui/form-field";
import { PageHeader } from "@/shared/ui/PageHeader";

const inputClass = controlClassName;

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
  yearly: "سنوي",
};

function frequencyLabel(frequency: RecurringFrequency, steps: number): string {
  if (steps <= 1) return FREQUENCY_LABEL[frequency];
  return `كل ${steps} ${FREQUENCY_LABEL[frequency]}`;
}

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface FormState {
  title: string;
  kind: CategoryKind;
  walletId: string;
  amount: string;
  categoryId: string;
  projectId: string;
  frequency: RecurringFrequency;
  intervalSteps: string;
  nextDate: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  kind: "expense",
  walletId: "",
  amount: "",
  categoryId: "",
  projectId: "",
  frequency: "monthly",
  intervalSteps: "1",
  nextDate: todayIso(),
};

function formFromRecord(record: RecurringRecord): FormState {
  return {
    title: record.title,
    kind: record.kind,
    walletId: record.walletId,
    amount: "",
    categoryId: record.categoryId ?? "",
    projectId: record.projectId ?? "",
    frequency: record.frequency,
    intervalSteps: String(record.intervalSteps),
    nextDate: record.nextDate,
  };
}

function parseMajorToMinor(value: string, scale: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return BigInt(Math.round(parsed * 10 ** scale));
}

export function RecurringSettingsPage() {
  const { isDemo = false } = useWorkspace();
  const walletsQuery = useWalletsQuery();
  const projectsQuery = useProjectsQuery();
  const categoriesQuery = useCategoriesQuery();
  const recurringQuery = useRecurringQuery();
  const upsert = useUpsertRecurring();
  const deleteRecurring = useDeleteRecurring();

  const wallets = walletsQuery.data ?? [];
  const projects = useMemo(
    () => (projectsQuery.data ?? []).filter((project) => project.status === "active"),
    [projectsQuery.data],
  );
  const categories = categoriesQuery.data ?? [];
  const recurring = recurringQuery.data ?? [];

  const walletName = useMemo(
    () => new Map(wallets.map((wallet) => [wallet.id, wallet.name])),
    [wallets],
  );
  const walletCurrency = useMemo(
    () => new Map(wallets.map((wallet) => [wallet.id, wallet.currency])),
    [wallets],
  );

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (editingId) return;
    if (form.walletId || wallets.length === 0) return;
    setForm((previous) => ({ ...previous, walletId: wallets[0]!.id }));
  }, [wallets, form.walletId, editingId]);

  const filteredCategories = categories.filter(
    (category) => category.kind === form.kind,
  );

  function updateForm(patch: Partial<FormState>) {
    setForm((previous) => ({ ...previous, ...patch }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(record: RecurringRecord) {
    setForm(formFromRecord(record));
    setEditingId(record.id);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function submit() {
    const wallet = wallets.find((item) => item.id === form.walletId);
    if (!wallet) {
      toast.error("اختر محفظة");
      return;
    }
    const limitMinor = parseMajorToMinor(
      form.amount,
      getCurrencyScale(wallet.currency),
    );
    if (!limitMinor) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    if (!form.title.trim()) {
      toast.error("أدخل وصفًا للحركة");
      return;
    }
    if (!form.nextDate) {
      toast.error("اختر تاريخ الاستحقاق القادم");
      return;
    }
    const intervalSteps = Number(form.intervalSteps);
    if (!Number.isFinite(intervalSteps) || intervalSteps <= 0) {
      toast.error("أدخل فترة صحيحة");
      return;
    }
    upsert.mutate(
      {
        id: editingId ?? undefined,
        title: form.title.trim(),
        kind: form.kind,
        amountMinor: limitMinor,
        currencyCode: wallet.currency,
        walletId: wallet.id,
        categoryId: form.categoryId || null,
        projectId: form.projectId || null,
        frequency: form.frequency,
        intervalSteps,
        nextDate: form.nextDate,
        isActive: true,
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "تم تحديث الحركة المتكررة" : "أُضيفت الحركة المتكررة");
          resetForm();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function togglePause(record: RecurringRecord) {
    upsert.mutate(
      {
        id: record.id,
        title: record.title,
        kind: record.kind,
        amountMinor: record.amountMinor,
        currencyCode: record.currencyCode,
        walletId: record.walletId,
        categoryId: record.categoryId,
        projectId: record.projectId,
        frequency: record.frequency,
        intervalSteps: record.intervalSteps,
        nextDate: record.nextDate,
        isActive: !record.isActive,
      },
      {
        onSuccess: () =>
          toast.success(record.isActive ? "تم إيقاف الحركة مؤقتًا" : "أُعيد تفعيل الحركة"),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function remove(record: RecurringRecord) {
    deleteRecurring.mutate(record.id, {
      onSuccess: () => {
        toast.success("حُذفت الحركة المتكررة");
        if (editingId === record.id) resetForm();
      },
      onError: (error) => toast.error(error.message),
    });
  }

  if (isDemo) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title="الحركات المتكررة"
          subtitle="جدول الحركات الدورية وترحيلها تلقائيًا عند الاستحقاق."
          backTo="/settings"
        />
        <AppCard className="p-4 sm:p-5">
          <p className="text-sm leading-6 text-muted">
            الحركات المتكررة متاحة في مساحة العمل الفعلية.
          </p>
        </AppCard>
      </div>
    );
  }

  const isLoading =
    walletsQuery.isLoading ||
    projectsQuery.isLoading ||
    categoriesQuery.isLoading ||
    recurringQuery.isLoading;
  const error =
    walletsQuery.error ??
    projectsQuery.error ??
    categoriesQuery.error ??
    recurringQuery.error;

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="الحركات المتكررة"
        subtitle="جدول الحركات الدورية وترحيلها تلقائيًا عند الاستحقاق."
        backTo="/settings"
      />

      <AppCard className="mb-5 flex items-start gap-3 p-4 sm:p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary">
          <Repeat aria-hidden="true" size={20} />
        </span>
        <p className="text-sm leading-6 text-muted">
          عند فتح التطبيق، تُرحّل الحركات المستحقة تلقائيًا إلى السجل بنفس
          قواعد الحركات العادية. كل حركة مستحقة تُسجّل مرة واحدة فقط حتى لو فتحت
          التطبيق مرات عديدة. أوقفها مؤقتًا أو احذفها متى شئت.
        </p>
      </AppCard>

      {isLoading ? (
        <div className="space-y-3" role="status">
          {[0, 1].map((item) => (
            <AppCard key={item} className="h-40 animate-pulse bg-surface-subtle" />
          ))}
          <span className="sr-only">جاري التحميل</span>
        </div>
      ) : error ? (
        <ErrorState
          message={error.message}
          onRetry={() =>
            void Promise.all([
              walletsQuery.refetch(),
              projectsQuery.refetch(),
              categoriesQuery.refetch(),
              recurringQuery.refetch(),
            ])
          }
        />
      ) : (
        <>
          <AppCard className="mb-5 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line p-3 sm:px-5">
              <Plus aria-hidden="true" size={17} className="text-primary" />
              <h2 className="text-sm font-bold text-ink">
                {editingId ? "تعديل حركة متكررة" : "إضافة حركة متكررة"}
              </h2>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="pressable mr-auto flex items-center gap-1 text-xs font-semibold text-muted"
                >
                  <X aria-hidden="true" size={14} />
                  إلغاء التعديل
                </button>
              ) : null}
            </div>
            <div className="space-y-3 p-3 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    الوصف
                  </label>
                  <input
                    aria-label="الوصف"
                    value={form.title}
                    onChange={(event) => updateForm({ title: event.target.value })}
                    placeholder="مثال: إيجار المحل"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    النوع
                  </label>
                  <select
                    aria-label="النوع"
                    value={form.kind}
                    onChange={(event) =>
                      updateForm({
                        kind: event.target.value as CategoryKind,
                        categoryId: "",
                      })
                    }
                    className={inputClass}
                  >
                    <option value="expense">مصروف</option>
                    <option value="income">دخل</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    المحفظة
                  </label>
                  <select
                    aria-label="المحفظة"
                    value={form.walletId}
                    onChange={(event) => updateForm({ walletId: event.target.value })}
                    className={inputClass}
                  >
                    {wallets.length === 0 ? (
                      <option value="">لا توجد محافظ</option>
                    ) : (
                      wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name} ({wallet.currency})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    المبلغ
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    aria-label="المبلغ"
                    value={form.amount}
                    onChange={(event) => updateForm({ amount: event.target.value })}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    التصنيف (اختياري)
                  </label>
                  <select
                    aria-label="التصنيف"
                    value={form.categoryId}
                    onChange={(event) => updateForm({ categoryId: event.target.value })}
                    className={inputClass}
                  >
                    <option value="">بدون تصنيف</option>
                    {filteredCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    المشروع (اختياري)
                  </label>
                  <select
                    aria-label="المشروع"
                    value={form.projectId}
                    onChange={(event) => updateForm({ projectId: event.target.value })}
                    className={inputClass}
                  >
                    <option value="">بدون مشروع</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    التكرار
                  </label>
                  <select
                    aria-label="التكرار"
                    value={form.frequency}
                    onChange={(event) =>
                      updateForm({ frequency: event.target.value as RecurringFrequency })
                    }
                    className={inputClass}
                  >
                    <option value="daily">يومي</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="monthly">شهري</option>
                    <option value="yearly">سنوي</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    كل (عدد)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    aria-label="كل"
                    value={form.intervalSteps}
                    onChange={(event) => updateForm({ intervalSteps: event.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    تاريخ الاستحقاق القادم
                  </label>
                  <input
                    type="date"
                    aria-label="تاريخ الاستحقاق القادم"
                    value={form.nextDate}
                    onChange={(event) => updateForm({ nextDate: event.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={upsert.isPending}
                  className="pressable flex min-h-11 items-center gap-1 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on disabled:opacity-50"
                >
                  <Check aria-hidden="true" size={17} />
                  {editingId ? "تحديث" : "إضافة"}
                </button>
              </div>
            </div>
          </AppCard>

          {recurring.length === 0 ? (
            <AppCard className="p-6 text-center">
              <CalendarClock
                aria-hidden="true"
                size={28}
                className="mx-auto mb-2 text-muted"
              />
              <p className="text-sm text-muted">
                لا توجد حركات متكررة مجدولة بعد.
              </p>
            </AppCard>
          ) : (
            <AppCard className="overflow-hidden">
              <ul className="divide-y divide-line">
                {recurring.map((record) => {
                  const currency = walletCurrency.get(record.walletId) ?? record.currencyCode;
                  const overdue =
                    record.isActive && record.nextDate <= todayIso();
                  return (
                    <li key={record.id} className="p-3 sm:px-5 sm:py-4">
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm ${
                            record.kind === "income"
                              ? "bg-success-soft text-success"
                              : "bg-danger-soft text-danger"
                          }`}
                        >
                          {record.kind === "income" ? (
                            <ArrowDownLeft aria-hidden="true" size={17} />
                          ) : (
                            <ArrowUpRight aria-hidden="true" size={17} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-bold ${
                              record.isActive ? "text-ink" : "text-muted line-through"
                            }`}
                          >
                            {record.title}
                          </p>
                          <p className="numeric mt-0.5 text-xs text-muted" dir="ltr">
                            {formatMinorAmount(record.amountMinor, {
                              currency,
                              locale: "en-US",
                            })}{" "}
                            · {walletName.get(record.walletId) ?? "محفظة"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {frequencyLabel(record.frequency, record.intervalSteps)} ·
                            الاستحقاق القادم {record.nextDate}
                            {overdue ? (
                              <span className="mr-1 font-semibold text-warning">
                                (مستحق)
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(record)}
                            disabled={upsert.isPending}
                            aria-label="تعديل"
                            className="pressable flex size-9 items-center justify-center rounded-sm text-muted hover:bg-surface-subtle hover:text-ink disabled:opacity-50"
                          >
                            <Pencil aria-hidden="true" size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePause(record)}
                            disabled={upsert.isPending}
                            aria-label={record.isActive ? "إيقاف مؤقت" : "تفعيل"}
                            className="pressable flex size-9 items-center justify-center rounded-sm text-muted hover:bg-surface-subtle hover:text-ink disabled:opacity-50"
                          >
                            {record.isActive ? (
                              <Pause aria-hidden="true" size={16} />
                            ) : (
                              <Play aria-hidden="true" size={16} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(record)}
                            disabled={deleteRecurring.isPending}
                            aria-label="حذف"
                            className="pressable flex size-9 items-center justify-center rounded-sm text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                          >
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </AppCard>
          )}
        </>
      )}
    </div>
  );
}
