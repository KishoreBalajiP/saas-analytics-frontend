import { createFileRoute } from "@tanstack/react-router";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertDetail } from "@/features/alerts/components/AlertsView";

export const Route = createFileRoute("/alerts/$alertId/edit")({
  head: () => ({ meta: [{ title: "Edit Alert — Analytics Console" }] }),
  component: EditAlertPage,
});

function EditAlertPage() {
  const { alertId } = Route.useParams();
  return (
    <TenantPortal>
      <PageHeader
        title="Edit alert"
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Alerts", to: "/alerts" },
          { label: "Edit" },
        ]}
      />
      <AlertDetail alertId={alertId} edit />
    </TenantPortal>
  );
}
