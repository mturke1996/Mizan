import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { Toaster } from "sonner";
import {
  AuthProvider,
  type AuthContextValue,
} from "@/features/auth/AuthProvider";
import {
  WorkspaceProvider,
  type WorkspaceContextValue,
} from "@/features/workspace/WorkspaceProvider";
import { DeviceNotificationsBridge } from "@/features/notifications/DeviceNotificationsBridge";
import { RecurringDuePoster } from "@/features/workspace/RecurringDuePoster";
import { AndroidBackButton } from "@/shared/native/AndroidBackButton";
import { ConfirmDialogProvider } from "@/shared/ui/confirm-dialog";

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      gcTime: SEVEN_DAYS_MS,
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: 0,
      networkMode: "offlineFirst",
    },
  },
});

function serializePersistedClient(client: PersistedClient): string {
  return JSON.stringify(client, (_key, value) => {
    if (typeof value === "bigint") {
      return { __type: "bigint", value: value.toString() };
    }
    return value;
  });
}

function deserializePersistedClient(cached: string): PersistedClient {
  return JSON.parse(cached, (_key, value) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as { __type?: string }).__type === "bigint" &&
      typeof (value as { value?: unknown }).value === "string"
    ) {
      return BigInt((value as { value: string }).value);
    }
    return value;
  }) as PersistedClient;
}

const financePersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "mizan-finance-query-cache",
  serialize: serializePersistedClient,
  deserialize: deserializePersistedClient,
});

const PERSISTED_QUERY_ROOTS = new Set([
  "invoices",
  "invoice-detail",
  "wallets",
  "transactions",
  "projects",
  "categories",
  "debts",
  "debt-workspace-summary",
  "debt-detail",
  "debt-entries",
  "debt-parties",
  "clients",
  "income-sources",
  "income-entries",
  "analytics",
  "finance",
  "project-cash-balance",
  "project-cash-entries",
]);

export function AppProviders({
  children,
  authValue,
  workspaceValue,
}: PropsWithChildren<{
  authValue?: AuthContextValue;
  workspaceValue?: WorkspaceContextValue;
}>) {
  // Injected test providers skip persistence to avoid async restore noise.
  const isTestHarness = Boolean(authValue || workspaceValue);
  const tree = (
    <ConfirmDialogProvider>
      <AuthProvider value={authValue}>
        <WorkspaceProvider value={workspaceValue}>
          {children}
          {!isTestHarness ? <RecurringDuePoster /> : null}
          {!isTestHarness ? <DeviceNotificationsBridge /> : null}
          {!isTestHarness ? <AndroidBackButton /> : null}
          <Toaster
            position="top-center"
            dir="rtl"
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast: "!rounded-md !border-line !bg-surface !text-ink",
              },
            }}
          />
        </WorkspaceProvider>
      </AuthProvider>
    </ConfirmDialogProvider>
  );

  if (isTestHarness) {
    return (
      <QueryClientProvider client={queryClient}>{tree}</QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: financePersister,
        maxAge: SEVEN_DAYS_MS,
        // Bump when persisted query set / shape changes.
        buster: "finance-cache-v2",
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            if (query.state.status !== "success") return false;
            const root = query.queryKey[0];
            return typeof root === "string" && PERSISTED_QUERY_ROOTS.has(root);
          },
        },
      }}
    >
      {tree}
    </PersistQueryClientProvider>
  );
}
