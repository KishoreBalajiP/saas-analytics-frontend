import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { QueryBuilder } from "@/features/analytics/components/QueryBuilder";
import { QueryResults } from "@/features/analytics/components/QueryResults";
import { QueryHistory } from "@/features/analytics/components/QueryHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as analyticsApi from "@/features/analytics/api";
import * as connectorsApi from "@/features/datasets/api";
import * as metricsApi from "@/features/metrics/api";
import type { AnalyticsQueryParams, AnalyticsResult } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";
import { ErrorState } from "@/components/common/states";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [{ title: "Analytics — Analytics Console" }],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <TenantPortal>
      <AnalyticsContent />
    </TenantPortal>
  );
}

function AnalyticsContent() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.ANALYTICS_VIEW);
  const canExport = hasPermission(permissions, Permissions.ANALYTICS_EXPORT);

  const connectorsQuery = useQuery({
    queryKey: ["connectors", "list", { limit: 200 }],
    queryFn: () => connectorsApi.list({ limit: 200 }),
    enabled: canView,
  });

  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [lastParams, setLastParams] = useState<AnalyticsQueryParams | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [activeTab, setActiveTab] = useState<"query" | "history">("query");
  // Bumped when a history entry is re-run so the builder reloads its params.
  const [builderKey, setBuilderKey] = useState(0);
  const resultsRef = useRef<HTMLElement | null>(null);

  // ai-catalogue: approved metrics for the metric picker.
  const metricsQuery = useQuery({
    queryKey: ["metrics", "approved"],
    queryFn: () => metricsApi.list({ status: "approved", limit: 100 }),
    enabled: hasPermission(permissions, Permissions.METRICS_VIEW),
    retry: false,
  });
  const connectors = (connectorsQuery.data?.data ?? []) as import("@/lib/api/types").Connector[];
  // Field errors of a rejected query (400 INVALID_QUERY) are shown next to the builder.
  const serverErrors =
    error instanceof ApiError && error.statusCode === 400 ? (error.errors ?? undefined) : undefined;
  const timezone =
    typeof meta?.["timezone"] === "string" ? (meta["timezone"] as string) : undefined;

  if (!canView) {
    return <ErrorState error={{ statusCode: 403 }} resource="Analytics" />;
  }

  async function handleRun(params: AnalyticsQueryParams) {
    if (loading) return;
    setLoading(true);
    setError(null);
    setLastParams(params);
    // Stacked (narrow) layout: bring the results panel into view.
    if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 1023px)").matches) {
      resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
    try {
      const response = await analyticsApi.runQuery(params);
      setResult(response.result);
      setMeta(response.meta);
    } catch (err) {
      setError(err);
      setResult(null);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  if (connectorsQuery.isError) {
    return (
      <>
        <PageHeader
          title="Analytics"
          crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Analytics" }]}
        />
        <ErrorState
          error={connectorsQuery.error}
          onRetry={() => connectorsQuery.refetch()}
          resource="Datasets"
        />
      </>
    );
  }

  function handleRerun(params: AnalyticsQueryParams) {
    setActiveTab("query");
    setBuilderKey((k) => k + 1);
    void handleRun(params);
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Query and explore your data with filters, metrics, and grouping."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Analytics" }]}
      />

      {/* Two aligned panels: query (left) and results (right); stacked on narrow screens. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-label="Query" className="min-w-0 rounded-lg border border-border bg-card">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "query" | "history")}
          >
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 py-2">
              <h2 className="text-sm font-semibold">Query</h2>
              <TabsList className="h-8">
                <TabsTrigger value="query" className="text-xs">
                  Builder
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  History
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="query" className="m-0 p-4">
              <QueryBuilder
                key={builderKey}
                connectors={connectors}
                onRun={handleRun}
                loading={loading}
                initialParams={lastParams}
                serverErrors={serverErrors}
                timezone={timezone}
                catalogueMetrics={metricsQuery.data?.data}
              />
            </TabsContent>
            <TabsContent value="history" className="m-0 p-4">
              <QueryHistory onRerun={handleRerun} onView={handleRerun} />
            </TabsContent>
          </Tabs>
        </section>

        <section
          ref={resultsRef}
          aria-label="Results"
          className="min-w-0 scroll-mt-4 rounded-lg border border-border bg-card"
        >
          <div className="flex min-h-14 items-center border-b border-border px-4 py-2">
            <h2 className="text-sm font-semibold">Results</h2>
          </div>
          <div className="p-4">
            <QueryResults
              key={resultShapeKey(lastParams)}
              result={result}
              meta={meta}
              loading={loading}
              error={error}
              lastParams={lastParams}
              canExport={canExport}
              onPageChange={(newPage) => {
                if (lastParams) {
                  void handleRun({ ...lastParams, page: newPage });
                }
              }}
            />
          </div>
        </section>
      </div>
    </>
  );
}

/** Results keep the user's chart choice while paging, and reset for a different query. */
function resultShapeKey(params: AnalyticsQueryParams | undefined) {
  if (!params) return "none";
  const { page: _page, ...rest } = params;
  return JSON.stringify(rest);
}
