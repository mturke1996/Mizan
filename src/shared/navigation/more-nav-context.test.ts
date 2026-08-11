import { describe, expect, it } from "vitest";
import { isMoreNavRoute } from "./more-nav-context";

describe("isMoreNavRoute", () => {
  it("matches primary more-sheet destinations", () => {
    expect(isMoreNavRoute("/analytics")).toBe(true);
    expect(isMoreNavRoute("/clients/client-1")).toBe(true);
    expect(isMoreNavRoute("/settings/profile")).toBe(true);
  });

  it("ignores primary bottom-nav destinations", () => {
    expect(isMoreNavRoute("/transactions")).toBe(false);
    expect(isMoreNavRoute("/projects/p1")).toBe(false);
  });
});
