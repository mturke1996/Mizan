import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import {
  AuthProvider,
  type AuthContextValue,
} from "@/features/auth/AuthProvider";
import {
  WorkspaceProvider,
  type WorkspaceContextValue,
} from "@/features/workspace/WorkspaceProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function AppProviders({
  children,
  authValue,
  workspaceValue,
}: PropsWithChildren<{
  authValue?: AuthContextValue;
  workspaceValue?: WorkspaceContextValue;
}>) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider value={authValue}>
        <WorkspaceProvider value={workspaceValue}>
          {children}
          <Toaster
            position="top-center"
            dir="rtl"
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast:
                  "!rounded-md !border-line !bg-surface !text-ink",
              },
            }}
          />
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
