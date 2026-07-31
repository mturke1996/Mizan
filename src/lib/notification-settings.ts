export interface NotificationSettings {
  motivationalEnabled: boolean;
  deviceNotificationsEnabled: boolean;
  operationalAlertsEnabled: boolean;
}

const SETTINGS_KEY = "mizan.notificationSettings.v1";

const DEFAULT_SETTINGS: NotificationSettings = {
  motivationalEnabled: false,
  deviceNotificationsEnabled: true,
  operationalAlertsEnabled: true,
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      motivationalEnabled:
        typeof parsed.motivationalEnabled === "boolean"
          ? parsed.motivationalEnabled
          : DEFAULT_SETTINGS.motivationalEnabled,
      deviceNotificationsEnabled:
        typeof parsed.deviceNotificationsEnabled === "boolean"
          ? parsed.deviceNotificationsEnabled
          : DEFAULT_SETTINGS.deviceNotificationsEnabled,
      operationalAlertsEnabled:
        typeof parsed.operationalAlertsEnabled === "boolean"
          ? parsed.operationalAlertsEnabled
          : DEFAULT_SETTINGS.operationalAlertsEnabled,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateNotificationSettings(
  partial: Partial<NotificationSettings>,
): NotificationSettings {
  const current = getNotificationSettings();
  const updated: NotificationSettings = {
    ...current,
    ...partial,
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch {
    // quota error ignore
  }
  return updated;
}
