import type { DebtSummary } from "@/features/workspace/workspace-types";
import { computeDebtAnalytics } from "./compute-debt-analytics";

function debt(
  id: string,
  direction: DebtSummary["direction"],
  balanceMinor: bigint,
  dueOn: string | null,
): DebtSummary {
  return {
    id,
    workspaceId: "workspace-1",
    partyId: `party-${id}`,
    partyName: `طرف ${id}`,
    partyPhone: null,
    direction,
    principalMinor: balanceMinor,
    balanceMinor,
    paidMinor: 0n,
    adjustedMinor: 0n,
    writtenOffMinor: 0n,
    currencyCode: "LYD",
    status: "open",
    dueOn,
    projectId: null,
    projectName: null,
    note: null,
    createdBy: "user-1",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
  };
}

describe("computeDebtAnalytics", () => {
  it("computes exact directional totals and due-state counts", () => {
    const result = computeDebtAnalytics({
      debts: [
        debt("overdue", "receivable", 8_000n, "2026-07-12"),
        debt("soon", "payable", 3_000n, "2026-07-18"),
        debt("later", "receivable", 2_000n, "2026-08-01"),
        { ...debt("settled", "payable", 0n, "2026-07-01"), status: "settled" },
      ],
      now: new Date("2026-07-13T12:00:00.000Z"),
      dueSoonDays: 7,
    });

    expect(result).toEqual({
      receivableMinor: 10_000n,
      payableMinor: 3_000n,
      netMinor: 7_000n,
      openCount: 3,
      overdueCount: 1,
      dueSoonCount: 1,
    });
  });
});
