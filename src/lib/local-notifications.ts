import { Capacitor } from "@capacitor/core";
import { MOTIVATIONAL_NOTIFICATIONS } from "./motivational-notifications";

const CHANNEL_ID = "mizan_signals";
const SHOWN_KEY = "mizan.deviceNotifiedIds.v1";
const MAX_SHOWN_TRACKED = 200;

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

async function getLocalNotifications() {
  return import("@capacitor/local-notifications");
}

function readShownIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeShownIds(ids: Set<string>) {
  const list = [...ids].slice(-MAX_SHOWN_TRACKED);
  localStorage.setItem(SHOWN_KEY, JSON.stringify(list));
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative()) {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  }

  try {
    const { LocalNotifications } = await getLocalNotifications();
    let status = await LocalNotifications.checkPermissions();
    if (status.display !== "granted") {
      status = await LocalNotifications.requestPermissions();
    }
    return status.display === "granted";
  } catch {
    return false;
  }
}

export async function ensureAndroidChannel(): Promise<void> {
  if (!isNative() || Capacitor.getPlatform() !== "android") return;
  try {
    const { LocalNotifications } = await getLocalNotifications();
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "إشارات ميزان",
      description: "رسائل تحفيزية وتنبيهات من إدارة المنصة",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "default",
    });
  } catch {
    // Older Android / plugin optional.
  }
}

/** Schedule the 3 daily motivational notifications (fires even when app is closed). */
export async function scheduleMotivationalNotifications(): Promise<void> {
  const allowed = await ensureNotificationPermission();
  if (!allowed || !isNative()) return;

  await ensureAndroidChannel();
  const { LocalNotifications } = await getLocalNotifications();

  const ids = MOTIVATIONAL_NOTIFICATIONS.map((item) => item.id);
  try {
    await LocalNotifications.cancel({
      notifications: ids.map((id) => ({ id })),
    });
  } catch {
    // Ignore cancel failures on first run.
  }

  await LocalNotifications.schedule({
    notifications: MOTIVATIONAL_NOTIFICATIONS.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      channelId: CHANNEL_ID,
      schedule: {
        on: {
          hour: item.hour,
          minute: item.minute,
        },
        repeats: true,
        allowWhileIdle: true,
      },
      extra: {
        kind: "motivational",
        templateId: item.id,
      },
    })),
  });
}

export async function presentDeviceNotification(input: {
  id: number;
  title: string;
  body: string;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) return;

  if (!isNative()) {
    try {
      new Notification(input.title, { body: input.body, tag: String(input.id) });
    } catch {
      // Browser may block without user gesture.
    }
    return;
  }

  await ensureAndroidChannel();
  const { LocalNotifications } = await getLocalNotifications();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: input.id,
        title: input.title,
        body: input.body,
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 400) },
        extra: input.extra,
      },
    ],
  });
}

/**
 * Turn fresh unread inbox rows into device notifications.
 * Works immediately when the app process is alive; catches up on resume.
 */
export async function deliverInboxToDevice(
  rows: Array<{
    id: string;
    title: string;
    body: string;
    kind: string;
    createdAt: string;
  }>,
): Promise<number> {
  const shown = readShownIds();
  const cutoff = Date.now() - 1000 * 60 * 60 * 48;
  let delivered = 0;

  for (const row of rows) {
    if (shown.has(row.id)) continue;
    const created = Date.parse(row.createdAt);
    if (!Number.isFinite(created) || created < cutoff) {
      shown.add(row.id);
      continue;
    }

    // Stable numeric id in LocalNotifications int range.
    const numericId =
      200000 +
      Math.abs(
        [...row.id].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0),
      ) %
        700000;

    await presentDeviceNotification({
      id: numericId,
      title: row.title,
      body: row.body,
      extra: { notificationId: row.id, kind: row.kind },
    });
    shown.add(row.id);
    delivered += 1;
    if (delivered >= 5) break;
  }

  writeShownIds(shown);
  return delivered;
}

export async function initDeviceNotifications(): Promise<void> {
  if (!isNative()) return;
  try {
    await ensureNotificationPermission();
    await ensureAndroidChannel();
    await scheduleMotivationalNotifications();
  } catch {
    // Native plugins may be unavailable in some builds.
  }
}
