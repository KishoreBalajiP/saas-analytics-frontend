import { requestFull, request, requestPaged, type Query } from "@/lib/api/client";
import type {
  AnalyticsExport,
  AnalyticsQueryParams,
  AnalyticsQueryRecord,
  ArtifactDownload,
  AnalyticsResult,
  QueryDateRange,
  QueryWindow,
} from "@/lib/api/types";

/** Drop empty bounds; `undefined` when the range selects nothing. */
function compactDateRange(range: QueryDateRange | undefined): QueryDateRange | undefined {
  if (!range) return undefined;
  const out: QueryDateRange = { field: range.field };
  if (range.preset) out.preset = range.preset;
  if (range.from) out.from = range.from;
  if (range.to) out.to = range.to;
  return out.preset || out.from || out.to ? out : undefined;
}

/**
 * Contract: complex params travel as JSON strings on the query string. The
 * API rejects unknown or invalid parts with 400 INVALID_QUERY and field
 * errors, so only known keys are ever sent.
 */
export function serializeQueryParams(params: AnalyticsQueryParams): Query {
  const query: Query = {};
  if (params.connectorIds?.length) query["connectorIds"] = params.connectorIds.join(",");
  if (params.filters?.length) query["filters"] = JSON.stringify(params.filters);
  if (params.filtersOp) query["filtersOp"] = params.filtersOp;
  const dateRange = compactDateRange(params.dateRange);
  if (dateRange) query["dateRange"] = JSON.stringify(dateRange);
  if (params.metrics?.length) query["metrics"] = JSON.stringify(params.metrics);
  if (params.groupBy?.length) query["groupBy"] = JSON.stringify(params.groupBy);
  if (params.orderBy?.length) query["orderBy"] = JSON.stringify(params.orderBy);
  if (params.page) query["page"] = params.page;
  if (params.limit) query["limit"] = params.limit;
  return query;
}

export interface AnalyticsRunResult {
  result: AnalyticsResult;
  meta: Record<string, unknown>;
}

/**
 * GET /analytics returns the rows as the envelope's `data` array and the
 * totals, columns and pagination in `meta`. Build the AnalyticsResult the
 * UI renders from both (an object-shaped `data` is accepted for safety).
 */
export async function runQuery(params: AnalyticsQueryParams): Promise<AnalyticsRunResult> {
  const payload = await requestFull<AnalyticsResult | Array<Record<string, unknown>>>(
    "/analytics",
    {
      query: serializeQueryParams(params),
    },
  );
  const meta = (payload.meta ?? {}) as Record<string, unknown>;
  const data = payload.data;
  if (data && !Array.isArray(data) && Array.isArray((data as AnalyticsResult).rows)) {
    return { result: data as AnalyticsResult, meta };
  }
  const rows = Array.isArray(data) ? data : [];
  const groupMode = meta["groupMode"];
  const result: AnalyticsResult = {
    rows,
    total: typeof meta["total"] === "number" ? (meta["total"] as number) : rows.length,
    page: typeof meta["page"] === "number" ? (meta["page"] as number) : 1,
    pages: typeof meta["pages"] === "number" ? (meta["pages"] as number) : 1,
    limit: typeof meta["limit"] === "number" ? (meta["limit"] as number) : rows.length,
    groupMode: groupMode === true || groupMode === "grouped" ? "grouped" : "raw",
  };
  if (Array.isArray(meta["columns"])) result.columns = meta["columns"] as string[];
  if (typeof meta["executedAt"] === "string") result.executedAt = meta["executedAt"];
  if (typeof meta["timezone"] === "string") result.timezone = meta["timezone"];
  if (meta["window"] && typeof meta["window"] === "object")
    result.window = meta["window"] as QueryWindow;
  return { result, meta };
}

export function listQueries(query: Query = {}) {
  return requestPaged<AnalyticsQueryRecord>("/analytics/queries", { query });
}

export function getQuery(id: string) {
  return request<AnalyticsQueryRecord>(`/analytics/queries/${id}`);
}

export interface ExportQueued {
  exportId: string;
  jobId?: string;
  accepted: boolean;
  queued?: boolean;
  status: AnalyticsExport["status"];
  format: AnalyticsExport["format"];
}

/**
 * Queue an async export of the WHOLE result (page/limit are never sent:
 * the API refuses pagination on exports). Poll `getExport` until `ready`.
 */
export function exportQuery(params: AnalyticsQueryParams, format: "json" | "csv" | "xlsx") {
  const { page: _page, limit: _limit, dateRange, ...rest } = params;
  const range = compactDateRange(dateRange);
  return request<ExportQueued>("/analytics/export", {
    method: "POST",
    body: { ...rest, ...(range ? { dateRange: range } : {}), format },
  });
}

/** Status of one of the caller's exports. */
export function getExport(exportId: string) {
  return request<AnalyticsExport>(`/analytics/exports/${exportId}`);
}

/** Short-lived signed link to a ready export (409 EXPORT_NOT_READY before). */
export function downloadExport(exportId: string) {
  return request<ArtifactDownload & { exportId: string }>(
    `/analytics/exports/${exportId}/download`,
  );
}
