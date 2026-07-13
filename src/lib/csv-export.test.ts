import { describe, expect, it } from "vitest";
import {
  buildCsv,
  exportTransactionsCsv,
  toCsvValue,
} from "./csv-export";

describe("csv-export", () => {
  it("escapes commas and quotes", () => {
    expect(toCsvValue('أ thr,"ب"')).toBe('"أ thr,""ب"""');
  });

  it("builds BOM-prefixed CSV", () => {
    const csv = buildCsv(["a", "b"], [["1", "2"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("a,b");
  });

  it("exports transactions with bigint amounts", () => {
    const csv = exportTransactionsCsv([
      {
        occurredAt: "2026-07-13T10:00:00.000Z",
        kind: "expense",
        title: "علف",
        amountMinor: 1500n,
        currency: "LYD",
        projectId: "p1",
      },
    ]);
    expect(csv).toContain("1500");
    expect(csv).toContain("علف");
  });
});
