import { requestFull, request, requestPaged, type Query } from "./client";
import type { AnalyticsQueryParams, AnalyticsQueryRecord, AnalyticsResult } from "./types";

/** Contract: complex params travel as JSON strings on the query string. */
export function serializeQueryParams(params: AnalyticsQueryParams): Query {
  const query: Query = {};
  if (params.connectorIds?.length) query["connectorIds"] = params.connectorIds.join(",");
  if (params.filters?.length) query["filters"] = JSON.stringify(params.filters);
  if (params.filtersOp) query["filtersOp"] = params.filtersOp;
  if (params.dateRange && (params.dateRange.from || params.dateRange.to))
    query["dateRange"] = JSON.stringify(params.dateRange);
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

export async function runQuery(params: AnalyticsQueryParams): Promise<AnalyticsRunResult> {
  const payload = await requestFull<AnalyticsResult>("/analytics", {
    query: serializeQueryParams(params),
  });
  return { result: payload.data, meta: payload.meta ?? {} };
}

export function listQueries(query: Query = {}) {
  return requestPaged<AnalyticsQueryRecord>("/analytics/queries", { query });
}

export function getQuery(id: string) {
  return request<AnalyticsQueryRecord>(`/analytics/queries/${id}`);
}

export function exportQuery(params: AnalyticsQueryParams, format: "json" | "csv" | "xlsx") {
  const { page: _page, limit: _limit, ...rest } = params;
  return request<{ accepted: boolean; exportId: string; status: string }>("/analytics/export", {
    method: "POST",
    body: { ...rest, format },
  });
}
