import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/api-keys")({
  head: () => ({
    meta: [{ title: "API Keys — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="API Keys"
        description="Manage keys for external API access."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "API Keys" }]}
      />
      <ComingSoon
        title="API Key Management"
        description="Create, view, and revoke API keys with fine-grained scope control for the external API."
      />
    </TenantPortal>
  ),
});
