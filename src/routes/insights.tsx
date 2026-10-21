import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { InsightFeed } from "@/features/insights/components/InsightFeed";

/** ai-insights: the metric insights view (?metric=<key> narrows the feed). */
export const Route = createFileRoute("/insights")({
  validateSearch: (search: Record<string, unknown>) => ({
    metric: typeof search["metric"] === "string" ? search["metric"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Insights — Analytics Console" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  const { metric } = Route.useSearch();
  return (
    <TenantPortal>
      <PageHeader
        title="Insights"
        description="Computed observations about your metrics. Narrative text is checked against the numbers."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Insights" }]}
      />
      <InsightFeed {...(metric ? { metric } : {})} />
    </TenantPortal>
  );
}
