import { createFileRoute } from "@tanstack/react-router";

import { DashboardDetailView } from "@/features/dashboards/components/DashboardDetailView";
import { PageHeader } from "@/components/layout/PageHeader";
import { TenantPortal } from "@/components/layout/TenantPortal";
// ai-insights: insight feed per dashboard.
import { InsightFeed } from "@/features/insights/components/InsightFeed";

export const Route = createFileRoute("/dashboards/$dashboardId/")({
  head: () => ({ meta: [{ title: "Dashboard — Analytics Console" }] }),
  component: DashboardDetailPage,
});

function DashboardDetailPage() {
  const { dashboardId } = Route.useParams();
  return (
    <TenantPortal>
      <PageHeader
        title="Dashboard"
        description="Review the widgets and refresh their analytics data."
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Dashboards", to: "/dashboards" },
          { label: "Overview" },
        ]}
      />
      <InsightFeed dashboardId={dashboardId} />
      <DashboardDetailView dashboardId={dashboardId} />
    </TenantPortal>
  );
}
