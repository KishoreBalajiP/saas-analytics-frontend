import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/datasets")({
  head: () => ({
    meta: [{ title: "Datasets — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Datasets"
        description="Connect and manage your data sources."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Datasets" }]}
      />
      <ComingSoon
        title="Dataset Management"
        description="Create and configure CSV, XLSX, MongoDB, and Webhook connectors to ingest data."
      />
    </TenantPortal>
  ),
});
