import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccessRequestList } from "@/features/admin/components/AccessRequestList";

export const Route = createFileRoute("/admin/access-requests")({
  head: () => ({ meta: [{ title: "Access requests — Admin Portal" }] }),
  component: AccessRequestsPage,
});

function AccessRequestsPage() {
  return (
    <AdminPortal>
      <PageHeader
        title="Access requests"
        description="Review requests before sending workspace invitations."
      />
      <AccessRequestList />
    </AdminPortal>
  );
}
