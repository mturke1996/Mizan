import { describe, expect, it } from "vitest";
import {
  getTransactionTemplates,
  COMMON_TRANSACTION_TEMPLATES,
} from "./transaction-templates";

describe("transaction-templates", () => {
  it("merges blueprint suggested categories with common shortcuts", () => {
    const templates = getTransactionTemplates({
      kind: "expense",
      projectType: "birds",
    });

    expect(templates.some((item) => item.title === "علف")).toBe(true);
    expect(templates.some((item) => item.title === "إيجار")).toBe(true);
    expect(templates.some((item) => item.title === "رواتب وأجور")).toBe(true);
    expect(templates.every((item) => item.kind === "expense")).toBe(true);
  });

  it("offers general project categories without bird-specific labels", () => {
    const templates = getTransactionTemplates({
      kind: "expense",
      projectType: "general",
    });

    expect(templates.some((item) => item.title === "تسويق وإعلانات")).toBe(
      true,
    );
    expect(templates.some((item) => item.title === "صيانة وتشغيل")).toBe(true);
    expect(templates.some((item) => item.title === "علف")).toBe(false);
  });

  it("deduplicates labels across blueprint and common lists", () => {
    const templates = getTransactionTemplates({
      kind: "expense",
      projectType: "animals",
    });
    const titles = templates.map((item) => item.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("exposes common shortcuts independently", () => {
    expect(COMMON_TRANSACTION_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });
});
