import { useQuery } from "@tanstack/react-query";
import { RotateCw, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { DataTable, type Column } from "@/components/common/DataTable";
import * as analyticsApi from "@/features/analytics/api";
import type { AnalyticsQueryParams, AnalyticsQueryRecord, PaginationMeta } from "@/lib/api/types";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-success/15 text-success",
  running: "bg-primary/15 text-primary",
  failed: "bg-destructive/15 text-destructive",
  pending: "bg-warning/15 text-warning",
};

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function QueryHistory({
  onRerun,
  onView,
}: {
  onRerun?: (params: AnalyticsQueryParams) => void;
  onView?: (params: AnalyticsQueryParams) => void;
}) {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["analytics", "queries", { page }],
    queryFn: () => analyticsApi.listQueries({ page, limit: 20 }),
  });

  if (query.isLoading) return <TableSkeleton rows={5} cols={4} />;

  if (query.isError) {
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Query history" />
    );
  }

  const rows = (query.data?.data ?? []) as AnalyticsQueryRecord[];
  const meta = query.data?.meta as PaginationMeta | undefined;

  if (!rows.length) {
    return <EmptyState title="No query history" description="Run a query to see it appear here." />;
  }

  function extractParams(record: AnalyticsQueryRecord): AnalyticsQueryParams {
    if (record.params && typeof record.params === "object") {
      return record.params as AnalyticsQueryParams;
    }
    return {};
  }

  const columns: Column<AnalyticsQueryRecord>[] = [
    {
      key: "createdAt",
      header: "Time",
      render: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge className={STATUS_COLORS[row.status ?? "pending"] ?? ""}>
          {row.status ?? "unknown"}
        </Badge>
      ),
    },
    {
      key: "params",
      header: "Query",
      render: (row) => {
        const params = extractParams(row);
        const connectors = params.connectorIds?.length ? params.connectorIds.length : 0;
        const metricCount = params.metrics?.length ?? 0;
        const filterCount = params.filters?.length ?? 0;
        return (
          <span className="text-xs text-muted-foreground">
            {connectors} connector{connectors !== 1 ? "s" : ""}, {metricCount} metric
            {metricCount !== 1 ? "s" : ""}, {filterCount} filter{filterCount !== 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          {onView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(extractParams(row))}
              aria-label="View query"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          {onRerun && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRerun(extractParams(row))}
              aria-label="Re-run query"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable<AnalyticsQueryRecord>
      columns={columns}
      data={rows}
      meta={meta}
      onPageChange={setPage}
      getRowId={(row) => row._id}
    />
  );
}
