/**
 * rls: dataset grants, row-level security rules, user attributes and
 * preview-as-user (`/data-access`, `data_access.view|configure`).
 */
import { request } from "@/lib/api/client";

export type GrantLevel = "view" | "query" | "manage";
export interface DatasetGrant {
  subjectType: "user" | "role";
  subjectId: string;
  level: GrantLevel;
}
export interface RowPolicy {
  id: string;
  connectorId: string;
  field: string;
  op: "eq" | "in";
  attribute: string;
  enabled: boolean;
}
export interface DatasetAccess {
  connectorId: string;
  restricted: boolean;
  grants: DatasetGrant[];
  policies: RowPolicy[];
}
export interface PreviewResult {
  rows: Record<string, unknown>[];
  total: number;
  scope: { bypass: boolean; deniedDatasets: string[]; rowRules: number };
}

export const datasetAccessKey = (connectorId: string) => ["data-access", connectorId] as const;

export function getDatasetAccess(connectorId: string) {
  return request<DatasetAccess>(`/data-access/datasets/${connectorId}`);
}

export function setDatasetAccess(
  connectorId: string,
  body: { restricted: boolean; grants: DatasetGrant[] },
) {
  return request<DatasetAccess>(`/data-access/datasets/${connectorId}`, { method: "PUT", body });
}

export function addRowPolicy(
  connectorId: string,
  body: { field: string; op: "eq" | "in"; attribute: string },
) {
  return request<RowPolicy>(`/data-access/datasets/${connectorId}/policies`, {
    method: "POST",
    body,
  });
}

export function removeRowPolicy(policyId: string) {
  return request<{ id: string; deleted: boolean }>(`/data-access/policies/${policyId}`, {
    method: "DELETE",
  });
}

export function getUserAttributes(userId: string) {
  return request<{ userId: string; attributes: Record<string, string | string[]> }>(
    `/data-access/users/${userId}/attributes`,
  );
}

export function setUserAttributes(userId: string, attributes: Record<string, string | string[]>) {
  return request<{ userId: string; attributes: Record<string, string | string[]> }>(
    `/data-access/users/${userId}/attributes`,
    { method: "PUT", body: { attributes } },
  );
}

export function previewAsUser(userId: string, connectorId: string) {
  return request<PreviewResult>("/data-access/preview", {
    method: "POST",
    body: { userId, query: { connectorIds: [connectorId] } },
  });
}

/** Parse `key=value` lines (comma-separated values become a list). */
export function parseAttributes(text: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const line of text.split("\n")) {
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const values = line
      .slice(at + 1)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!key || !values.length) continue;
    out[key] = values.length === 1 ? (values[0] as string) : values;
  }
  return out;
}
