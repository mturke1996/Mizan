import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countOfflineJobs,
  enqueuePostTransaction,
  flushPendingTransactionJobs,
  listPendingTransactionJobs,
  markJobStatus,
  resetOfflineQueueForTests,
} from "./offline-queue";

describe("offline-queue", () => {
  beforeEach(async () => {
    await resetOfflineQueueForTests();
  });

  it("queues post_transaction jobs for later sync", async () => {
    await enqueuePostTransaction({
      workspaceId: "ws-1",
      clientId: "client-1",
      walletId: "wallet-1",
      kind: "expense",
      amountMinor: 2500,
      description: "علف",
    });

    const pending = await listPendingTransactionJobs("ws-1");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.clientId).toBe("client-1");
    expect(await countOfflineJobs("ws-1")).toEqual({
      pending: 1,
      failed: 0,
    });
  });

  it("tracks failed sync status", async () => {
    const id = await enqueuePostTransaction({
      workspaceId: "ws-1",
      clientId: "client-2",
      walletId: "wallet-1",
      kind: "income",
      amountMinor: 1000,
      description: "بيع",
    });
    await markJobStatus(id, "failed", "network");
    expect(await countOfflineJobs("ws-1")).toEqual({
      pending: 0,
      failed: 1,
    });
  });

  it("flushes pending jobs through post_transaction", async () => {
    await enqueuePostTransaction({
      workspaceId: "ws-1",
      clientId: "client-3",
      walletId: "wallet-1",
      kind: "expense",
      amountMinor: 500,
      description: "أوفلاين",
    });
    const post = vi.fn().mockResolvedValue("event-1");
    const result = await flushPendingTransactionJobs("ws-1", post);
    expect(result).toEqual({ synced: 1, failed: 0 });
    expect(post).toHaveBeenCalledOnce();
    expect(await countOfflineJobs("ws-1")).toEqual({
      pending: 0,
      failed: 0,
    });
  });
});
