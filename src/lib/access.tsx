import { createContext, useContext, type ReactNode } from "react";
import type { MyAccess } from "@/lib/mes/authz.functions";

const AccessContext = createContext<MyAccess | null>(null);

export function AccessProvider({ access, children }: { access: MyAccess; children: ReactNode }) {
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export function useAccess(): MyAccess {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    return { userId: "", email: null, displayName: null, permissions: [], grants: [] };
  }
  return ctx;
}

/** True when the signed-in person holds this action (anywhere in their scope). */
export function useCan(action: string): boolean {
  const { permissions } = useAccess();
  return permissions.includes(action) || permissions.includes("platform.admin");
}

export function useCanAny(...actions: (string | string[])[]): boolean {
  const { permissions } = useAccess();
  if (permissions.includes("platform.admin")) return true;
  return actions.flat().some((a) => permissions.includes(a));
}


/** Renders children only when the person holds the action. */
export function Can({
  action,
  children,
  fallback = null,
}: {
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = useCan(action);
  return <>{allowed ? children : fallback}</>;
}
