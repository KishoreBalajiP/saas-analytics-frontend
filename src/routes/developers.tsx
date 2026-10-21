import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { DeveloperReference } from "@/features/api-keys/components/DeveloperReference";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [{ title: "API Reference — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="API Reference"
        description="External API endpoints, scopes, examples and error codes."
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "API Keys", to: "/api-keys" },
          { label: "API Reference" },
        ]}
      />
      <DeveloperReference />
    </TenantPortal>
  ),
});
