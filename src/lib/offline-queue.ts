import Dexie, { type Table } from "dexie";

export interface OfflineTransactionJob {
  id?: number;
  workspaceId: string;
  clientId: string;
  walletId: string;
  kind: "income" | "expense";
  amountMinor: number;
  description: string;
  projectId?: string;
  categoryId?: string;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
}

class OfflineQueueDatabase extends Dexie {
  transactionJobs!: Table<OfflineTransactionJob, number>;

  constructor() {
    super("mizan-offline-queue");
    this.version(1).stores({
      transactionJobs: "++id, workspaceId, clientId, status, createdAt",
    });
  }
}

let db: OfflineQueueDatabase | null = null;

export function getOfflineQueueDb(): OfflineQueueDatabase {
  if (!db) db = new OfflineQueueDatabase();
  return db;
}

export async function enqueuePostTransaction(
  job: Omit<OfflineTransactionJob, "id" | "status" | "createdAt"> & {
    createdAt?: string;
  },
): Promise<number> {
  return getOfflineQueueDb().transactionJobs.add({
    ...job,
    status: "pending",
    createdAt: job.createdAt ?? new Date().toISOString(),
  });
}

export async function listPendingTransactionJobs(
  workspaceId: string,
): Promise<OfflineTransactionJob[]> {
  return getOfflineQueueDb()
    .transactionJobs.where({ workspaceId, status: "pending" })
    .sortBy("createdAt");
}

export async function countOfflineJobs(workspaceId: string): Promise<{
  pending: number;
  failed: number;
}> {
  const table = getOfflineQueueDb().transactionJobs;
  const pending = await table.where({ workspaceId, status: "pending" }).count();
  const failed = await table.where({ workspaceId, status: "failed" }).count();
  return { pending, failed };
}

export async function markJobStatus(
  id: number,
  status: OfflineTransactionJob["status"],
  lastError?: string,
): Promise<void> {
  await getOfflineQueueDb().transactionJobs.update(id, {
    status,
    ...(lastError ? { lastError } : { lastError: undefined }),
  });
}

export async function removeJob(id: number): Promise<void> {
  await getOfflineQueueDb().transactionJobs.delete(id);
}

export async function resetOfflineQueueForTests(): Promise<void> {
  await getOfflineQueueDb().transactionJobs.clear();
}

export async function flushPendingTransactionJobs(
  workspaceId: string,
  postTransaction: (job: OfflineTransactionJob) => Promise<unknown>,
): Promise<{ synced: number; failed: number }> {
  const pending = await listPendingTransactionJobs(workspaceId);
  let synced = 0;
  let failed = 0;

  for (const job of pending) {
    if (job.id == null) continue;
    await markJobStatus(job.id, "syncing");
    try {
      await postTransaction(job);
      await removeJob(job.id);
      synced += 1;
    } catch (error) {
      failed += 1;
      await markJobStatus(
        job.id,
        "failed",
        error instanceof Error ? error.message : "sync_failed",
      );
    }
  }

  return { synced, failed };
}
