import { useState } from "react";
import { Plus, Users } from "lucide-react";
import {
  useClientsQuery,
  useUpsertClientMutation,
} from "@/features/workspace/use-finance-data";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";
import { ErrorState } from "@/shared/ui/ErrorState";
import { getUserErrorMessage } from "@/lib/user-error";

export function ClientsPage() {
  const clientsQuery = useClientsQuery();
  const upsertClient = useUpsertClientMutation();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const clients = clientsQuery.data ?? [];
  const inputClass =
    "w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink placeholder:text-muted";

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await upsertClient.mutateAsync({
      name: name.trim(),
      phone: phone.trim() || undefined,
    });
    setName("");
    setPhone("");
    setShowForm(false);
  };

  if (clientsQuery.isLoading) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="العملاء" subtitle="زبائن أعمالك" />
        <AppCard
          role="status"
          className="h-40 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  if (clientsQuery.isError) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="العملاء" subtitle="زبائن أعمالك" />
        <ErrorState
          message={getUserErrorMessage(clientsQuery.error, "تعذر تحميل العملاء")}
          onRetry={() => void clientsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pb-6" dir="rtl">
      <PageHeader
        title="العملاء"
        subtitle={`${clients.length} عميل`}
        backTo="/"
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-on"
          >
            <Plus size={14} />
            إضافة
          </button>
        }
      />

      {showForm ? (
        <AppCard className="mb-5 rounded-[18px] p-4">
          <h3 className="mb-3 text-sm font-bold text-ink">عميل جديد</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم *"
              required
              className={inputClass}
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الهاتف (اختياري)"
              className={inputClass}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={upsertClient.isPending || !name.trim()}
                className="pressable flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-on disabled:opacity-50"
              >
                {upsertClient.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl bg-surface-subtle px-4 py-2.5 text-sm font-medium text-muted"
              >
                إلغاء
              </button>
            </div>
          </form>
        </AppCard>
      ) : null}

      {clients.length === 0 && !showForm ? (
        <AppCard className="px-6 py-12 text-center">
          <Users className="mx-auto text-muted" size={36} />
          <p className="mt-3 text-sm font-semibold text-ink">لا يوجد عملاء</p>
          <p className="mt-1 text-xs text-muted">
            أضفهم لربطهم بالفواتير ومعاملات الدخل والمصروف
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="pressable mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-on"
          >
            <Plus size={14} />
            إضافة عميل
          </button>
        </AppCard>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {client.name}
                </p>
                {client.phone ? (
                  <p className="text-[11px] text-muted" dir="ltr">
                    {client.phone}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-[10px] text-muted">
                {new Date(client.createdAt).toLocaleDateString("ar-LY")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
