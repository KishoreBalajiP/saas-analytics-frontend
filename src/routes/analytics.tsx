import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [{ title: "Analytics — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Analytics"
        description="Query and explore your data with filters, metrics, and grouping."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Analytics" }]}
      />
      <ComingSoon
        title="Query Builder"
        description="Build complex analytics queries with filters, metrics, groupBy, and date ranges against your connected datasets."
      />
    </TenantPortal>
  ),
});
