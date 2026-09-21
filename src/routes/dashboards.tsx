import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardList } from "@/features/dashboards/components/DashboardList";

export const Route = createFileRoute("/dashboards")({
  head: () => ({
    meta: [{ title: "Dashboards — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Dashboards"
        description="Visualize your data with KPI, table, and chart widgets."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Dashboards" }]}
      />
      <DashboardList />
    </TenantPortal>
  ),
});
