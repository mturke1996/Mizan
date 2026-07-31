import { beforeEach, describe, expect, it } from "vitest";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "./notification-settings";

describe("notification-settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default settings when none stored", () => {
    const settings = getNotificationSettings();
    expect(settings.motivationalEnabled).toBe(false);
    expect(settings.deviceNotificationsEnabled).toBe(true);
    expect(settings.operationalAlertsEnabled).toBe(true);
  });

  it("updates and persists settings", () => {
    updateNotificationSettings({ motivationalEnabled: true });
    expect(getNotificationSettings().motivationalEnabled).toBe(true);

    updateNotificationSettings({ deviceNotificationsEnabled: false });
    const settings = getNotificationSettings();
    expect(settings.motivationalEnabled).toBe(true);
    expect(settings.deviceNotificationsEnabled).toBe(false);
    expect(settings.operationalAlertsEnabled).toBe(true);
  });
});
