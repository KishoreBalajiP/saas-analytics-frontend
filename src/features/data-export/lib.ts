import { ApiError } from "@/lib/api/client";

import { DATA_EXPORT_ERROR_CODES, RUNNING_STATUSES, type DataExport } from "./types";

/** Human size: 1.2 MB. */
export function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function statusLabel(status: DataExport["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "processing":
      return "Preparing";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

export function isRunning(row: Pick<DataExport, "status">) {
  return RUNNING_STATUSES.includes(row.status);
}

/** Poll every few seconds while an export is being prepared. */
export function pollInterval(rows: Array<Pick<DataExport, "status">> | undefined) {
  return rows?.some(isRunning) ? 5000 : false;
}

/** A clear message for the export-specific error codes. */
export function exportErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }
  switch (error.code) {
    case DATA_EXPORT_ERROR_CODES.IN_PROGRESS:
      return "An export is already being prepared. Wait for it to finish.";
    case DATA_EXPORT_ERROR_CODES.RATE_LIMITED:
      return "The daily export limit was reached. Try again tomorrow.";
    case DATA_EXPORT_ERROR_CODES.NOT_READY:
      return "This export is not ready yet.";
    case DATA_EXPORT_ERROR_CODES.EXPIRED:
      return "This export has expired. Request a new one.";
    case DATA_EXPORT_ERROR_CODES.DOWNLOAD_FORBIDDEN:
      return "This export was prepared by platform support and cannot be downloaded here.";
    default:
      return error.message;
  }
}

/**
 * Start a browser download of a short-lived link (the response is
 * `Content-Disposition: attachment`, so the page stays where it is).
 */
export function startDownload(url: string) {
  window.location.assign(url);
}
