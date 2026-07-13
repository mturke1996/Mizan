import { Boxes, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import {
  useArchiveInventoryItemMutation,
  useCreateInventoryLocationMutation,
  useInventoryItemsQuery,
  useInventoryLocationsQuery,
  useInventoryMovementsQuery,
  usePostInventoryMovementMutation,
  useUpsertInventoryItemMutation,
} from "@/features/workspace/use-finance-data";
import type {
  InventoryItem,
  ProjectSummary,
} from "@/features/workspace/workspace-types";
import { getUserErrorMessage } from "@/lib/user-error";
import { useProjectStore } from "@/features/projects/project-store";
import { AppCard } from "@/shared/ui/AppCard";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";

const EMPTY_INVENTORY_ITEMS: InventoryItem[] = [];

interface ProjectInventoryTabProps {
  currency: string;
  isDemo: boolean;
  project: ProjectSummary;
}

function itemValueMinor(item: InventoryItem): bigint {
  if (item.unitCostMinor == null) return 0n;
  return BigInt(Math.round(item.quantity)) * item.unitCostMinor;
}

function InventoryList({
  busy,
  currency,
  editingId,
  items,
  onArchive,
  onEdit,
}: {
  busy: boolean;
  currency: string;
  editingId: string | null;
  items: InventoryItem[];
  onArchive: (itemId: string) => void;
  onEdit: (item: InventoryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        description="أضف أصنافًا بكمية ووحدة وتكلفة تقديرية لمتابعة قيمة المخزون."
        icon={<Boxes aria-hidden="true" size={22} />}
        title="لا توجد أصناف مسجّلة"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          className={`flex items-start justify-between gap-3 rounded-md border p-4 ${
            editingId === item.id
              ? "border-primary bg-primary-soft/30"
              : "border-line bg-surface"
          }`}
          key={item.id}
        >
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{item.name}</p>
            <p className="mt-1 text-xs text-muted">
              <bdi className="numeric" dir="ltr">
                {item.quantity}
              </bdi>{" "}
              {item.unitLabel}
              {item.unitCostMinor != null ? (
                <>
                  {" "}
                  · تكلفة الوحدة{" "}
                  <bdi className="numeric" dir="ltr">
                    {formatMinorAmount(item.unitCostMinor, {
                      currency: item.currencyCode || currency,
                      locale: "en-US",
                    })}
                  </bdi>
                </>
              ) : null}
              {item.barcode ? (
                <>
                  {" "}
                  · باركود{" "}
                  <bdi className="numeric" dir="ltr">
                    {item.barcode}
                  </bdi>
                </>
              ) : null}
              {item.locationId ? <> · موقع مرتبط</> : null}
            </p>
            <p className="mt-2 text-xs font-semibold text-ink">
              القيمة التقديرية{" "}
              <bdi className="numeric" dir="ltr">
                {formatMinorAmount(itemValueMinor(item), {
                  currency: item.currencyCode || currency,
                  locale: "en-US",
                })}
              </bdi>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              aria-label={`تعديل ${item.name}`}
              className="pressable grid size-11 place-items-center rounded-sm border border-line text-muted hover:bg-surface-subtle hover:text-ink"
              disabled={busy}
              onClick={() => onEdit(item)}
              type="button"
            >
              <Pencil aria-hidden="true" size={16} />
            </button>
            <button
              aria-label={`أرشفة ${item.name}`}
              className="pressable grid size-11 place-items-center rounded-sm border border-line text-muted hover:bg-danger-soft hover:text-danger"
              disabled={busy}
              onClick={() => onArchive(item.id)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function InventoryForm({
  barcode,
  busy,
  currency,
  editingId,
  locationId,
  locations,
  name,
  onBarcodeChange,
  onCancelEdit,
  onLocationChange,
  onNameChange,
  onQuantityChange,
  onSubmit,
  onUnitCostChange,
  onUnitLabelChange,
  quantity,
  scale,
  unitCost,
  unitLabel,
}: {
  barcode: string;
  busy: boolean;
  currency: string;
  editingId: string | null;
  locationId: string;
  locations: Array<{ id: string; name: string }>;
  name: string;
  onBarcodeChange: (value: string) => void;
  onCancelEdit: () => void;
  onLocationChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onSubmit: () => void;
  onUnitCostChange: (value: string) => void;
  onUnitLabelChange: (value: string) => void;
  quantity: string;
  scale: number;
  unitCost: string;
  unitLabel: string;
}) {
  return (
    <AppCard className="space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          {editingId ? (
            <Pencil aria-hidden="true" size={16} />
          ) : (
            <Plus aria-hidden="true" size={16} />
          )}
          {editingId ? "تعديل الصنف" : "صنف جديد"}
        </h3>
        {editingId ? (
          <button
            aria-label="إلغاء التعديل"
            className="pressable grid size-11 place-items-center rounded-sm border border-line text-muted hover:bg-surface-subtle"
            onClick={onCancelEdit}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        ) : null}
      </div>
      <input
        aria-label="اسم الصنف"
        className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm"
        maxLength={120}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="اسم الصنف"
        value={name}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          aria-label="الكمية"
          className="numeric min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-left text-sm"
          dir="ltr"
          inputMode="decimal"
          onChange={(event) => onQuantityChange(event.target.value)}
          placeholder="الكمية"
          value={quantity}
        />
        <input
          aria-label="وحدة القياس"
          className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm"
          maxLength={40}
          onChange={(event) => onUnitLabelChange(event.target.value)}
          placeholder="الوحدة"
          value={unitLabel}
        />
      </div>
      <input
        aria-label={`تكلفة الوحدة بعملة ${currency}`}
        className="numeric min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-left text-sm"
        dir="ltr"
        inputMode="decimal"
        onChange={(event) => onUnitCostChange(event.target.value)}
        placeholder={`تكلفة الوحدة (اختياري)`}
        value={unitCost}
      />
      <input
        aria-label="الباركود"
        className="numeric min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-left text-sm"
        dir="ltr"
        onChange={(event) => onBarcodeChange(event.target.value)}
        placeholder="باركود (اختياري)"
        value={barcode}
      />
      <select
        aria-label="موقع التخزين"
        className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm"
        onChange={(event) => onLocationChange(event.target.value)}
        value={locationId}
      >
        <option value="">بدون موقع</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
      <button
        className="pressable flex min-h-11 w-full items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
        disabled={busy}
        onClick={onSubmit}
        type="button"
      >
        {busy ? "جارٍ الحفظ…" : editingId ? "حفظ التعديلات" : "حفظ الصنف"}
      </button>
      {!editingId && scale >= 0 ? null : null}
    </AppCard>
  );
}

function useInventoryFormState(currency: string) {
  const scale = getCurrencyScale(currency);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitLabel, setUnitLabel] = useState("قطعة");
  const [unitCost, setUnitCost] = useState("");
  const [barcode, setBarcode] = useState("");
  const [locationId, setLocationId] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setQuantity("");
    setUnitLabel("قطعة");
    setUnitCost("");
    setBarcode("");
    setLocationId("");
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setName(item.name);
    setQuantity(String(item.quantity));
    setUnitLabel(item.unitLabel);
    setBarcode(item.barcode ?? "");
    setLocationId(item.locationId ?? "");
    setUnitCost(
      item.unitCostMinor == null
        ? ""
        : formatMinorAmount(item.unitCostMinor, {
            currency: item.currencyCode || currency,
            locale: "en-US",
          }),
    );
  };

  const parseForm = () => {
    const trimmedName = name.trim();
    const trimmedUnit = unitLabel.trim();
    const parsedQuantity = Number(quantity);
    if (trimmedName.length < 2) {
      throw new Error("اكتب اسمًا واضحًا للصنف");
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      throw new Error("أدخل كمية صحيحة");
    }
    if (!trimmedUnit) {
      throw new Error("أدخل وحدة القياس");
    }

    let unitCostMinor: number | undefined;
    if (unitCost.trim()) {
      const parsed = parseMajorAmount(unitCost, scale);
      if (parsed < 0n) {
        throw new Error("تكلفة الوحدة لا يمكن أن تكون سالبة");
      }
      unitCostMinor = toSafeMinorNumber(parsed);
    }

    return {
      name: trimmedName,
      quantity: parsedQuantity,
      unitLabel: trimmedUnit,
      unitCostMinor,
      unitCostBigInt:
        unitCostMinor === undefined ? null : BigInt(unitCostMinor),
      barcode: barcode.trim() || null,
      locationId: locationId || null,
    };
  };

  return {
    editingId,
    name,
    quantity,
    barcode,
    locationId,
    resetForm,
    setName,
    setQuantity,
    setUnitCost,
    setUnitLabel,
    setBarcode,
    setLocationId,
    startEdit,
    parseForm,
    unitCost,
    unitLabel,
    scale,
  };
}

function LiveProjectInventoryTab({
  currency,
  project,
}: {
  currency: string;
  project: ProjectSummary;
}) {
  const itemsQuery = useInventoryItemsQuery(project.id);
  const locationsQuery = useInventoryLocationsQuery(project.id);
  const movementsQuery = useInventoryMovementsQuery(project.id);
  const upsertItem = useUpsertInventoryItemMutation(project.id);
  const archiveItem = useArchiveInventoryItemMutation(project.id);
  const createLocation = useCreateInventoryLocationMutation(project.id);
  const postMovement = usePostInventoryMovementMutation(project.id);
  const form = useInventoryFormState(currency);
  const [busy, setBusy] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [movementItemId, setMovementItemId] = useState("");
  const [movementType, setMovementType] = useState<"in" | "out" | "adjust">(
    "in",
  );
  const [movementQty, setMovementQty] = useState("1");
  const submitLock = useRef(false);
  const items = itemsQuery.data ?? EMPTY_INVENTORY_ITEMS;
  const locations = locationsQuery.data ?? [];
  const movements = movementsQuery.data ?? [];

  const submit = async () => {
    if (submitLock.current || busy || upsertItem.isPending) return;
    let parsed;
    try {
      parsed = form.parseForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بيانات غير صحيحة");
      return;
    }

    submitLock.current = true;
    setBusy(true);
    try {
      await upsertItem.mutateAsync({
        name: parsed.name,
        quantity: parsed.quantity,
        unitLabel: parsed.unitLabel,
        currencyCode: currency,
        barcode: parsed.barcode,
        locationId: parsed.locationId,
        ...(form.editingId ? { itemId: form.editingId } : {}),
        ...(parsed.unitCostMinor === undefined
          ? {}
          : { unitCostMinor: parsed.unitCostMinor }),
      });
      form.resetForm();
      toast.success(form.editingId ? "تم تحديث الصنف" : "تم حفظ الصنف");
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر حفظ صنف المخزون"));
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  };

  const archive = async (itemId: string) => {
    if (busy || archiveItem.isPending) return;
    setBusy(true);
    try {
      await archiveItem.mutateAsync(itemId);
      if (form.editingId === itemId) form.resetForm();
      toast.success("تمت أرشفة الصنف");
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر أرشفة الصنف"));
    } finally {
      setBusy(false);
    }
  };

  if (itemsQuery.isLoading) {
    return (
      <AppCard
        aria-label="جاري تحميل المخزون"
        className="h-64 animate-pulse bg-surface-subtle motion-reduce:animate-none"
        role="status"
      />
    );
  }

  if (itemsQuery.isError) {
    return (
      <ErrorState
        message={
          itemsQuery.error instanceof Error
            ? itemsQuery.error.message
            : "تعذر تحميل أصناف المخزون"
        }
        onRetry={() => void itemsQuery.refetch()}
        title="تعذر تحميل المخزون"
      />
    );
  }

  return (
    <section aria-labelledby="project-inventory-title" className="space-y-5">
      <div>
        <h2
          className="text-lg font-bold text-ink"
          id="project-inventory-title"
        >
          المخزون
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          تابع الكميات والمواقع والباركود وخط الحركات.
        </p>
      </div>

      <AppCard className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="text-xs font-semibold text-muted">الأصناف النشطة</p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-ink"
            dir="ltr"
          >
            {items.length}
          </bdi>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">القيمة التقديرية</p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-primary-ink"
            dir="ltr"
          >
            {formatMinorAmount(project.inventoryValueMinor, {
              currency,
              locale: "en-US",
            })}
          </bdi>
        </div>
      </AppCard>

      <AppCard className="space-y-3 p-4">
        <h3 className="text-sm font-bold text-ink">مواقع التخزين</h3>
        <div className="flex gap-2">
          <input
            aria-label="اسم الموقع"
            className="min-h-11 flex-1 rounded-md border border-control-border bg-surface px-3 text-sm"
            onChange={(event) => setLocationName(event.target.value)}
            placeholder="مثل: المخزن الرئيسي"
            value={locationName}
          />
          <button
            className="pressable min-h-11 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on disabled:opacity-60"
            disabled={createLocation.isPending}
            onClick={() => {
              if (!locationName.trim()) {
                toast.error("اكتب اسم الموقع");
                return;
              }
              void createLocation
                .mutateAsync(locationName.trim())
                .then(() => {
                  setLocationName("");
                  toast.success("تمت إضافة الموقع");
                })
                .catch((error) =>
                  toast.error(getUserErrorMessage(error, "تعذر إضافة الموقع")),
                );
            }}
            type="button"
          >
            إضافة
          </button>
        </div>
        <ul className="space-y-1 text-xs text-muted">
          {locations.map((location) => (
            <li key={location.id}>{location.name}</li>
          ))}
        </ul>
      </AppCard>

      <InventoryForm
        barcode={form.barcode}
        busy={busy || upsertItem.isPending}
        currency={currency}
        editingId={form.editingId}
        locationId={form.locationId}
        locations={locations}
        name={form.name}
        onBarcodeChange={form.setBarcode}
        onCancelEdit={form.resetForm}
        onLocationChange={form.setLocationId}
        onNameChange={form.setName}
        onQuantityChange={form.setQuantity}
        onSubmit={() => void submit()}
        onUnitCostChange={form.setUnitCost}
        onUnitLabelChange={form.setUnitLabel}
        quantity={form.quantity}
        scale={form.scale}
        unitCost={form.unitCost}
        unitLabel={form.unitLabel}
      />

      <AppCard className="space-y-3 p-4">
        <h3 className="text-sm font-bold text-ink">حركة مخزون</h3>
        <select
          aria-label="صنف الحركة"
          className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm"
          onChange={(event) => setMovementItemId(event.target.value)}
          value={movementItemId}
        >
          <option value="">اختر صنفًا</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            aria-label="نوع الحركة"
            className="min-h-11 rounded-md border border-control-border bg-surface px-3 text-sm"
            onChange={(event) =>
              setMovementType(event.target.value as "in" | "out" | "adjust")
            }
            value={movementType}
          >
            <option value="in">إدخال</option>
            <option value="out">إخراج</option>
            <option value="adjust">تسوية</option>
          </select>
          <input
            aria-label="كمية الحركة"
            className="numeric min-h-11 rounded-md border border-control-border bg-surface px-3 text-left text-sm"
            dir="ltr"
            inputMode="decimal"
            onChange={(event) => setMovementQty(event.target.value)}
            value={movementQty}
          />
        </div>
        <button
          className="pressable min-h-11 w-full rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
          disabled={postMovement.isPending}
          onClick={() => {
            const qty = Number(movementQty);
            if (!movementItemId || !Number.isFinite(qty) || qty === 0) {
              toast.error("اختر صنفًا وكمية صحيحة");
              return;
            }
            void postMovement
              .mutateAsync({
                itemId: movementItemId,
                movementType,
                quantity: qty,
                clientId: crypto.randomUUID(),
              })
              .then(() => toast.success("تم تسجيل الحركة"))
              .catch((error) =>
                toast.error(getUserErrorMessage(error, "تعذر تسجيل الحركة")),
              );
          }}
          type="button"
        >
          تسجيل الحركة
        </button>
        {movements.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted">
            {movements.slice(0, 8).map((movement) => (
              <li key={movement.id}>
                {movement.movementType} ·{" "}
                <bdi className="numeric" dir="ltr">
                  {movement.quantity}
                </bdi>{" "}
                · {movement.occurredOn}
              </li>
            ))}
          </ul>
        ) : null}
      </AppCard>

      <div>
        <h3 className="mb-3 text-sm font-bold text-ink">الأصناف</h3>
        <InventoryList
          busy={busy}
          currency={currency}
          editingId={form.editingId}
          items={items}
          onArchive={(itemId) => void archive(itemId)}
          onEdit={form.startEdit}
        />
      </div>
    </section>
  );
}

function DemoProjectInventoryTab({
  currency,
  project,
}: {
  currency: string;
  project: ProjectSummary;
}) {
  const items = useProjectStore(
    (state) => state.inventoryByProject[project.id] ?? EMPTY_INVENTORY_ITEMS,
  );
  const upsertDemoInventoryItem = useProjectStore(
    (state) => state.upsertInventoryItem,
  );
  const archiveDemoInventoryItem = useProjectStore(
    (state) => state.archiveInventoryItem,
  );
  const form = useInventoryFormState(currency);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (busy) return;
    let parsed;
    try {
      parsed = form.parseForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بيانات غير صحيحة");
      return;
    }
    setBusy(true);
    try {
      upsertDemoInventoryItem({
        projectId: project.id,
        currencyCode: currency,
        name: parsed.name,
        quantity: parsed.quantity,
        unitLabel: parsed.unitLabel,
        unitCostMinor: parsed.unitCostBigInt,
        barcode: parsed.barcode,
        locationId: parsed.locationId,
        ...(form.editingId ? { itemId: form.editingId } : {}),
      });
      form.resetForm();
      toast.success(form.editingId ? "تم تحديث الصنف" : "تم حفظ الصنف");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الصنف");
    } finally {
      setBusy(false);
    }
  };

  const archive = (itemId: string) => {
    archiveDemoInventoryItem({ projectId: project.id, itemId });
    if (form.editingId === itemId) form.resetForm();
    toast.success("تمت أرشفة الصنف");
  };

  return (
    <section aria-labelledby="project-inventory-title" className="space-y-5">
      <div>
        <h2
          className="text-lg font-bold text-ink"
          id="project-inventory-title"
        >
          المخزون
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          يمكنك تجربة إضافة الأصناف محليًا في الوضع التجريبي.
        </p>
      </div>

      <AppCard className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="text-xs font-semibold text-muted">الأصناف النشطة</p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-ink"
            dir="ltr"
          >
            {items.length}
          </bdi>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">القيمة التقديرية</p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-primary-ink"
            dir="ltr"
          >
            {formatMinorAmount(project.inventoryValueMinor, {
              currency,
              locale: "en-US",
            })}
          </bdi>
        </div>
      </AppCard>

      <InventoryForm
        barcode={form.barcode}
        busy={busy}
        currency={currency}
        editingId={form.editingId}
        locationId={form.locationId}
        locations={[]}
        name={form.name}
        onBarcodeChange={form.setBarcode}
        onCancelEdit={form.resetForm}
        onLocationChange={form.setLocationId}
        onNameChange={form.setName}
        onQuantityChange={form.setQuantity}
        onSubmit={submit}
        onUnitCostChange={form.setUnitCost}
        onUnitLabelChange={form.setUnitLabel}
        quantity={form.quantity}
        scale={form.scale}
        unitCost={form.unitCost}
        unitLabel={form.unitLabel}
      />

      <div>
        <h3 className="mb-3 text-sm font-bold text-ink">الأصناف</h3>
        <InventoryList
          busy={busy}
          currency={currency}
          editingId={form.editingId}
          items={items}
          onArchive={archive}
          onEdit={form.startEdit}
        />
      </div>
    </section>
  );
}

export function ProjectInventoryTab({
  currency,
  isDemo,
  project,
}: ProjectInventoryTabProps) {
  if (isDemo) {
    return <DemoProjectInventoryTab currency={currency} project={project} />;
  }
  return <LiveProjectInventoryTab currency={currency} project={project} />;
}
