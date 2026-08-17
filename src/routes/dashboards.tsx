import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

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
      <ComingSoon
        title="Dashboard Builder"
        description="Create, publish, and share dashboards with KPI, table, bar, line, area, and pie chart widgets."
      />
    </TenantPortal>
  ),
});
