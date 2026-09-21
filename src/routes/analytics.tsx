import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { QueryBuilder } from "@/features/analytics/components/QueryBuilder";
import { QueryResults } from "@/features/analytics/components/QueryResults";
import { QueryHistory } from "@/features/analytics/components/QueryHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as analyticsApi from "@/features/analytics/api";
import * as connectorsApi from "@/features/datasets/api";
import type { AnalyticsQueryParams, AnalyticsResult } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";
import { ErrorState } from "@/components/common/states";

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
  const [activeTab, setActiveTab] = useState("query");

  const connectors = (connectorsQuery.data?.data ?? []) as import("@/lib/api/types").Connector[];

  if (!canView) {
    return <ErrorState error={{ statusCode: 403 }} resource="Analytics" />;
  }

  async function handleRun(params: AnalyticsQueryParams) {
    if (loading) return;
    setLoading(true);
    setError(null);
    setLastParams(params);
    setActiveTab("results");
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
    setActiveTab("results");
    void handleRun(params);
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Query and explore your data with filters, metrics, and grouping."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Analytics" }]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.5fr]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="xl:col-span-1">
          <TabsList>
            <TabsTrigger value="query">Builder</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="query" className="pt-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <QueryBuilder
                connectors={connectors}
                onRun={handleRun}
                loading={loading}
                initialParams={lastParams}
              />
            </div>
          </TabsContent>
          <TabsContent value="history" className="pt-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <QueryHistory onRerun={handleRerun} onView={handleRerun} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="xl:col-span-1">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 text-sm font-semibold">Results</h3>
            <QueryResults
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
        </div>
      </div>
    </>
  );
}
