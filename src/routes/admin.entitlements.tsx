import { createFileRoute } from "@tanstack/react-router";
import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminOverridesView } from "@/features/admin/components/BillingViews";

export const Route = createFileRoute("/admin/entitlements")({
  head: () => ({
    meta: [
      { title: "Entitlements - Analivo Admin" },
      { name: "description", content: "Inspect and revoke entitlement overrides." },
    ],
  }),
  component: AdminEntitlementsPage,
});

function AdminEntitlementsPage() {
  return (
    <AdminPortal>
      <PageHeader
        title="Entitlement overrides"
        description="Audit and revoke platform-admin entitlement overrides."
      />
      <AdminOverridesView />
    </AdminPortal>
  );
}
