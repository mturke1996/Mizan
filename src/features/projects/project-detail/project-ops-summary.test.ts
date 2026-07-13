import { describe, expect, it } from "vitest";
import {
  buildProjectWhatsAppSummary,
  sumPeriodTotals,
} from "./project-ops-summary";
import type { ProjectAnalyticsSnapshot } from "@/domain/analytics/compute-project-analytics";
import type { ProjectSummary } from "@/features/workspace/workspace-types";

const project = {
  id: "p1",
  name: "تربية طيور",
  modules: {
    transactions: true,
    goal: false,
    workers: true,
    capital: true,
    inventory: false,
  livestock: false,
  },
} as ProjectSummary;

const analytics = {
  outstandingLaborMinor: 50_000n,
  capitalMinor: 200_000n,
  capitalRecoveredRate: 40,
} as ProjectAnalyticsSnapshot;

describe("project-ops-summary", () => {
  it("builds Arabic WhatsApp-ready text", () => {
    const text = buildProjectWhatsAppSummary({
      analytics,
      currency: "LYD",
      period: "day",
      project,
      periodIncomeMinor: 100_000n,
      periodExpenseMinor: 30_000n,
    });
    expect(text).toContain("تربية طيور");
    expect(text).toContain("الدخل:");
    expect(text).toContain("مستحقات العمال");
    expect(text).toContain("من ميزان");
  });

  it("sums period totals for a project", () => {
    const totals = sumPeriodTotals(
      [
        {
          kind: "income",
          amountMinor: 10n,
          occurredAt: "2026-07-13T10:00:00.000Z",
          projectId: "p1",
        } as never,
        {
          kind: "expense",
          amountMinor: 4n,
          occurredAt: "2026-07-13T11:00:00.000Z",
          projectId: "p1",
        } as never,
        {
          kind: "income",
          amountMinor: 99n,
          occurredAt: "2026-07-01T10:00:00.000Z",
          projectId: "p1",
        } as never,
      ],
      "p1",
      "2026-07-13T00:00:00.000Z",
    );
    expect(totals).toEqual({ incomeMinor: 10n, expenseMinor: 4n });
  });
});
