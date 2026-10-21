import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { SecurityAlertsView } from "@/features/admin/components/SecurityAlerts";

const ALERT_ID = /^[0-9a-f]{24}$/i;

export const Route = createFileRoute("/admin/security-alerts")({
  // `?alert=<id>` opens one alert (links in on-call notifications).
  validateSearch: (search: Record<string, unknown>): { alert?: string } => {
    const alert = search["alert"];
    return typeof alert === "string" && ALERT_ID.test(alert) ? { alert } : {};
  },
  head: () => ({ meta: [{ title: "Security Alerts — Admin Portal" }] }),
  component: SecurityAlertsPage,
});

function SecurityAlertsPage() {
  const { alert } = Route.useSearch();
  return (
    <AdminPortal>
      <PageHeader
        title="Security alerts"
        description="Detections from the platform security rules: triage, evidence and acknowledgement."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Security alerts" }]}
      />
      <SecurityAlertsView initialAlertId={alert} />
    </AdminPortal>
  );
}
