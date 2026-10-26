import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { WidgetView } from "@/components/common/WidgetView";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as analyticsApi from "@/features/analytics/api";
import { ExportStatus } from "@/features/analytics/components/ExportStatus";
import {
  chartTypesFor,
  recommendChartType,
  WIDGET_TYPE_LABELS,
} from "@/features/dashboards/chartRecommendation";
import { AddToDashboardButton } from "@/features/dashboards/components/AddToDashboardDialog";
import { ApiError } from "@/lib/api/client";
import type {
  AnalyticsQueryParams,
  AnalyticsResult,
  QueryWindow,
  WidgetType,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface QueryResultsProps {
  result: AnalyticsResult | null;
  meta: Record<string, unknown> | null;
  loading?: boolean;
  error?: unknown;
  lastParams?: AnalyticsQueryParams | undefined;
  onPageChange?: (page: number) => void;
  canExport?: boolean;
}

type ChartType = Exclude<WidgetType, "table">;

function formatTimestamp(value?: string) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

/** "2026-01-01 – 2026-01-31 on order_date (Asia/Kolkata)" in the workspace zone. */
function describeWindow(window: QueryWindow, timezone?: string) {
  const day = (iso: string | null) => {
    if (!iso) return "…";
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC" }).format(
        new Date(iso),
      );
    } catch {
      return iso.slice(0, 10);
    }
  };
  return `${day(window.from)} – ${day(window.to)} on ${window.field}`;
}

/** A rejected query (400) lists every field error; the concurrency limit (429) says why. */
function QueryError({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.statusCode === 400 && error.errors?.length) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-card p-6" role="alert">
        <h3 className="text-base font-semibold">Query rejected</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Fix these parts of the query and run it again:
        </p>
        <ul className="mt-3 space-y-1 text-sm text-destructive">
          {error.errors.map((fieldError) => (
            <li key={`${fieldError.field}-${fieldError.message}`}>
              <span className="font-mono text-xs">{fieldError.field}</span>: {fieldError.message}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (error instanceof ApiError && error.code === "QUERY_CONCURRENCY_LIMIT") {
    return (
      <div className="rounded-xl border border-border bg-card p-6" role="alert">
        <h3 className="text-base font-semibold">Too many queries running</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your workspace already has the maximum number of analytics queries running. Wait a moment
          and run the query again.
        </p>
      </div>
    );
  }
  return <ErrorState error={error} resource="Analytics query" />;
}

export function QueryResults({
  result,
  meta,
  loading,
  error,
  lastParams,
  onPageChange,
  canExport = false,
}: QueryResultsProps) {
  // null = follow the recommendation for the current result; set once the user picks.
  const [chosenView, setView] = useState<"table" | "chart" | null>(null);
  const [chosenChart, setChartType] = useState<ChartType | null>(null);
  const chartTypes = chartTypesFor(lastParams);
  const recommended = recommendChartType(lastParams, result?.rows ?? []);
  const chartType: ChartType | null =
    chosenChart && chartTypes.includes(chosenChart)
      ? chosenChart
      : (chartTypes.find((t) => t === recommended) ?? chartTypes[0] ?? null);
  const view =
    chartType === null ? "table" : (chosenView ?? (recommended === "table" ? "table" : "chart"));
  // The export being tracked (status polled until ready, then downloadable).
  const [exportId, setExportId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={5} cols={4} />
      </div>
    );
  }

  if (error) {
    return <QueryError error={error} />;
  }

  if (!result) {
    return (
      <EmptyState
        title="No results yet"
        description="Configure your query parameters and click Run to see results."
      />
    );
  }

  const rows = result.rows ?? [];
  if (!rows.length) {
    return (
      <EmptyState
        title="No data matched"
        description="The query executed successfully but returned no rows. Try adjusting your filters or date range."
      />
    );
  }

  async function handleExport(format: "json" | "csv" | "xlsx") {
    if (!lastParams) return;
    try {
      const response = await analyticsApi.exportQuery(lastParams, format);
      setExportId(response.exportId);
      toast.success(`${format.toUpperCase()} export queued`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  const page = (meta?.["page"] as number) ?? result.page ?? 1;
  const pages = (meta?.["pages"] as number) ?? result.pages ?? 1;
  const total = (meta?.["total"] as number) ?? result.total ?? rows.length;
  const cached = (meta?.["cached"] as boolean) ?? false;
  const executedAt = (meta?.["executedAt"] as string) ?? result.executedAt;

  return (
    <div className="space-y-4">
      {/* Meta bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          {total.toLocaleString()} row{total !== 1 ? "s" : ""}
        </span>
        {result.groupMode && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">
            {result.groupMode}
          </span>
        )}
        {cached && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-accent-foreground">cached</span>
        )}
        {executedAt && <span>Executed {formatTimestamp(executedAt)}</span>}
        {result.window && <span>{describeWindow(result.window, result.timezone)}</span>}
        {result.timezone && <span>Time zone {result.timezone}</span>}
        <div className="ml-auto flex items-center gap-2">
          {chartType ? (
            <Select value={view} onValueChange={(v) => setView(v as "table" | "chart")}>
              <SelectTrigger className="h-7 w-20 text-xs" aria-label="View mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="chart">Chart</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span title="Add a metric (and a Group by for charts) to visualize this result">
              Table only
            </span>
          )}

          {view === "chart" && chartType && (
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="h-7 w-24 text-xs" aria-label="Chart type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chartTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {WIDGET_TYPE_LABELS[t]}
                    {t === recommended ? " ★" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {lastParams ? (
            <AddToDashboardButton
              query={lastParams}
              datasetId={lastParams.connectorIds?.length === 1 ? lastParams.connectorIds[0]! : ""}
              rows={rows}
              defaultTitle="Analytics result"
              {...(view === "chart" && chartType ? { defaultType: chartType } : {})}
            />
          ) : null}

          {canExport && (
            <Select onValueChange={(v) => handleExport(v as "json" | "csv" | "xlsx")}>
              <SelectTrigger className="h-7 w-20 text-xs" aria-label="Export format">
                <Download className="h-3 w-3" />
                <SelectValue placeholder="Export" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">XLSX</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {exportId ? (
        <ExportStatus key={exportId} exportId={exportId} onDismiss={() => setExportId(null)} />
      ) : null}

      {/* Results */}
      {view === "chart" && chartType ? (
        <WidgetView type={chartType} result={result} />
      ) : (
        <WidgetView type="table" result={result} />
      )}

      {/* Pagination */}
      {pages > 1 && onPageChange && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
