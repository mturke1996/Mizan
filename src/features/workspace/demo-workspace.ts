import type { WorkspaceContextValue } from "./WorkspaceProvider";

export const demoWorkspaceValue: WorkspaceContextValue = {
  membership: null,
  workspaceId: null,
  currency: "LYD",
  isLoading: false,
  error: null,
  refresh: async () => undefined,
  isDemo: true,
};
