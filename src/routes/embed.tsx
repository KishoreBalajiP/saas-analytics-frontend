import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
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
      <EmbedView />
    </TenantPortal>
  ),
});
