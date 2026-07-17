import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Tag,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useAllCategoriesQuery,
  useUpsertCategory,
} from "@/features/workspace/use-finance-data";
import type {
  CategoryKind,
  CategoryRecord,
} from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { controlClassName } from "@/shared/ui/form-field";
import { PageHeader } from "@/shared/ui/PageHeader";

const kindMeta: Record<
  CategoryKind,
  { label: string; icon: typeof ArrowDownLeft; tone: string }
> = {
  income: {
    label: "تصنيفات الدخل",
    icon: ArrowDownLeft,
    tone: "bg-success-soft text-success",
  },
  expense: {
    label: "تصنيفات المصروفات",
    icon: ArrowUpRight,
    tone: "bg-danger-soft text-danger",
  },
};

const inputClass = controlClassName;

function AddCategoryForm({ kind }: { kind: CategoryKind }) {
  const [name, setName] = useState("");
  const upsert = useUpsertCategory();
  const meta = kindMeta[kind];
  const Icon = meta.icon;

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    upsert.mutate(
      { name: trimmed, kind, isActive: true },
      {
        onSuccess: () => {
          setName("");
          toast.success("أُضيف التصنيف");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Icon
          aria-hidden="true"
          size={17}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
        />
        <input
          aria-label={`إضافة تصنيف ${kind === "income" ? "دخل" : "مصروف"}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="اسم التصنيف الجديد"
          className={`${inputClass} pr-9`}
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim() || upsert.isPending}
        className="pressable flex min-h-11 items-center gap-1 rounded-sm bg-primary px-3 text-sm font-bold text-primary-on disabled:opacity-50"
      >
        <Plus aria-hidden="true" size={17} />
        إضافة
      </button>
    </div>
  );
}

function CategoryRow({
  category,
}: {
  category: CategoryRecord;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const upsert = useUpsertCategory();

  const reset = () => {
    setDraft(category.name);
    setEditing(false);
  };

  function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === category.name) {
      reset();
      return;
    }
    upsert.mutate(
      { id: category.id, name: trimmed, kind: category.kind, isActive: category.isActive },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success("تم تحديث التصنيف");
        },
        onError: (error) => {
          toast.error(error.message);
          reset();
        },
      },
    );
  }

  function toggleActive() {
    upsert.mutate(
      {
        id: category.id,
        name: category.name,
        kind: category.kind,
        isActive: !category.isActive,
      },
      {
        onSuccess: () =>
          toast.success(category.isActive ? "أُرشف التصنيف" : "أُعيد تفعيل التصنيف"),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  if (category.isSystem) {
    return (
      <li className="flex min-h-14 items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{category.name}</span>
          <span className="text-[11px] text-muted">تصنيف افتراضي غير قابل للتعديل</span>
        </span>
        <span className="rounded-sm bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-muted">
          افتراضي
        </span>
      </li>
    );
  }

  return (
    <li className="flex min-h-14 items-center gap-2 px-4 py-2">
      {editing ? (
        <>
          <input
            aria-label="تعديل اسم التصنيف"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") reset();
            }}
            className={inputClass}
            autoFocus
          />
          <button
            type="button"
            onClick={save}
            disabled={upsert.isPending}
            aria-label="حفظ"
            className="pressable flex size-9 shrink-0 items-center justify-center rounded-sm bg-success-soft text-success disabled:opacity-50"
          >
            <Check aria-hidden="true" size={17} />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="إلغاء"
            className="pressable flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-subtle text-muted"
          >
            <X aria-hidden="true" size={17} />
          </button>
        </>
      ) : (
        <>
          <span
            className={`min-w-0 flex-1 truncate text-sm font-semibold ${
              category.isActive ? "text-ink" : "text-muted line-through"
            }`}
          >
            {category.name}
          </span>
          {!category.isActive ? (
            <span className="rounded-sm bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-muted">
              مؤرشف
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setDraft(category.name);
              setEditing(true);
            }}
            aria-label="تعديل"
            className="pressable flex size-9 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-subtle hover:text-ink"
          >
            <Pencil aria-hidden="true" size={16} />
          </button>
          <button
            type="button"
            onClick={toggleActive}
            disabled={upsert.isPending}
            aria-label={category.isActive ? "أرشفة" : "إعادة تفعيل"}
            className="pressable flex size-9 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-subtle hover:text-ink disabled:opacity-50"
          >
            {category.isActive ? (
              <Archive aria-hidden="true" size={16} />
            ) : (
              <RotateCcw aria-hidden="true" size={16} />
            )}
          </button>
        </>
      )}
    </li>
  );
}

function CategorySection({
  kind,
  categories,
}: {
  kind: CategoryKind;
  categories: CategoryRecord[];
}) {
  const meta = kindMeta[kind];
  const Icon = meta.icon;
  const active = categories.filter((category) => category.isActive);
  const archived = categories.filter((category) => !category.isActive);

  return (
    <section aria-labelledby={`category-${kind}-title`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex size-8 items-center justify-center rounded-sm ${meta.tone}`}>
          <Icon aria-hidden="true" size={17} />
        </span>
        <h2 id={`category-${kind}-title`} className="text-sm font-bold text-ink">
          {meta.label}
        </h2>
        <span className="text-xs text-muted">({active.length} نشط)</span>
      </div>

      <AppCard className="mb-3 overflow-hidden">
        <div className="border-b border-line p-3">
          <AddCategoryForm kind={kind} />
        </div>
        {active.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            لا توجد تصنيفات نشطة بعد.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {active.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </ul>
        )}
      </AppCard>

      {archived.length > 0 ? (
        <details className="group">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-1 text-xs font-semibold text-muted">
            <span>مؤرشف ({archived.length})</span>
          </summary>
          <AppCard className="mt-2 overflow-hidden">
            <ul className="divide-y divide-line">
              {archived.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))}
            </ul>
          </AppCard>
        </details>
      ) : null}
    </section>
  );
}

export function CategoriesSettingsPage() {
  const { data, isLoading, error, refetch } = useAllCategoriesQuery();
  const categories = data ?? [];

  const income = categories.filter((category) => category.kind === "income");
  const expense = categories.filter((category) => category.kind === "expense");

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="التصنيفات"
        subtitle="نظّم الدخل والمصروفات لتقارير وميزانيات أدق."
        backTo="/settings"
      />

      <AppCard className="mb-5 flex items-start gap-3 p-4 sm:p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary">
          <Tag aria-hidden="true" size={20} />
        </span>
        <p className="text-sm leading-6 text-muted">
          التصنيفات تُربط بالمعاملات لتغذية تحليل الإنفاق والميزانيات لاحقًا.
          يمكنك إضافة وتعديل وأرشفة التصنيفات. لا تُحذف نهائيًا حتى تبقى
          الحركات التاريخية صحيحة.
        </p>
      </AppCard>

      {isLoading ? (
        <div className="space-y-3" role="status">
          {[0, 1].map((item) => (
            <AppCard key={item} className="h-40 animate-pulse bg-surface-subtle" />
          ))}
          <span className="sr-only">جاري تحميل التصنيفات</span>
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-6">
          <CategorySection kind="income" categories={income} />
          <CategorySection kind="expense" categories={expense} />
        </div>
      )}
    </div>
  );
}
