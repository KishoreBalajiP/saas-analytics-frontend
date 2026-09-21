import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { MonitoringView } from "@/features/admin/components/AdminViews";

export const Route = createFileRoute("/admin/monitoring")({
  head: () => ({ meta: [{ title: "Monitoring — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Monitoring"
        description="System health probes and operational metrics."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Monitoring" }]}
      />
      <MonitoringView />
    </AdminPortal>
  ),
});
