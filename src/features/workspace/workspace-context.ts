import { createContext } from "react";
import type { WorkspaceMembership } from "./workspace-types";

export interface WorkspaceContextValue {
  membership: WorkspaceMembership | null;
  workspaceId: string | null;
  currency: string;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isDemo?: boolean;
}

export const WorkspaceContext =
  createContext<WorkspaceContextValue | null>(null);
