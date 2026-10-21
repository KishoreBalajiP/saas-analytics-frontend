import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuditLogList } from "@/features/admin/components/AuditViews";

export const Route = createFileRoute("/admin/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Audit Logs"
        description="Security events and data changes across the platform, with tamper-evident history."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Audit Logs" }]}
      />
      <AuditLogList />
    </AdminPortal>
  ),
});
