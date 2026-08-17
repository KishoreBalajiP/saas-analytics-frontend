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
import * as analyticsApi from "@/lib/api/analytics";
import type { AnalyticsQueryParams, AnalyticsResult } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface QueryResultsProps {
  result: AnalyticsResult | null;
  meta: Record<string, unknown> | null;
  loading?: boolean;
  error?: unknown;
  lastParams?: AnalyticsQueryParams | undefined;
  onPageChange?: (page: number) => void;
}

type ChartType = "bar" | "line" | "area" | "pie";

function formatTimestamp(value?: string) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

export function QueryResults({
  result,
  meta,
  loading,
  error,
  lastParams,
  onPageChange,
}: QueryResultsProps) {
  const [view, setView] = useState<"table" | "chart">("table");
  const [chartType, setChartType] = useState<ChartType>("bar");

  if (loading) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={5} cols={4} />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} resource="Analytics query" />;
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
      toast.success(`Export queued (${response.exportId})`);
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
        <div className="ml-auto flex items-center gap-2">
          <Select value={view} onValueChange={(v) => setView(v as "table" | "chart")}>
            <SelectTrigger className="h-7 w-20 text-xs" aria-label="View mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">Table</SelectItem>
              <SelectItem value="chart">Chart</SelectItem>
            </SelectContent>
          </Select>

          {view === "chart" && (
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="h-7 w-24 text-xs" aria-label="Chart type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="area">Area</SelectItem>
                <SelectItem value="pie">Pie</SelectItem>
              </SelectContent>
            </Select>
          )}

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
        </div>
      </div>

      {/* Results */}
      {view === "table" ? (
        <WidgetView type="table" result={result} />
      ) : (
        <WidgetView type={chartType} result={result} />
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
