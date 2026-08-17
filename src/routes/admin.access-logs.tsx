import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/admin/access-logs")({
  head: () => ({ meta: [{ title: "Access Logs — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Access Logs"
        description="Monitor API and web traffic patterns."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Access Logs" }]}
      />
      <ComingSoon
        title="Access Log Viewer"
        description="Search access logs, view top paths and errors, and export for analysis."
      />
    </AdminPortal>
  ),
});
