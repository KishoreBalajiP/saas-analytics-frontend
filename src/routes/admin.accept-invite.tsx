import { createFileRoute } from "@tanstack/react-router";

import { AdminAcceptInvitePage } from "@/features/admin/security/AdminAcceptInvitePage";

// Admin invitation emails link here: `/admin/accept-invite?token=...`.
export const Route = createFileRoute("/admin/accept-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({ meta: [{ title: "Accept admin invitation - Analivo" }] }),
  component: AdminAcceptInviteRoute,
});

function AdminAcceptInviteRoute() {
  const { token } = Route.useSearch();
  return <AdminAcceptInvitePage token={token} />;
}
