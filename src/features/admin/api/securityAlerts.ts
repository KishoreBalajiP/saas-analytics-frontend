/**
 * Platform security alerts (roadmap 2.6): `/admin/security-alerts`.
 *
 * Alerts are raised by the backend detector job from versioned detection
 * rules. Admins with `security.alerts.view` list and inspect them; admins
 * with `security.alerts.update` acknowledge, mark false positives and
 * resolve them (closing needs a note).
 */
import { request, requestPaged, type Query } from "@/lib/api/client";
import type { Paged } from "@/lib/api/types";

const audience = "admin" as const;
const BASE = "/admin/security-alerts";

export type SecurityAlertStatus = "open" | "acknowledged" | "false_positive" | "resolved";
export type SecurityAlertSeverity = "low" | "medium" | "high" | "critical";

export const SECURITY_ALERT_STATUSES: SecurityAlertStatus[] = [
  "open",
  "acknowledged",
  "false_positive",
  "resolved",
];
export const SECURITY_ALERT_SEVERITIES: SecurityAlertSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export interface SecurityAlertActor {
  id: string | null;
  display: string | null;
}

export interface SecurityAlertEvidenceRef {
  source: string;
  id: string | null;
  at: string | null;
  label: string;
}

export interface SecurityAlertHistoryEntry {
  at: string | null;
  action: string;
  by: SecurityAlertActor | null;
  from: string | null;
  to: string | null;
  note: string | null;
}

export interface SecurityAlertNotification {
  at: string | null;
  channel: string;
  target: string | null;
  status: string;
  code: string | null;
}

export interface SecurityAlert {
  id: string;
  ruleId: string;
  ruleVersion: number;
  title: string;
  summary: string;
  severity: SecurityAlertSeverity;
  status: SecurityAlertStatus;
  subject: { type: string | null; id: string | null; display: string | null };
  tenantId: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  occurrences: number;
  counts: Record<string, number> | null;
  owner: SecurityAlertActor | null;
  acknowledgedAt: string | null;
  acknowledgedBy: SecurityAlertActor | null;
  closedAt: string | null;
  closedBy: SecurityAlertActor | null;
  resolutionNote: string | null;
  notifiedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SecurityAlertDetail extends SecurityAlert {
  evidence: {
    counts: Record<string, number> | null;
    details: Record<string, unknown> | null;
    refs: SecurityAlertEvidenceRef[];
  };
  history: SecurityAlertHistoryEntry[];
  notifications: SecurityAlertNotification[];
}

export type SecurityAlertStatusCounts = Record<SecurityAlertStatus, number>;

export interface SecurityAlertFilters {
  status?: string | undefined;
  severity?: string | undefined;
  ruleId?: string | undefined;
  tenantId?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface DetectionRule {
  id: string;
  version: number;
  title: string;
  description: string;
  source: string;
  severity: SecurityAlertSeverity;
  enabled: boolean;
  config: Record<string, unknown>;
  defaults: Record<string, unknown>;
  ignoredOverrides: Array<{ origin: string; param: string; reason: string }>;
  watermark: string | null;
  lastRunAt: string | null;
  lastDetections: number;
  lastError: string | null;
}

export type SecurityAlertAction = "acknowledge" | "false-positive" | "resolve";

function clean(filters: SecurityAlertFilters): Query {
  const query: Query = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") query[key] = value;
  }
  return query;
}

export function listSecurityAlerts(
  filters: SecurityAlertFilters = {},
): Promise<Paged<SecurityAlert>> {
  return requestPaged<SecurityAlert>(BASE, { audience, query: clean(filters) });
}

export function getSecurityAlert(id: string) {
  return request<SecurityAlertDetail>(`${BASE}/${encodeURIComponent(id)}`, { audience });
}

export function listDetectionRules() {
  return request<DetectionRule[]>(`${BASE}/rules`, { audience });
}

export function triageSecurityAlert(id: string, action: SecurityAlertAction, note?: string) {
  const body = note && note.trim() ? { note: note.trim() } : {};
  return request<SecurityAlertDetail>(`${BASE}/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    audience,
    body,
  });
}

/** Status counts carried in the list meta (zeros when absent). */
export function statusCountsOf(
  meta: Record<string, unknown> | undefined,
): SecurityAlertStatusCounts {
  const raw = (meta?.["statusCounts"] ?? {}) as Partial<SecurityAlertStatusCounts>;
  return {
    open: Number(raw.open ?? 0),
    acknowledged: Number(raw.acknowledged ?? 0),
    false_positive: Number(raw.false_positive ?? 0),
    resolved: Number(raw.resolved ?? 0),
  };
}
