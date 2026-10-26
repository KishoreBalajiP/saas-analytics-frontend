import { apiUrl, request, requestPaged, type Query } from "@/lib/api/client";
import type { Connector, ConnectorType, ConnectorTypeInfo, PreviewResult } from "@/lib/api/types";

export type SyncRunStatus =
  "queued" | "running" | "retrying" | "succeeded" | "failed" | "abandoned" | "cancelled";

export type SyncRunTrigger = "manual" | "webhook" | "recovery" | "schedule";

/** One connector sync (GET /connectors/:id/sync-runs). */
export interface SyncRun {
  id: string;
  connectorId: string;
  trigger: SyncRunTrigger;
  jobType?: string;
  status: SyncRunStatus;
  attempts: number;
  maxAttempts?: number | null;
  recoveryAttempt?: number;
  /** Run this automatic recovery replaced (trigger "recovery"). */
  recoveredFrom?: string | null;
  /** User who started the sync (null for webhook/recovery runs). */
  requestedBy?: string | null;
  filename?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  rows?: {
    received?: number;
    upserted?: number;
    matched?: number;
    skipped?: number;
    failed?: number;
  } | null;
  error?: { code?: string | null; message?: string | null } | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Response of the sync endpoints (202). */
export interface SyncAccepted {
  accepted: boolean;
  jobType?: string;
  filename?: string | null;
  /** Always false since sync conflicts answer 409 SYNC_IN_PROGRESS. */
  alreadyQueued?: boolean;
  syncRunId?: string;
  status?: SyncRunStatus;
}

export function listTypes() {
  return request<ConnectorTypeInfo[]>("/connectors/types");
}

export function list(query: Query = {}) {
  return requestPaged<Connector>("/connectors", { query });
}

export function get(connectorId: string) {
  return request<Connector>(`/connectors/${connectorId}`);
}

export function create(body: {
  type: ConnectorType;
  name: string;
  config: Record<string, unknown>;
  fieldMapping?: Record<string, string>;
}) {
  return request<Connector>("/connectors", { method: "POST", body });
}

export function update(
  connectorId: string,
  body: {
    name?: string;
    status?: string;
    config?: Record<string, unknown>;
    fieldMapping?: Record<string, string>;
    /** One-way upgrade of a legacy webhook to timestamp-bound signatures. */
    webhookSignatureVersion?: 2;
  },
) {
  return request<Connector>(`/connectors/${connectorId}`, { method: "PATCH", body });
}

export function remove(connectorId: string) {
  return request<unknown>(`/connectors/${connectorId}`, { method: "DELETE" });
}

export function validate(connectorId: string) {
  return request<{
    valid: boolean;
    errors?: Array<string | { field?: string; message?: string }>;
    connector?: Connector;
  }>(`/connectors/${connectorId}/validate`, { method: "POST" });
}

export function listRows(connectorId: string, query: Query = {}) {
  return requestPaged<Record<string, unknown>>(`/connectors/${connectorId}/rows`, { query });
}

export function previewFile(connectorId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<PreviewResult>(`/connectors/${connectorId}/preview`, {
    method: "POST",
    formData,
  });
}

/** Options for a CSV / XLSX upload (multipart fields). */
export interface FileImportOptions {
  hasHeader?: boolean;
  /** CSV only: one character; "\t" for tab. */
  delimiter?: string;
  /** XLSX only: the sheet NAME to read (default: the first sheet). */
  sheet?: string;
}

export interface FilePreview extends PreviewResult {
  type: "csv" | "xlsx";
  filename: string | null;
}

function fileForm(file: File, fields: Record<string, string | boolean | undefined>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== "") formData.append(key, String(value));
  }
  formData.append("file", file);
  return formData;
}

/** Preview a CSV / XLSX before any dataset exists (nothing is stored). */
export function previewNewFile(file: File, options: FileImportOptions = {}) {
  return request<FilePreview>("/connectors/file-preview", {
    method: "POST",
    formData: fileForm(file, { ...options }),
  });
}

/**
 * Create a named dataset from a CSV / XLSX upload and queue its import
 * (202). The dataset is ready once its sync succeeds.
 */
export function importFile(file: File, body: { name: string } & FileImportOptions) {
  return request<{ connector: Connector; sync: SyncAccepted }>("/connectors/import", {
    method: "POST",
    formData: fileForm(file, { ...body }),
  });
}

export function syncFile(connectorId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<SyncAccepted>(`/connectors/${connectorId}/sync`, { method: "POST", formData });
}

export function syncMongoDB(connectorId: string) {
  return request<SyncAccepted>(`/connectors/${connectorId}/sync-mongodb`, {
    method: "POST",
    body: {},
  });
}

/** Sync history for one connector, newest first (connectors.view). */
export function listSyncRuns(connectorId: string, query: Query = {}) {
  return requestPaged<SyncRun>(`/connectors/${connectorId}/sync-runs`, { query });
}

/** Absolute public URL senders POST webhook deliveries to. */
export function webhookIngestUrl(webhookToken: string) {
  return apiUrl(`/webhooks/${encodeURIComponent(webhookToken)}`);
}

// datasets: typed dataset schema (GET /connectors/:id/schema).
export type DatasetFieldType = "string" | "number" | "integer" | "boolean" | "date" | "datetime";

export interface DatasetField {
  name: string;
  type: DatasetFieldType;
  nullable: boolean;
  nullRate: number;
  distinctEstimate: number;
  personal: boolean;
  displayName: string | null;
  sample: unknown[];
}

export interface DatasetSchema {
  connectorId: string;
  version: number;
  profiledAt: string;
  fields: DatasetField[];
  dateField: string | null;
  keyField: string | null;
}

export function getSchema(connectorId: string) {
  return request<DatasetSchema | null>(`/connectors/${connectorId}/schema`);
}

// datasets: re-profile a dataset's schema (POST /connectors/:id/schema/refresh).
export function refreshSchema(connectorId: string) {
  return request<DatasetSchema | null>(`/connectors/${connectorId}/schema/refresh`, {
    method: "POST",
  });
}

/** MongoDB source discovery (GET /connectors/:id/discover). */
export interface MongoDiscovery {
  databases: string[];
  /** False when the user lacks listDatabases; only the configured DB is shown. */
  databasesListed: boolean;
  database: string | null;
  collections: { name: string; type: "collection" | "view" }[];
}

export function discoverMongo(connectorId: string, database?: string) {
  const qs = database ? `?database=${encodeURIComponent(database)}` : "";
  return request<MongoDiscovery>(`/connectors/${connectorId}/discover${qs}`);
}
