import { PawPrint, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateLivestockBatchMutation,
  useLivestockBatchesQuery,
  useLivestockEventsQuery,
  usePostLivestockEventMutation,
} from "@/features/workspace/use-finance-data";
import type {
  LivestockBatch,
  LivestockEvent,
  LivestockEventType,
} from "@/features/workspace/workspace-types";
import { useProjectStore } from "@/features/projects/project-store";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";

const eventLabels: Record<LivestockEventType, string> = {
  hatch: "فقس",
  birth: "ولادة",
  death: "نفوق",
  sale: "بيع",
  transfer: "نقل",
};

const EMPTY_BATCHES: LivestockBatch[] = [];
const EMPTY_EVENTS: LivestockEvent[] = [];

interface ProjectLivestockTabProps {
  isDemo: boolean;
  projectId: string;
}

function LivestockPanel({
  batches,
  busy,
  events,
  headCount,
  name,
  onAddBatch,
  onHeadCountChange,
  onNameChange,
  onPostEvent,
  onQuantityChange,
  onSelectedBatchChange,
  onEventTypeChange,
  quantity,
  selectedBatchId,
  eventType,
}: {
  batches: LivestockBatch[];
  busy: boolean;
  events: LivestockEvent[];
  headCount: string;
  name: string;
  onAddBatch: () => void;
  onHeadCountChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPostEvent: () => void;
  onQuantityChange: (value: string) => void;
  onSelectedBatchChange: (value: string) => void;
  onEventTypeChange: (value: LivestockEventType) => void;
  quantity: string;
  selectedBatchId: string;
  eventType: LivestockEventType;
}) {
  return (
    <>
      <AppCard className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Plus aria-hidden="true" size={16} />
          دفعة جديدة
        </h3>
        <input
          aria-label="اسم الدفعة"
          className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="مثل: دفعة يوليو"
          value={name}
        />
        <input
          aria-label="عدد الرؤوس الابتدائي"
          className="numeric min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-left text-sm"
          dir="ltr"
          inputMode="numeric"
          onChange={(event) => onHeadCountChange(event.target.value)}
          placeholder="عدد الرؤوس"
          value={headCount}
        />
        <button
          className="pressable min-h-11 w-full rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
          disabled={busy}
          onClick={onAddBatch}
          type="button"
        >
          إضافة دفعة
        </button>
      </AppCard>

      {batches.length === 0 ? (
        <EmptyState
          description="أضف دفعة لتسجيل أحداث التكاثر والنفوق والبيع."
          icon={<PawPrint aria-hidden="true" size={22} />}
          title="لا توجد دفعات"
        />
      ) : (
        <>
          <ul className="space-y-2">
            {batches.map((batch) => (
              <li
                className="rounded-md border border-line bg-surface p-4"
                key={batch.id}
              >
                <p className="font-bold text-ink">{batch.name}</p>
                <p className="mt-1 text-xs text-muted">
                  الرؤوس:{" "}
                  <bdi className="numeric" dir="ltr">
                    {batch.headCount}
                  </bdi>
                  {batch.species ? ` · ${batch.species}` : null}
                </p>
              </li>
            ))}
          </ul>

          <AppCard className="space-y-3 p-4">
            <h3 className="text-sm font-bold text-ink">تسجيل حدث</h3>
            <select
              aria-label="الدفعة"
              className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              onChange={(event) => onSelectedBatchChange(event.target.value)}
              value={selectedBatchId}
            >
              <option value="">اختر دفعة</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
            <select
              aria-label="نوع الحدث"
              className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              onChange={(event) =>
                onEventTypeChange(event.target.value as LivestockEventType)
              }
              value={eventType}
            >
              {Object.entries(eventLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              aria-label="الكمية"
              className="numeric min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-left text-sm"
              dir="ltr"
              inputMode="numeric"
              onChange={(event) => onQuantityChange(event.target.value)}
              value={quantity}
            />
            <button
              className="pressable min-h-11 w-full rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
              disabled={busy}
              onClick={onPostEvent}
              type="button"
            >
              حفظ الحدث
            </button>
          </AppCard>

          {events.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-bold text-ink">الخط الزمني</h3>
              <ul className="space-y-2">
                {events.map((event) => (
                  <li
                    className="rounded-sm bg-surface-subtle px-3 py-2 text-xs text-ink"
                    key={event.id}
                  >
                    {eventLabels[event.eventType]} ·{" "}
                    <bdi className="numeric" dir="ltr">
                      {event.quantity}
                    </bdi>{" "}
                    · {event.occurredOn}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

function LiveProjectLivestockTab({ projectId }: { projectId: string }) {
  const batchesQuery = useLivestockBatchesQuery(projectId);
  const eventsQuery = useLivestockEventsQuery(projectId);
  const createBatch = useCreateLivestockBatchMutation(projectId);
  const postEvent = usePostLivestockEventMutation(projectId);
  const [name, setName] = useState("");
  const [headCount, setHeadCount] = useState("0");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [eventType, setEventType] = useState<LivestockEventType>("birth");
  const [quantity, setQuantity] = useState("1");

  const busy = createBatch.isPending || postEvent.isPending;
  const batches = batchesQuery.data ?? EMPTY_BATCHES;
  const events = eventsQuery.data ?? EMPTY_EVENTS;

  const addBatch = () => {
    if (name.trim().length < 2) {
      toast.error("اكتب اسم الدفعة");
      return;
    }
    const count = Number.parseInt(headCount, 10);
    if (!Number.isFinite(count) || count < 0) {
      toast.error("أدخل عدد رؤوس صحيحًا");
      return;
    }
    void createBatch
      .mutateAsync({
        name: name.trim(),
        headCount: count,
        clientId: crypto.randomUUID(),
      })
      .then(() => {
        setName("");
        setHeadCount("0");
        toast.success("أُضيفت الدفعة");
      })
      .catch((error) =>
        toast.error(getUserErrorMessage(error, "تعذر إضافة الدفعة")),
      );
  };

  const handlePostEvent = () => {
    if (!selectedBatchId) {
      toast.error("اختر دفعة");
      return;
    }
    const qty = Number.parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("أدخل كمية صحيحة");
      return;
    }
    void postEvent
      .mutateAsync({
        batchId: selectedBatchId,
        eventType,
        quantity: qty,
        clientId: crypto.randomUUID(),
      })
      .then(() => toast.success("تم تسجيل الحدث"))
      .catch((error) =>
        toast.error(getUserErrorMessage(error, "تعذر تسجيل الحدث")),
      );
  };

  if (batchesQuery.isError || eventsQuery.isError) {
    return (
      <ErrorState
        message={
          batchesQuery.error instanceof Error
            ? batchesQuery.error.message
            : eventsQuery.error instanceof Error
              ? eventsQuery.error.message
              : "تعذر تحميل بيانات الحيوانات"
        }
        onRetry={() => {
          void batchesQuery.refetch();
          void eventsQuery.refetch();
        }}
      />
    );
  }

  return (
    <section aria-labelledby="project-livestock-title" className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink" id="project-livestock-title">
          دورات الحيوانات
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          دفعات وأحداث التكاثر/النفوق/البيع مرتبطة بالخادم مباشرة.
        </p>
      </div>
      <LivestockPanel
        batches={batches}
        busy={busy}
        eventType={eventType}
        events={events}
        headCount={headCount}
        name={name}
        onAddBatch={addBatch}
        onEventTypeChange={setEventType}
        onHeadCountChange={setHeadCount}
        onNameChange={setName}
        onPostEvent={handlePostEvent}
        onQuantityChange={setQuantity}
        onSelectedBatchChange={setSelectedBatchId}
        quantity={quantity}
        selectedBatchId={selectedBatchId}
      />
    </section>
  );
}

function DemoProjectLivestockTab({ projectId }: { projectId: string }) {
  const batches = useProjectStore(
    (state) => state.livestockBatchesByProject[projectId] ?? EMPTY_BATCHES,
  );
  const events = useProjectStore(
    (state) => state.livestockEventsByProject[projectId] ?? EMPTY_EVENTS,
  );
  const createBatch = useProjectStore((state) => state.createLivestockBatch);
  const postEvent = useProjectStore((state) => state.postLivestockEvent);
  const [name, setName] = useState("");
  const [headCount, setHeadCount] = useState("0");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [eventType, setEventType] = useState<LivestockEventType>("birth");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);

  const addBatch = () => {
    if (busy) return;
    setBusy(true);
    try {
      createBatch({
        projectId,
        name,
        headCount: Number.parseInt(headCount, 10) || 0,
      });
      setName("");
      setHeadCount("0");
      toast.success("أُضيفت الدفعة محليًا");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إضافة الدفعة");
    } finally {
      setBusy(false);
    }
  };

  const handlePostEvent = () => {
    if (busy) return;
    setBusy(true);
    try {
      postEvent({
        projectId,
        batchId: selectedBatchId,
        eventType,
        quantity: Number.parseInt(quantity, 10) || 0,
        clientId: crypto.randomUUID(),
      });
      toast.success("تم تسجيل الحدث محليًا");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تسجيل الحدث");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="project-livestock-title" className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink" id="project-livestock-title">
          دورات الحيوانات
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          الوضع التجريبي يحفظ الدفعات والأحداث محليًا في هذه الجلسة.
        </p>
      </div>
      <LivestockPanel
        batches={batches}
        busy={busy}
        eventType={eventType}
        events={events}
        headCount={headCount}
        name={name}
        onAddBatch={addBatch}
        onEventTypeChange={setEventType}
        onHeadCountChange={setHeadCount}
        onNameChange={setName}
        onPostEvent={handlePostEvent}
        onQuantityChange={setQuantity}
        onSelectedBatchChange={setSelectedBatchId}
        quantity={quantity}
        selectedBatchId={selectedBatchId}
      />
    </section>
  );
}

export function ProjectLivestockTab({
  isDemo,
  projectId,
}: ProjectLivestockTabProps) {
  if (isDemo) {
    return <DemoProjectLivestockTab projectId={projectId} />;
  }
  return <LiveProjectLivestockTab projectId={projectId} />;
}
