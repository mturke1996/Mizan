/** Local bootstrap cache so PWA can open read-only offline after first visit. */

import type { Profile } from "@/features/auth/auth-context";
import type { WorkspaceMembership } from "@/features/workspace/workspace-types";

const PROFILE_KEY = "mizan-offline-profile";
const MEMBERSHIP_KEY = "mizan-offline-membership";
const FINANCE_QUERY_CACHE_KEY = "mizan-finance-query-cache";
/** Legacy key from invoice-only persistence — cleared on logout. */
const LEGACY_INVOICE_QUERY_CACHE_KEY = "mizan-invoice-query-cache";

const CACHE_VERSION = 1 as const;

type Versioned<T> = { v: typeof CACHE_VERSION; data: T };

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

function readVersioned<T>(key: string): T | null {
  if (!canUseStorage()) return null;
  const parsed = safeParse<Versioned<T> | T>(localStorage.getItem(key));
  if (!parsed || typeof parsed !== "object") return null;
  if ("v" in parsed && "data" in parsed) {
    if (parsed.v !== CACHE_VERSION) return null;
    return parsed.data;
  }
  // Legacy unversioned payloads
  return parsed as T;
}

export function cacheOfflineProfile(profile: Profile): void {
  writeJson(PROFILE_KEY, { v: CACHE_VERSION, data: profile } satisfies Versioned<Profile>);
}

export function readOfflineProfile(userId: string): Profile | null {
  const cached = readVersioned<Profile>(PROFILE_KEY);
  if (!cached || cached.id !== userId) return null;
  return cached;
}

export function cacheOfflineMembership(
  userId: string,
  membership: WorkspaceMembership,
): void {
  writeJson(MEMBERSHIP_KEY, {
    v: CACHE_VERSION,
    data: { userId, membership },
  } satisfies Versioned<{ userId: string; membership: WorkspaceMembership }>);
}

export function readOfflineMembership(
  userId: string,
): WorkspaceMembership | null {
  const cached = readVersioned<{
    userId: string;
    membership: WorkspaceMembership;
  }>(MEMBERSHIP_KEY);
  if (!cached || cached.userId !== userId) return null;
  return cached.membership;
}

/** Wipe bootstrap + persisted React Query finance cache (call on sign-out). */
export function clearOfflineBootstrap(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(MEMBERSHIP_KEY);
    localStorage.removeItem(FINANCE_QUERY_CACHE_KEY);
    localStorage.removeItem(LEGACY_INVOICE_QUERY_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
