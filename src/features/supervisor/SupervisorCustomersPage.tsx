import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { fetchAdminPlans, billingAdminKeys } from "./billing-admin-api";
import { CreateCustomerDialog } from "./CreateCustomerDialog";
import { CustomerDetailsPanel } from "./CustomerDetailsPanel";
import {
  createCustomer,
  customerAdminKeys,
  fetchCustomers,
} from "./customer-admin-api";
import type { CreateCustomerInput } from "./customer-admin-types";
import { SupervisorDataTable } from "./SupervisorDataTable";
import { ErrorBlock, SearchField, StatusBadge } from "./SupervisorUi";
import { invalidateSupervisor } from "./supervisor-api";
import {
  accountStatusLabel,
  formatDateAr,
  statusTone,
  subscriptionStatusLabel,
} from "./supervisor-utils";

const PAGE_SIZE = 20;

const ACCOUNT_FILTERS = [
  { id: "", label: "كل الحسابات" },
  { id: "active", label: "نشط" },
  { id: "suspended", label: "موقوف" },
  { id: "disabled", label: "معطّل" },
] as const;

const SUBSCRIPTION_FILTERS = [
  { id: "", label: "كل الاشتراكات" },
  { id: "trialing", label: "تجريبي" },
  { id: "active", label: "نشط" },
  { id: "grace", label: "مهلة" },
  { id: "frozen", label: "مجمّد" },
  { id: "expired", label: "منتهٍ" },
  { id: "cancelled", label: "ملغى" },
] as const;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function SupervisorCustomersPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const queryInput = searchParams.get("q") ?? "";
  const accountStatus = searchParams.get("account") ?? "";
  const subscriptionStatus = searchParams.get("subscription") ?? "";
  const planId = searchParams.get("plan") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const selectedCustomerId = searchParams.get("customer");
  const workspaceDeepLink = searchParams.get("workspace");

  const [localQuery, setLocalQuery] = useState(
    () => searchParams.get("q") ?? "",
  );
  const debouncedQuery = useDebouncedValue(localQuery, 300);

  useEffect(() => {
    if (debouncedQuery === queryInput) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedQuery.trim()) next.set("q", debouncedQuery.trim());
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: true });
  }, [debouncedQuery, queryInput, searchParams, setSearchParams]);

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(name);
    else next.set(name, value);
    next.delete("page");
    setSearchParams(next, { replace: true });
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setSearchParams(next, { replace: true });
  }

  function selectCustomer(userId: string | null) {
    const next = new URLSearchParams(searchParams);
    if (userId) next.set("customer", userId);
    else next.delete("customer");
    setSearchParams(next, { replace: true });
  }

  const listFilters = useMemo(
    () => ({
      query: debouncedQuery.trim() || undefined,
      accountStatus: accountStatus || undefined,
      subscriptionStatus: subscriptionStatus || undefined,
      planId: planId || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [debouncedQuery, accountStatus, subscriptionStatus, planId, page],
  );

  const customersQuery = useQuery({
    queryKey: customerAdminKeys.list(listFilters),
    queryFn: () => fetchCustomers(listFilters),
  });

  const plansQuery = useQuery({
    queryKey: billingAdminKeys.plansActive,
    queryFn: () => fetchAdminPlans(false),
  });

  useEffect(() => {
    if (!workspaceDeepLink || selectedCustomerId) return;
    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchCustomers({
          limit: 100,
          offset: 0,
        });
        if (cancelled) return;
        const match = result.rows.find(
          (row) => row.workspaceId === workspaceDeepLink,
        );
        if (!match) return;
        const next = new URLSearchParams(searchParams);
        next.set("customer", match.userId);
        next.delete("workspace");
        setSearchParams(next, { replace: true });
      } catch {
        // Keep deep-link param; user can still browse the list.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceDeepLink, selectedCustomerId, searchParams, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: (input: CreateCustomerInput) => createCustomer(input),
    onSuccess: async (result) => {
      toast.success("تم إنشاء العميل");
      await invalidateSupervisor(queryClient);
      selectCustomer(result.userId);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = customersQuery.data?.rows ?? [];
  const total = customersQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activePlans = (plansQuery.data ?? []).filter((plan) => plan.isActive);

  return (
    <div className="page-enter space-y-5 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">العملاء</h1>
          <p className="mt-1 text-sm text-muted">
            افتح العميل لتمديد الاشتراك أو تجميده أو إلغائه ومراجعة المدفوعات —
            حتى بدون طلب دفع منه.
          </p>
        </div>
        <button
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          إضافة عميل
        </button>
      </div>

      <div className="space-y-3">
        <SearchField
          onChange={setLocalQuery}
          placeholder="بحث بالاسم أو البريد أو المساحة..."
          value={localQuery}
        />

        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="customer-account-filter">
            حالة الحساب
          </label>
          <select
            className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink"
            id="customer-account-filter"
            onChange={(event) => setFilter("account", event.target.value)}
            value={accountStatus}
          >
            {ACCOUNT_FILTERS.map((item) => (
              <option key={item.id || "all-account"} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="customer-subscription-filter">
            حالة الاشتراك
          </label>
          <select
            className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink"
            id="customer-subscription-filter"
            onChange={(event) => setFilter("subscription", event.target.value)}
            value={subscriptionStatus}
          >
            {SUBSCRIPTION_FILTERS.map((item) => (
              <option key={item.id || "all-sub"} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="customer-plan-filter">
            الخطة
          </label>
          <select
            className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink"
            id="customer-plan-filter"
            onChange={(event) => setFilter("plan", event.target.value)}
            value={planId}
          >
            <option value="">كل الخطط</option>
            {activePlans.map((plan) => (
              <option key={plan.planId} value={plan.planId}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {customersQuery.isError ? (
        <ErrorBlock
          message={
            customersQuery.error instanceof Error
              ? customersQuery.error.message
              : "حاول مرة أخرى"
          }
          onRetry={() => void customersQuery.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <SupervisorDataTable
              columns={[
                {
                  id: "customer",
                  header: "العميل",
                  cell: (row) => (
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">
                        {row.displayName || "بدون اسم"}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {row.email}
                      </p>
                    </div>
                  ),
                  className: "w-[18%]",
                },
                {
                  id: "account",
                  header: "الحساب",
                  cell: (row) => (
                    <StatusBadge
                      label={accountStatusLabel[row.accountStatus] ?? "—"}
                      tone={statusTone(row.accountStatus)}
                    />
                  ),
                  className: "w-[10%]",
                },
                {
                  id: "workspace",
                  header: "المساحة",
                  cell: (row) => (
                    <span className="truncate">{row.workspaceName || "—"}</span>
                  ),
                  className: "w-[14%]",
                },
                {
                  id: "plan",
                  header: "الخطة",
                  cell: (row) => (
                    <span className="truncate">{row.planName || "—"}</span>
                  ),
                  className: "w-[12%]",
                },
                {
                  id: "subscription",
                  header: "الاشتراك",
                  cell: (row) => (
                    <StatusBadge
                      label={
                        subscriptionStatusLabel[
                          row.effectiveSubscriptionStatus
                        ] ?? "—"
                      }
                      tone={statusTone(row.effectiveSubscriptionStatus)}
                    />
                  ),
                  className: "w-[10%]",
                },
                {
                  id: "period",
                  header: "نهاية الفترة",
                  cell: (row) => (
                    <span className="text-xs">
                      {formatDateAr(row.currentPeriodEndsAt)}
                    </span>
                  ),
                  className: "w-[14%]",
                },
                {
                  id: "payments",
                  header: "الدفع",
                  cell: (row) => (
                    <span className="numeric text-xs font-bold">
                      {row.pendingPayments > 0
                        ? `${row.pendingPayments} معلّق`
                        : "—"}
                    </span>
                  ),
                  className: "w-[10%]",
                },
                {
                  id: "lastSignIn",
                  header: "آخر دخول",
                  cell: (row) => (
                    <span className="text-xs">
                      {formatDateAr(row.lastSignInAt)}
                    </span>
                  ),
                  className: "w-[12%]",
                },
              ]}
              emptyTitle="لا عملاء"
              isLoading={customersQuery.isLoading}
              onPageChange={setPage}
              onRowSelect={(row) => selectCustomer(row.userId)}
              page={page}
              pageCount={pageCount}
              renderMobileRow={(row) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">
                        {row.displayName || "بدون اسم"}
                      </p>
                      <p className="truncate text-xs text-muted">{row.email}</p>
                    </div>
                    <StatusBadge
                      label={accountStatusLabel[row.accountStatus] ?? "—"}
                      tone={statusTone(row.accountStatus)}
                    />
                  </div>
                  <p className="text-xs text-muted">
                    {row.workspaceName} · {row.planName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={
                        subscriptionStatusLabel[
                          row.effectiveSubscriptionStatus
                        ] ?? "—"
                      }
                      tone={statusTone(row.effectiveSubscriptionStatus)}
                    />
                    <span className="text-[11px] text-soft">
                      نهاية {formatDateAr(row.currentPeriodEndsAt)}
                    </span>
                  </div>
                </div>
              )}
              rowKey={(row) => row.userId}
              rows={rows}
              selectedId={selectedCustomerId ?? undefined}
            />
          </div>

          {selectedCustomerId ? (
            <CustomerDetailsPanel
              onClose={() => selectCustomer(null)}
              userId={selectedCustomerId}
            />
          ) : null}
        </div>
      )}

      <CreateCustomerDialog
        isPending={createMutation.isPending}
        onCreate={async (input) => createMutation.mutateAsync(input)}
        onOpenChange={setCreateOpen}
        open={createOpen}
        plans={activePlans}
      />
    </div>
  );
}
