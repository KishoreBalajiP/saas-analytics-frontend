import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { TenantDeletionList } from "@/features/tenant-deletions/components/TenantDeletionList";

export const Route = createFileRoute("/admin/tenant-deletions")({
  head: () => ({ meta: [{ title: "Tenant deletions — Admin Portal" }] }),
  component: TenantDeletionsPage,
});

function TenantDeletionsPage() {
  return (
    <AdminPortal>
      <PageHeader
        title="Tenant deletions"
        description="Scheduled, failed and completed workspace deletions."
      />
      <TenantDeletionList />
    </AdminPortal>
  );
}
