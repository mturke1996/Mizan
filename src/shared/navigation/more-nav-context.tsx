import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MoreNavSheet } from "./MoreNavSheet";

interface MoreNavContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  openMoreNav: () => void;
  closeMoreNav: () => void;
}

const MoreNavContext = createContext<MoreNavContextValue | null>(null);

export function MoreNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openMoreNav = useCallback(() => setOpen(true), []);
  const closeMoreNav = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, setOpen, openMoreNav, closeMoreNav }),
    [open, openMoreNav, closeMoreNav],
  );

  return (
    <MoreNavContext.Provider value={value}>
      {children}
      <MoreNavSheet open={open} onOpenChange={setOpen} />
    </MoreNavContext.Provider>
  );
}

export function useMoreNav(): MoreNavContextValue {
  const value = useContext(MoreNavContext);
  if (!value) {
    throw new Error("useMoreNav must be used within MoreNavProvider");
  }
  return value;
}

/** Routes opened from the «المزيد» sheet — used to tint the tab when active. */
export const MORE_NAV_PATH_PREFIXES = [
  "/analytics",
  "/reports",
  "/budgets",
  "/clients",
  "/notifications",
  "/settings",
] as const;

export function isMoreNavRoute(pathname: string): boolean {
  return MORE_NAV_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
