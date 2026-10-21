/**
 * Tenant data export contract (roadmap 2.9, backups). Mirrors the backend
 * export object in `src/docs/backend/frontend-api-contract.md` section 23.
 */

export type DataExportStatus = "queued" | "processing" | "completed" | "failed" | "expired";

export interface DataExport {
  exportId: string;
  tenantId: string;
  status: DataExportStatus;
  origin: "tenant" | "platform";
  requestedBy: {
    type: "user" | "admin";
    id: string | null;
    email: string | null;
    display: string | null;
  } | null;
  reason: string | null;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  summary: { collections: number; records: number; datasets: number; datasetRows: number } | null;
  collections?: Array<{ model: string; collection: string; count: number }>;
  error: { code: string | null; message: string | null } | null;
  downloadable: boolean;
}

/** POST .../download-url */
export interface DataExportDownloadLink {
  url: string;
  expiresAt: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
}

/** Statuses that are still being worked on (the UI polls while one exists). */
export const RUNNING_STATUSES: readonly DataExportStatus[] = ["queued", "processing"];

/** Error codes the export UI branches on. */
export const DATA_EXPORT_ERROR_CODES = {
  IN_PROGRESS: "EXPORT_IN_PROGRESS",
  RATE_LIMITED: "EXPORT_RATE_LIMITED",
  NOT_READY: "EXPORT_NOT_READY",
  EXPIRED: "EXPORT_EXPIRED",
  DOWNLOAD_FORBIDDEN: "EXPORT_DOWNLOAD_FORBIDDEN",
} as const;
