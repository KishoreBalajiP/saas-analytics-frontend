import { createFileRoute } from "@tanstack/react-router";

import { AdminResetPasswordPage } from "@/features/admin/security/AdminResetPasswordPage";

// The admin reset email links here: `/admin/reset-password?token=...`.
export const Route = createFileRoute("/admin/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({ meta: [{ title: "Choose a new admin password - Analivo" }] }),
  component: AdminResetPasswordRoute,
});

function AdminResetPasswordRoute() {
  const { token } = Route.useSearch();
  return <AdminResetPasswordPage token={token} />;
}
