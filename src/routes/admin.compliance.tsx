import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComplianceView } from "@/features/admin/components/ComplianceView";

export const Route = createFileRoute("/admin/compliance")({
  head: () => ({ meta: [{ title: "Compliance — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Compliance"
        description="Data-subject requests: export, delete, restrict processing and consent withdrawal."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Compliance" }]}
      />
      <ComplianceView />
    </AdminPortal>
  ),
});
