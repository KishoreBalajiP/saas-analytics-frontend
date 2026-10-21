import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
// billing: feature-locked state when the plan lacks the feature.
import { FeatureLockedNotice } from "@/features/billing/components/FeatureGate";
import { ApiKeysView } from "@/features/api-keys/components/ApiKeysView";

export const Route = createFileRoute("/api-keys")({
  head: () => ({
    meta: [{ title: "API Keys — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="API Keys"
        description="Manage keys for external API access. See the API Reference (/developers) for endpoints and examples."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "API Keys" }]}
      />
      <FeatureLockedNotice
        feature="api_access"
        description="External API calls are refused and new keys cannot be created until the plan includes API access. You can still revoke keys."
      />
      <ApiKeysView />
    </TenantPortal>
  ),
});
