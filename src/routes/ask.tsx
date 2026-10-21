import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AskView } from "@/features/ai/components/AskView";

export const Route = createFileRoute("/ask")({
  head: () => ({ meta: [{ title: "Ask — Analytics Console" }] }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Ask a question"
        description="Read-only questions about your data. Every answer shows the query it ran."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Ask" }]}
      />
      <AskView />
    </TenantPortal>
  ),
});
