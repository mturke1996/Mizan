import { describe, expect, it } from "vitest";
import {
  daysUntil,
  formatMinorCurrency,
  statusTone,
  subscriptionStatusLabel,
} from "./supervisor-utils";

describe("supervisor-utils", () => {
  it("formats minor amounts using each currency precision", () => {
    expect(formatMinorCurrency(1_250_000, "LYD")).toBe("1,250");
    expect(formatMinorCurrency(125_000, "USD")).toBe("1,250");
  });

  it("maps subscription labels", () => {
    expect(subscriptionStatusLabel.trialing).toBe("تجريبي");
  });

  it("computes days until a date", () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntil(future)).toBeLessThanOrEqual(2);
  });

  it("returns tone classes for statuses", () => {
    expect(statusTone("frozen")).toContain("info");
    expect(statusTone("active")).toContain("success");
  });
});
