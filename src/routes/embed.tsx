import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
// billing: feature-locked state when the plan lacks the feature.
import { FeatureLockedNotice } from "@/features/billing/components/FeatureGate";
import { EmbedView } from "@/features/embed/components/EmbedView";

export const Route = createFileRoute("/embed")({
  head: () => ({
    meta: [{ title: "Embed — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Embed"
        description="Generate tokens to embed dashboards and widgets in external sites."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Embed" }]}
      />
      <FeatureLockedNotice
        feature="embedding"
        description="Existing embed tokens stop serving and new ones cannot be created until the plan includes embedding. You can still revoke tokens."
      />
      <EmbedView />
    </TenantPortal>
  ),
});
