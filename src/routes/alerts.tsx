import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertsView } from "@/features/alerts/components/AlertsView";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [{ title: "Alerts — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Alerts"
        description="Monitor conditions and get notified when thresholds are breached."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Alerts" }]}
      />
      <AlertsView />
    </TenantPortal>
  ),
});
