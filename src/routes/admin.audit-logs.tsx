import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/admin/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Audit Logs"
        description="Track all administrative and system actions."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Audit Logs" }]}
      />
      <ComingSoon
        title="Audit Log Viewer"
        description="Search, filter, and export audit logs by actor, module, action, resource, tenant, and date range."
      />
    </AdminPortal>
  ),
});
