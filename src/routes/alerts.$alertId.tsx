import { createFileRoute } from "@tanstack/react-router";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertDetail } from "@/features/alerts/components/AlertsView";

export const Route = createFileRoute("/alerts/$alertId")({
  head: () => ({ meta: [{ title: "Alert — Analytics Console" }] }),
  component: AlertPage,
});

function AlertPage() {
  const { alertId } = Route.useParams();
  return (
    <TenantPortal>
      <PageHeader
        title="Alert"
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Alerts", to: "/alerts" },
          { label: "Detail" },
        ]}
      />
      <AlertDetail alertId={alertId} />
    </TenantPortal>
  );
}
