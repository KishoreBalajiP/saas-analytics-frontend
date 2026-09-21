import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportsView } from "@/features/reports/components/ReportsView";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [{ title: "Reports — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Reports"
        description="Schedule and export reports in JSON, CSV, or XLSX."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Reports" }]}
      />
      <ReportsView />
    </TenantPortal>
  ),
});
