import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { TenantDetail } from "@/features/admin/components/AdminViews";

export const Route = createFileRoute("/admin/tenants/$tenantId")({
  head: () => ({ meta: [{ title: "Tenant — Admin Portal" }] }),
  component: TenantDetailPage,
});

function TenantDetailPage() {
  const { tenantId } = Route.useParams();
  return (
    <AdminPortal>
      <PageHeader
        title="Tenant detail"
        crumbs={[
          { label: "Admin", to: "/admin/dashboard" },
          { label: "Tenants", to: "/admin/tenants" },
          { label: "Detail" },
        ]}
      />
      <TenantDetail tenantId={tenantId} />
    </AdminPortal>
  );
}
