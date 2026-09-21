import { createFileRoute } from "@tanstack/react-router";

import { DashboardEditor } from "@/features/dashboards/components/DashboardEditor";
import { PageHeader } from "@/components/layout/PageHeader";
import { TenantPortal } from "@/components/layout/TenantPortal";

export const Route = createFileRoute("/dashboards/$dashboardId/edit")({
  head: () => ({ meta: [{ title: "Edit Dashboard — Analytics Console" }] }),
  component: DashboardEditPage,
});

function DashboardEditPage() {
  const { dashboardId } = Route.useParams();
  return (
    <TenantPortal>
      <PageHeader
        title="Edit dashboard"
        description="Update dashboard settings and widget configuration."
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Dashboards", to: "/dashboards" },
          { label: "Edit" },
        ]}
      />
      <DashboardEditor dashboardId={dashboardId} />
    </TenantPortal>
  );
}
