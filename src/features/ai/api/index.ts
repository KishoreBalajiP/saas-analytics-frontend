import { request } from "@/lib/api/client";

export interface AiStatus {
  available: boolean;
  killSwitch: boolean;
  enabled: boolean;
  consent: boolean;
  providerConfigured: boolean;
  /** Plan includes ai_assistant (server-authoritative). */
  entitled?: boolean;
  /** Why Ask is unavailable (first failing gate) and what to do about it. */
  reason?: string | null;
  action?: string | null;
}

export type AiChartType =
  "kpi" | "table" | "bar" | "line" | "area" | "pie" | "doughnut" | "scatter";

export interface AiVisualization {
  type: AiChartType;
  alternatives: AiChartType[];
  xField: string | null;
  xBucket: string | null;
  dimensions: string[];
  measures: string[];
}

export interface AiAnswer {
  id: string;
  outcome: "answered" | "clarify" | "unanswerable" | "failed";
  reason?: string;
  message?: string;
  missing?: string[];
  clarify?: { question: string; options: string[] };
  plan?: Record<string, unknown>;
  assumptions?: string[];
  checks?: string[];
  result?: { rows: Array<Record<string, unknown>>; columns: string[] };
  /** Server-recommended chart, derived from the actual result shape. */
  visualization?: AiVisualization;
  /** Datasets the planner saw: `truncated` when only the most relevant were searched. */
  scope?: { available: number; offered: number; truncated: boolean };
  /** Set when this answer followed up on an earlier question. */
  previousQuestionId?: string;
  provenance?: {
    datasetId: string;
    datasetName: string | null;
    window?: { field: string; from: string | null; to: string | null } | null;
    timezone?: string;
    rowCount: number;
    total: number;
    executedAt?: string;
  };
}

export const status = () => request<AiStatus>("/ai/status");
export const setConsent = (granted: boolean) =>
  request<{ granted: boolean }>("/ai/consent", { method: "PUT", body: { granted } });
export const ask = (question: string, previousQuestionId?: string) =>
  request<AiAnswer>("/ai/questions", {
    method: "POST",
    body: previousQuestionId ? { question, previousQuestionId } : { question },
  });
export const feedback = (id: string, rating: "up" | "down") =>
  request<unknown>(`/ai/questions/${id}/feedback`, { method: "POST", body: { rating } });
