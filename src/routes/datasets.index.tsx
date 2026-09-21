import { createFileRoute } from "@tanstack/react-router";

import { ConnectorList } from "@/features/datasets/components/ConnectorList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

export const Route = createFileRoute("/datasets/")({
  head: () => ({
    meta: [{ title: "Datasets — Analytics Console" }],
  }),
  component: DatasetsIndexPage,
});

function DatasetsIndexPage() {
  const { permissions } = useTenantSession();
  const canCreate = hasPermission(permissions, Permissions.CONNECTORS_CREATE);

  return (
    <>
      <PageHeader
        title="Datasets"
        description="Connect and manage your data sources."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Datasets" }]}
      />
      <ConnectorList />
    </>
  );
}
