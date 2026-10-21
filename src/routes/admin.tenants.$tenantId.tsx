import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
// backups: platform-initiated tenant data export (roadmap 2.9).
import { TenantDataExportPanel } from "@/features/data-export/components/TenantDataExportPanel";
import { TenantDetail } from "@/features/admin/components/AdminViews";
import { TenantAuditHistory } from "@/features/admin/components/AuditViews";
// members: workspace deletion oversight (roadmap 2.10).
import { TenantDeletionCard } from "@/features/members/components/TenantDeletionCard";

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
      <div className="space-y-6">
        <TenantDetail tenantId={tenantId} />
        {/* members: workspace deletion oversight (roadmap 2.10). */}
        <TenantDeletionCard tenantId={tenantId} />
        {/* backups: tenant data export (roadmap 2.9). */}
        <TenantDataExportPanel tenantId={tenantId} />
        <TenantAuditHistory tenantId={tenantId} />
      </div>
    </AdminPortal>
  );
}
