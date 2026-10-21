import { createFileRoute } from "@tanstack/react-router";

import { AdminMfaSetupPage } from "@/features/admin/security/AdminMfaSetupPage";
import { AdminSessionProvider } from "@/lib/auth/session";

export const Route = createFileRoute("/admin/mfa-setup")({
  head: () => ({ meta: [{ title: "Set up MFA - Admin Portal" }] }),
  component: () => (
    <AdminSessionProvider>
      <AdminMfaSetupPage />
    </AdminSessionProvider>
  ),
});
