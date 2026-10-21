import { request } from "@/lib/api/client";

export interface AiStatus {
  available: boolean;
  killSwitch: boolean;
  enabled: boolean;
  consent: boolean;
  providerConfigured: boolean;
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
export const ask = (question: string) =>
  request<AiAnswer>("/ai/questions", { method: "POST", body: { question } });
export const feedback = (id: string, rating: "up" | "down") =>
  request<unknown>(`/ai/questions/${id}/feedback`, { method: "POST", body: { rating } });
