import { describe, expect, it } from "vitest";
import { groupProjectsByParent } from "./parent-project-tree";
import type { ProjectSummary } from "@/features/workspace/workspace-types";

function project(
  partial: Partial<ProjectSummary> & Pick<ProjectSummary, "id" | "name">,
): ProjectSummary {
  return {
    description: "",
    status: "active",
    projectType: "general",
    modules: {
      transactions: true,
      goal: false,
      workers: false,
      capital: false,
      inventory: false,
      livestock: false,
    },
    incomeMinor: 0n,
    expenseMinor: 0n,
    profitMinor: 0n,
    progress: 0,
    mark: "م",
    tone: "bg-primary-soft text-primary",
    colorToken: "primary",
    outstandingLaborMinor: 0n,
    activeWorkers: 0,
    capitalMinor: 0n,
    capitalRecoveredRate: null,
    inventoryValueMinor: 0n,
    inventoryItemCount: 0,
    parentProjectId: null,
    ...partial,
  };
}

describe("groupProjectsByParent", () => {
  it("rolls child totals into parent groups", () => {
    const parent = project({
      id: "p1",
      name: "مزرعة",
      incomeMinor: 1000n,
      expenseMinor: 200n,
      profitMinor: 800n,
      capitalMinor: 5000n,
    });
    const child = project({
      id: "c1",
      name: "دواجن",
      parentProjectId: "p1",
      incomeMinor: 400n,
      expenseMinor: 100n,
      profitMinor: 300n,
      capitalMinor: 1000n,
    });
    const alone = project({ id: "a1", name: "متجر", incomeMinor: 50n });

    const result = groupProjectsByParent([parent, child, alone]);
    expect(result.roots).toHaveLength(1);
    expect(result.roots[0]?.rolledIncomeMinor).toBe(1400n);
    expect(result.roots[0]?.rolledExpenseMinor).toBe(300n);
    expect(result.roots[0]?.rolledProfitMinor).toBe(1100n);
    expect(result.roots[0]?.rolledCapitalMinor).toBe(6000n);
    expect(result.roots[0]?.childCount).toBe(1);
    expect(result.standalone.map((item) => item.id)).toEqual(["a1"]);
  });
});
