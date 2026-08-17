import type { ReactNode } from "react";

import { AdminSessionProvider } from "@/lib/auth/session";
import { AdminShell } from "@/components/layout/AdminShell";

/**
 * Wraps an admin-portal page with session context + shell layout.
 * AdminShell already handles unauthenticated → /admin/login redirect.
 */
export function AdminPortal({ children }: { children: ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminShell>{children}</AdminShell>
    </AdminSessionProvider>
  );
}
