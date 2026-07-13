import type { PropsWithChildren, ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { demoAuthValue } from "@/features/auth/demo-auth";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";

export function TestProviders({
  children,
  route = "/",
}: PropsWithChildren<{ route?: string }>): ReactElement {
  return (
    <MemoryRouter initialEntries={[route]}>
      <AppProviders
        authValue={demoAuthValue}
        workspaceValue={demoWorkspaceValue}
      >
        {children}
      </AppProviders>
    </MemoryRouter>
  );
}
