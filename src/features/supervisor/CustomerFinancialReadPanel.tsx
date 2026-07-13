import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchCustomerFinancialSnapshot,
  fetchCustomerProjects,
  fetchCustomerTransactions,
  fetchCustomerWallets,
  fetchCustomerWorkers,
  financialReadKeys,
} from "./supervisor-financial-read-api";
import { ErrorBlock, LoadingBlock, StatusBadge } from "./SupervisorUi";
import { formatDateAr, formatMinorCurrency } from "./supervisor-utils";

const PAGE_SIZE = 10;

export interface CustomerFinancialReadPanelProps {
  workspaceId: string;
  defaultCurrencyCode?: string;
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <button
        className="pressable min-h-10 rounded-sm border border-line px-3 text-xs font-bold disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        type="button"
      >
        السابق
      </button>
      <span className="text-[11px] text-muted">
        {page} / {totalPages}
      </span>
      <button
        className="pressable min-h-10 rounded-sm border border-line px-3 text-xs font-bold disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        type="button"
      >
        التالي
      </button>
    </div>
  );
}

export function CustomerFinancialReadPanel({
  workspaceId,
  defaultCurrencyCode = "LYD",
}: CustomerFinancialReadPanelProps) {
  const [walletsPage, setWalletsPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [projectsPage, setProjectsPage] = useState(1);
  const [workersPage, setWorkersPage] = useState(1);

  const snapshotQuery = useQuery({
    queryKey: financialReadKeys.customerFinance(workspaceId, "snapshot", 1),
    queryFn: () => fetchCustomerFinancialSnapshot(workspaceId),
  });
  const walletsQuery = useQuery({
    queryKey: financialReadKeys.customerFinance(
      workspaceId,
      "wallets",
      walletsPage,
    ),
    queryFn: () =>
      fetchCustomerWallets(
        workspaceId,
        PAGE_SIZE,
        (walletsPage - 1) * PAGE_SIZE,
      ),
  });
  const transactionsQuery = useQuery({
    queryKey: financialReadKeys.customerFinance(
      workspaceId,
      "transactions",
      txPage,
    ),
    queryFn: () =>
      fetchCustomerTransactions(
        workspaceId,
        PAGE_SIZE,
        (txPage - 1) * PAGE_SIZE,
      ),
  });
  const projectsQuery = useQuery({
    queryKey: financialReadKeys.customerFinance(
      workspaceId,
      "projects",
      projectsPage,
    ),
    queryFn: () =>
      fetchCustomerProjects(
        workspaceId,
        PAGE_SIZE,
        (projectsPage - 1) * PAGE_SIZE,
      ),
  });
  const workersQuery = useQuery({
    queryKey: financialReadKeys.customerFinance(
      workspaceId,
      "workers",
      workersPage,
    ),
    queryFn: () =>
      fetchCustomerWorkers(
        workspaceId,
        PAGE_SIZE,
        (workersPage - 1) * PAGE_SIZE,
      ),
  });

  if (snapshotQuery.isLoading) return <LoadingBlock rows={4} />;
  if (snapshotQuery.isError) {
    return (
      <ErrorBlock
        message={
          snapshotQuery.error instanceof Error
            ? snapshotQuery.error.message
            : "تعذر التحميل"
        }
        onRetry={() => void snapshotQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <StatusBadge
        label="قراءة فقط · كل فتح مسجل"
        tone="bg-warning-soft text-warning"
      />

      <section>
        <h3 className="text-sm font-bold text-ink">ملخص العملات</h3>
        <p className="mt-1 text-[11px] text-muted">
          المبالغ مفصولة حسب العملة دون جمع LYD مع USD.
        </p>
        {(snapshotQuery.data?.currencies.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted">لا أرصدة مسجّلة.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(snapshotQuery.data?.currencies ?? []).map((row) => (
              <li
                className="rounded-md border border-line bg-surface-subtle/40 p-3"
                key={row.currencyCode}
              >
                <p className="text-xs font-bold text-ink">{row.currencyCode}</p>
                <dl className="mt-2 space-y-1 text-[11px] text-muted">
                  <div className="flex justify-between gap-2">
                    <dt>المحافظ</dt>
                    <dd className="numeric font-semibold text-ink">
                      {formatMinorCurrency(
                        row.walletBalanceMinor,
                        row.currencyCode,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>صافي المشاريع</dt>
                    <dd className="numeric font-semibold text-ink">
                      {formatMinorCurrency(
                        row.projectNetMinor,
                        row.currencyCode,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>أرصدة العمال</dt>
                    <dd className="numeric font-semibold text-ink">
                      {formatMinorCurrency(
                        row.workerBalanceMinor,
                        row.currencyCode,
                      )}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-bold text-ink">المحافظ</h3>
        {walletsQuery.isLoading ? (
          <LoadingBlock rows={2} />
        ) : (walletsQuery.data?.rows.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted">لا محافظ.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2">
              {(walletsQuery.data?.rows ?? []).map((wallet) => (
                <li
                  className="rounded-md border border-line px-3 py-2"
                  key={wallet.id}
                >
                  <p className="text-sm font-bold text-ink">{wallet.name}</p>
                  <p className="numeric mt-1 text-xs text-muted">
                    {formatMinorCurrency(wallet.balanceMinor, wallet.currencyCode)}{" "}
                    {wallet.currencyCode}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination
              onChange={setWalletsPage}
              page={walletsPage}
              total={walletsQuery.data?.total ?? 0}
            />
          </>
        )}
      </section>

      <section>
        <h3 className="text-sm font-bold text-ink">المعاملات</h3>
        {transactionsQuery.isLoading ? (
          <LoadingBlock rows={2} />
        ) : (transactionsQuery.data?.rows.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted">لا معاملات.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2">
              {(transactionsQuery.data?.rows ?? []).map((tx) => (
                <li
                  className="rounded-md border border-line px-3 py-2"
                  key={tx.id}
                >
                  <p className="text-sm font-bold text-ink">
                    {tx.description || tx.eventType}
                  </p>
                  <p className="numeric mt-1 text-xs text-muted">
                    {formatMinorCurrency(tx.amountMinor, tx.currencyCode)}{" "}
                    {tx.currencyCode} · {formatDateAr(tx.occurredAt)}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination
              onChange={setTxPage}
              page={txPage}
              total={transactionsQuery.data?.total ?? 0}
            />
          </>
        )}
      </section>

      <section>
        <h3 className="text-sm font-bold text-ink">المشاريع</h3>
        {projectsQuery.isLoading ? (
          <LoadingBlock rows={2} />
        ) : (projectsQuery.data?.rows.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted">لا مشاريع.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2">
              {(projectsQuery.data?.rows ?? []).map((project) => (
                <li
                  className="rounded-md border border-line px-3 py-2"
                  key={project.id}
                >
                  <p className="text-sm font-bold text-ink">{project.name}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {project.totals
                      .map(
                        (total) =>
                          `${formatMinorCurrency(total.netMinor, total.currencyCode)} ${total.currencyCode}`,
                      )
                      .join(" · ") || "بدون أرصدة"}
                  </p>
                </li>
              ))}
            </ul>
            <Pagination
              onChange={setProjectsPage}
              page={projectsPage}
              total={projectsQuery.data?.total ?? 0}
            />
          </>
        )}
      </section>

      <section>
        <h3 className="text-sm font-bold text-ink">العمال</h3>
        {workersQuery.isLoading ? (
          <LoadingBlock rows={2} />
        ) : (workersQuery.data?.rows.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted">لا عمال.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2">
              {(workersQuery.data?.rows ?? []).map((worker) => (
                <li
                  className="rounded-md border border-line px-3 py-2"
                  key={`${worker.workerId}-${worker.projectId}`}
                >
                  <p className="text-sm font-bold text-ink">{worker.name}</p>
                  <p className="numeric mt-1 text-xs text-muted">
                    {formatMinorCurrency(
                      worker.balanceMinor,
                      defaultCurrencyCode,
                    )}{" "}
                    {defaultCurrencyCode} · {worker.workDays} يوم عمل
                  </p>
                </li>
              ))}
            </ul>
            <Pagination
              onChange={setWorkersPage}
              page={workersPage}
              total={workersQuery.data?.total ?? 0}
            />
          </>
        )}
      </section>
    </div>
  );
}
