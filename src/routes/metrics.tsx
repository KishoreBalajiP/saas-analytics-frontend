import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricsCatalogue } from "@/features/metrics/components/MetricsCatalogue";

export const Route = createFileRoute("/metrics")({
  head: () => ({ meta: [{ title: "Metrics — Analytics Console" }] }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Metrics"
        description="Named, versioned business metrics. Approved versions can be used in queries."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Metrics" }]}
      />
      <MetricsCatalogue />
    </TenantPortal>
  ),
});
