import { createFileRoute } from "@tanstack/react-router";

import { AdminLoginPage } from "@/features/admin/security/AdminLoginPage";
import { AdminSessionProvider } from "@/lib/auth/session";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Sign In - Analivo" },
      { name: "description", content: "Sign in to the admin portal." },
    ],
  }),
  component: () => (
    <AdminSessionProvider>
      <AdminLoginPage />
    </AdminSessionProvider>
  ),
});
