import { request, requestPaged, type Query } from "@/lib/api/client";

export interface InsightCell {
  label?: string;
  value: number;
}

export interface Insight {
  _id: string;
  type: "period_change" | "top_movers" | "outlier";
  metricKey?: string | null;
  dashboardId?: string | null;
  window?: Record<string, unknown> | null;
  cells: Record<string, InsightCell>;
  facts: Record<string, unknown>;
  narration?: { claims: Array<{ text: string; cells: string[] }>; caveats: string[] } | null;
  status: "open" | "dismissed";
}

export const list = (query: Query = {}) => requestPaged<Insight>("/insights", { query });
export const dismiss = (id: string) =>
  request<Insight>(`/insights/${id}/dismiss`, { method: "POST", body: {} });
export const feedback = (id: string, rating: "up" | "down") =>
  request<Insight>(`/insights/${id}/feedback`, { method: "POST", body: { rating } });
