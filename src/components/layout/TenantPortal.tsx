import type { ReactNode } from "react";

import { TenantSessionProvider } from "@/lib/auth/session";
import { TenantShell } from "@/components/layout/TenantShell";

/**
 * Wraps a tenant-portal page with session context + shell layout.
 * TenantShell already handles unauthenticated → /login redirect.
 */
export function TenantPortal({ children }: { children: ReactNode }) {
  return (
    <TenantSessionProvider>
      <TenantShell>{children}</TenantShell>
    </TenantSessionProvider>
  );
}
