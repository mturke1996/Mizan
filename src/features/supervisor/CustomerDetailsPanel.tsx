import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Eye, KeyRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  customerAdminKeys,
  fetchCustomerDetail,
  sendCustomerPasswordSetup,
} from "./customer-admin-api";
import type { AccountStatus, SupervisorCustomerRow } from "./customer-admin-types";
import { SupervisorActionDialog } from "./SupervisorActionDialog";
import { CustomerControlLedger } from "./CustomerControlLedger";
import { CustomerFinancialReadPanel } from "./CustomerFinancialReadPanel";
import { CustomerMessagesPanel } from "./CustomerMessagesPanel";
import {
  createPaymentProofUrl,
  fetchPayments,
  invalidateSupervisor,
  supervisorKeys,
  supervisorSetAccountStatus,
} from "./supervisor-api";
import { ErrorBlock, LoadingBlock, StatusBadge } from "./SupervisorUi";
import {
  accountStatusLabel,
  formatDateAr,
  formatMinorCurrency,
  statusTone,
  subscriptionStatusLabel,
} from "./supervisor-utils";

const TABS = [
  { id: "summary", label: "الملخص" },
  { id: "account", label: "الحساب والمساحة" },
  { id: "subscription", label: "الاشتراك" },
  { id: "payments", label: "المدفوعات" },
  { id: "messages", label: "الرسائل" },
  { id: "finance", label: "البيانات المالية — قراءة فقط" },
  { id: "ledger", label: "سجل القرارات" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type AccountAction = {
  status: AccountStatus;
  title: string;
  description: string;
  confirmLabel: string;
  tone: "primary" | "warning" | "danger";
  noteRequired: boolean;
};

export interface CustomerDetailsPanelProps {
  userId: string | null;
  onClose(): void;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-xs font-semibold text-muted">{label}</dt>
      <dd className="text-end text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}

function CustomerPanelBody({
  customer,
  onClose,
}: {
  customer: SupervisorCustomerRow;
  onClose(): void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("summary");
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null);
  const [passwordSetupOpen, setPasswordSetupOpen] = useState(false);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  const paymentsQuery = useQuery({
    queryKey: supervisorKeys.paymentsList({
      query: customer.email,
      limit: 20,
      offset: 0,
    }),
    queryFn: () =>
      fetchPayments({
        query: customer.email,
        limit: 20,
        offset: 0,
      }),
    enabled: tab === "payments",
  });

  const statusMutation = useMutation({
    mutationFn: (input: { status: AccountStatus; note: string }) =>
      supervisorSetAccountStatus(customer.userId, input.status, input.note),
    onSuccess: async () => {
      toast.success("تم تحديث حالة الحساب");
      setAccountAction(null);
      await invalidateSupervisor(queryClient);
      await queryClient.invalidateQueries({
        queryKey: customerAdminKeys.detail(customer.userId),
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const passwordMutation = useMutation({
    mutationFn: (note: string) =>
      sendCustomerPasswordSetup(customer.email, note),
    onSuccess: async () => {
      toast.success("تم إرسال رابط تعيين كلمة المرور");
      setPasswordSetupOpen(false);
      await invalidateSupervisor(queryClient);
    },
    onError: () => {
      toast.error("تعذر إرسال الرابط. تحقق من البيانات وحاول مرة أخرى.");
    },
  });

  const proofMutation = useMutation({
    mutationFn: (input: { id: string; path: string }) =>
      createPaymentProofUrl(input.path).then((url) => ({ id: input.id, url })),
    onSuccess: ({ id, url }) => {
      setProofUrls((current) => ({ ...current, [id]: url }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openAccountAction(status: AccountStatus) {
    if (status === "active") {
      setAccountAction({
        status,
        title: "تفعيل الحساب",
        description: `إعادة تفعيل حساب ${customer.displayName || customer.email}.`,
        confirmLabel: "تفعيل",
        tone: "primary",
        noteRequired: false,
      });
      return;
    }
    if (status === "suspended") {
      setAccountAction({
        status,
        title: "إيقاف الحساب",
        description: "إيقاف الحساب يمنع الوصول مؤقتًا حتى إعادة التفعيل.",
        confirmLabel: "إيقاف",
        tone: "warning",
        noteRequired: true,
      });
      return;
    }
    setAccountAction({
      status,
      title: "تعطيل الحساب",
      description: "تعطيل الحساب يمنع صاحبه من استخدام التطبيق.",
      confirmLabel: "تعطيل",
      tone: "danger",
      noteRequired: true,
    });
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-ink">
              {customer.displayName || "بدون اسم"}
            </h2>
            <p className="mt-1 truncate text-sm text-muted">{customer.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge
                label={accountStatusLabel[customer.accountStatus] ?? "—"}
                tone={statusTone(customer.accountStatus)}
              />
              <StatusBadge
                label={
                  subscriptionStatusLabel[customer.effectiveSubscriptionStatus] ??
                  "—"
                }
                tone={statusTone(customer.effectiveSubscriptionStatus)}
              />
            </div>
          </div>
          <button
            aria-label="إغلاق"
            className="pressable grid size-11 shrink-0 place-items-center rounded-sm border border-line bg-surface text-muted hover:bg-surface-subtle hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <Tabs.Root
          className="flex min-h-0 flex-1 flex-col"
          onValueChange={(value) => setTab(value as TabId)}
          value={tab}
        >
          <Tabs.List
            aria-label="تبويبات تفاصيل العميل"
            className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 [scrollbar-width:none]"
          >
            {TABS.map((item) => (
              <Tabs.Trigger
                className="pressable shrink-0 rounded-sm px-3 py-2 text-xs font-bold text-muted data-[state=active]:bg-primary-soft data-[state=active]:text-primary"
                key={item.id}
                value={item.id}
              >
                {item.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <Tabs.Content value="summary">
              <dl>
                <DetailRow label="المساحة" value={customer.workspaceName || "—"} />
                <DetailRow label="الخطة" value={customer.planName || "—"} />
                <DetailRow
                  label="الاشتراك"
                  value={
                    subscriptionStatusLabel[
                      customer.effectiveSubscriptionStatus
                    ] ?? "—"
                  }
                />
                <DetailRow
                  label="نهاية الفترة"
                  value={formatDateAr(customer.currentPeriodEndsAt)}
                />
                <DetailRow
                  label="مدفوعات معلّقة"
                  value={String(customer.pendingPayments)}
                />
                <DetailRow
                  label="آخر دخول"
                  value={formatDateAr(customer.lastSignInAt)}
                />
                <DetailRow
                  label="تاريخ الإنشاء"
                  value={formatDateAr(customer.createdAt)}
                />
              </dl>
            </Tabs.Content>

            <Tabs.Content value="account">
              <dl>
                <DetailRow
                  label="حالة الحساب"
                  value={accountStatusLabel[customer.accountStatus] ?? "—"}
                />
                <DetailRow
                  label="حالة المساحة"
                  value={
                    customer.workspaceStatus === "active"
                      ? "نشطة"
                      : customer.workspaceStatus === "suspended"
                        ? "موقوفة"
                        : "مؤرشفة"
                  }
                />
                <DetailRow label="العملة" value={customer.currencyCode || "—"} />
                <DetailRow
                  label="معرّف المساحة"
                  value={customer.workspaceId.slice(0, 8) + "…"}
                />
              </dl>

              <div className="mt-5 space-y-2">
                <p className="text-xs font-bold text-ink">إجراءات الحساب</p>
                <div className="flex flex-wrap gap-2">
                  {customer.accountStatus !== "active" ? (
                    <button
                      className="pressable min-h-11 rounded-sm bg-success-soft px-3 text-xs font-bold text-success"
                      onClick={() => openAccountAction("active")}
                      type="button"
                    >
                      تفعيل
                    </button>
                  ) : (
                    <>
                      <button
                        className="pressable min-h-11 rounded-sm bg-warning-soft px-3 text-xs font-bold text-warning"
                        onClick={() => openAccountAction("suspended")}
                        type="button"
                      >
                        إيقاف
                      </button>
                      <button
                        className="pressable min-h-11 rounded-sm bg-danger-soft px-3 text-xs font-bold text-danger"
                        onClick={() => openAccountAction("disabled")}
                        type="button"
                      >
                        تعطيل
                      </button>
                    </>
                  )}
                  <button
                    className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-xs font-bold text-primary"
                    onClick={() => setPasswordSetupOpen(true)}
                    type="button"
                  >
                    <KeyRound aria-hidden="true" size={15} />
                    إرسال رابط تعيين كلمة المرور
                  </button>
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="subscription">
              <dl>
                <DetailRow label="الخطة" value={customer.planName || "—"} />
                <DetailRow
                  label="الحالة"
                  value={
                    subscriptionStatusLabel[customer.subscriptionStatus] ?? "—"
                  }
                />
                <DetailRow
                  label="الحالة الفعلية"
                  value={
                    subscriptionStatusLabel[
                      customer.effectiveSubscriptionStatus
                    ] ?? "—"
                  }
                />
                <DetailRow
                  label="نهاية التجربة"
                  value={formatDateAr(customer.trialEndsAt)}
                />
                <DetailRow
                  label="نهاية الفترة"
                  value={formatDateAr(customer.currentPeriodEndsAt)}
                />
                <DetailRow
                  label="مجدول"
                  value={
                    customer.scheduledStatus
                      ? `${subscriptionStatusLabel[customer.scheduledStatus] ?? customer.scheduledStatus} · ${formatDateAr(customer.scheduledStatusAt)}`
                      : "—"
                  }
                />
              </dl>
            </Tabs.Content>

            <Tabs.Content value="payments">
              {paymentsQuery.isLoading ? (
                <LoadingBlock rows={3} />
              ) : paymentsQuery.isError ? (
                <ErrorBlock
                  message={
                    paymentsQuery.error instanceof Error
                      ? paymentsQuery.error.message
                      : "حاول مرة أخرى"
                  }
                  onRetry={() => void paymentsQuery.refetch()}
                />
              ) : (paymentsQuery.data?.rows.length ?? 0) === 0 ? (
                <p className="text-sm text-muted">لا مدفوعات مرتبطة بهذا العميل.</p>
              ) : (
                <ul className="space-y-3">
                  {(paymentsQuery.data?.rows ?? []).map((payment) => (
                    <li
                      className="rounded-md border border-line bg-surface-subtle/40 p-3"
                      key={payment.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="numeric text-sm font-bold text-ink">
                            {formatMinorCurrency(
                              payment.amountMinor,
                              payment.currencyCode,
                            )}{" "}
                            {payment.currencyCode}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {payment.planName} · {payment.periodCount} فترة
                          </p>
                        </div>
                        <StatusBadge
                          label={
                            payment.status === "pending"
                              ? "بانتظار المراجعة"
                              : payment.status === "approved"
                                ? "موافق"
                                : "مرفوض"
                          }
                          tone={statusTone(
                            payment.status === "approved"
                              ? "active"
                              : payment.status === "rejected"
                                ? "expired"
                                : "grace",
                          )}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-soft">
                        {formatDateAr(payment.createdAt)}
                      </p>
                      {payment.proofObjectPath ? (
                        proofUrls[payment.id] ? (
                          <a
                            className="pressable mt-2 inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-xs font-bold text-primary"
                            href={proofUrls[payment.id]}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <ExternalLink aria-hidden="true" size={14} />
                            فتح الإثبات
                          </a>
                        ) : (
                          <button
                            className="pressable mt-2 inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-xs font-bold text-primary disabled:opacity-50"
                            disabled={proofMutation.isPending}
                            onClick={() =>
                              proofMutation.mutate({
                                id: payment.id,
                                path: payment.proofObjectPath!,
                              })
                            }
                            type="button"
                          >
                            <Eye aria-hidden="true" size={14} />
                            عرض الإثبات
                          </button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Tabs.Content>

            <Tabs.Content value="messages">
              {tab === "messages" ? (
                <CustomerMessagesPanel
                  userId={customer.userId}
                  workspaceId={customer.workspaceId}
                />
              ) : null}
            </Tabs.Content>

            <Tabs.Content value="finance">
              {tab === "finance" ? (
                <CustomerFinancialReadPanel
                  defaultCurrencyCode={customer.currencyCode || "LYD"}
                  workspaceId={customer.workspaceId}
                />
              ) : null}
            </Tabs.Content>

            <Tabs.Content value="ledger">
              {tab === "ledger" ? (
                <CustomerControlLedger workspaceId={customer.workspaceId} />
              ) : null}
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>

      {accountAction ? (
        <SupervisorActionDialog
          confirmLabel={accountAction.confirmLabel}
          description={accountAction.description}
          isPending={statusMutation.isPending}
          noteRequired={accountAction.noteRequired}
          onConfirm={(note) =>
            statusMutation.mutate({ status: accountAction.status, note })
          }
          onOpenChange={(open) => {
            if (!open) setAccountAction(null);
          }}
          open
          title={accountAction.title}
          tone={accountAction.tone}
        />
      ) : null}

      <SupervisorActionDialog
        confirmLabel="إرسال الرابط"
        description="سيُرسل رابط تعيين كلمة مرور إلى بريد العميل. لا نؤكد وجود الحساب في رسالة الخطأ العامة."
        isPending={passwordMutation.isPending}
        noteRequired
        onConfirm={(note) => passwordMutation.mutate(note)}
        onOpenChange={setPasswordSetupOpen}
        open={passwordSetupOpen}
        title="إرسال رابط تعيين كلمة المرور"
        tone="primary"
      />
    </>
  );
}

export function CustomerDetailsPanel({
  userId,
  onClose,
}: CustomerDetailsPanelProps) {
  const detailQuery = useQuery({
    queryKey: customerAdminKeys.detail(userId ?? ""),
    queryFn: () => fetchCustomerDetail(userId!),
    enabled: Boolean(userId),
  });

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : true,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  if (!userId) return null;

  const body = detailQuery.isLoading ? (
    <div className="p-5">
      <LoadingBlock rows={4} />
    </div>
  ) : detailQuery.isError || !detailQuery.data ? (
    <div className="p-5">
      <ErrorBlock
        message={
          detailQuery.error instanceof Error
            ? detailQuery.error.message
            : "تعذر تحميل التفاصيل"
        }
        onRetry={() => void detailQuery.refetch()}
      />
    </div>
  ) : (
    <CustomerPanelBody customer={detailQuery.data} onClose={onClose} />
  );

  if (isDesktop) {
    return (
      <aside
        aria-label="تفاصيل العميل"
        className="sticky top-[88px] flex h-[calc(100dvh-7rem)] w-full max-w-[480px] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-surface"
      >
        {body}
      </aside>
    );
  }

  return (
    <Dialog.Root onOpenChange={(open) => !open && onClose()} open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-label="تفاصيل العميل"
          className="fixed inset-0 z-50 flex flex-col bg-surface"
        >
          <Dialog.Title className="sr-only">تفاصيل العميل</Dialog.Title>
          <Dialog.Description className="sr-only">
            لوحة تفاصيل العميل والحساب والاشتراك والمدفوعات
          </Dialog.Description>
          {body}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
