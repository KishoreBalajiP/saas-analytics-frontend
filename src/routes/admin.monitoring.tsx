import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/admin/monitoring")({
  head: () => ({ meta: [{ title: "Monitoring — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Monitoring"
        description="System health probes and operational metrics."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Monitoring" }]}
      />
      <ComingSoon
        title="System Monitoring"
        description="Health probes for system, database, websocket, queue, scheduler, storage, and connectors."
      />
    </AdminPortal>
  ),
});
