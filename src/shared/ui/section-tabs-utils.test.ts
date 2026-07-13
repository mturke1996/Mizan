import { resolveActiveTabId } from "./section-tabs-utils";

describe("resolveActiveTabId", () => {
  it("keeps enabled requests, falls back, and handles no enabled tabs", () => {
    const tabs = [
      { id: "overview" },
      { id: "history", disabled: true },
      { id: "settings" },
    ] as const;

    expect(resolveActiveTabId(tabs, "settings")).toBe("settings");
    expect(resolveActiveTabId(tabs, "history")).toBe("overview");
    expect(resolveActiveTabId<string>(tabs, "missing")).toBe("overview");
    expect(resolveActiveTabId(tabs, undefined)).toBe("overview");
    expect(
      resolveActiveTabId([{ id: "history", disabled: true }] as const, "history"),
    ).toBeUndefined();
    expect(resolveActiveTabId([], undefined)).toBeUndefined();
  });
});
