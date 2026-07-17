import { describe, expect, it } from "vitest";
import {
  MOTIVATIONAL_NOTIFICATIONS,
  SUPERVISOR_SIGNAL_TEMPLATES,
} from "./motivational-notifications";

describe("motivational notifications", () => {
  it("exposes three daily motivational templates", () => {
    expect(MOTIVATIONAL_NOTIFICATIONS).toHaveLength(3);
    expect(MOTIVATIONAL_NOTIFICATIONS.map((item) => item.id)).toEqual([
      1001, 1002, 1003,
    ]);
    for (const item of MOTIVATIONAL_NOTIFICATIONS) {
      expect(item.title.trim().length).toBeGreaterThan(2);
      expect(item.body.trim().length).toBeGreaterThan(8);
    }
  });

  it("exposes supervisor quick-signal templates including custom", () => {
    expect(SUPERVISOR_SIGNAL_TEMPLATES.some((item) => item.key === "custom")).toBe(
      true,
    );
    expect(
      SUPERVISOR_SIGNAL_TEMPLATES.filter((item) => item.key !== "custom"),
    ).toHaveLength(3);
  });
});
