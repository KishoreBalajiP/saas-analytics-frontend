import { ApiError } from "@/lib/api/client";
import { getQuotaDetails, quotaMessage } from "@/lib/api/quota";
import type { ConnectorType } from "@/lib/api/types";
import {
  SYNC_IN_PROGRESS_MESSAGE,
  SYNC_QUEUE_UNAVAILABLE_MESSAGE,
  syncSlotError,
} from "@/features/datasets/sync";

export interface DescribedError {
  title: string;
  description: string;
}

const ACCEPTED: Partial<Record<ConnectorType, string>> = {
  csv: ".csv or .txt",
  xlsx: ".xlsx",
};

export interface DescribeUploadErrorOptions {
  /** Which upload request failed. Only a sync can be refused by the sync slot. */
  action?: "preview" | "sync";
}

/**
 * Turn an upload (preview / sync) failure into a clear, actionable message.
 * The backend answers oversize files with 413 FILE_TOO_LARGE and wrong file
 * types with 415 UNSUPPORTED_FILE_TYPE / FILE_TYPE_MISMATCH; its messages
 * already name the limit, so they are kept as the description.
 */
export function describeUploadError(
  error: unknown,
  connectorType?: ConnectorType,
  { action }: DescribeUploadErrorOptions = {},
): DescribedError {
  const accepted = connectorType ? ACCEPTED[connectorType] : undefined;
  // A sync refused because another sync holds the dataset (409
  // SYNC_IN_PROGRESS) or the queue is down (503 QUEUE_*): nothing is wrong
  // with the file itself. Those codes are unambiguous; a code-less 409 / 503
  // (e.g. a gateway 503 with an HTML body) only means the sync slot when the
  // request was a sync, so a failed preview still reads "Upload failed".
  const coded = error instanceof ApiError && Boolean(error.code);
  const slot = coded || action === "sync" ? syncSlotError(error) : null;
  if (slot === "in_progress") {
    return { title: "Sync already running", description: SYNC_IN_PROGRESS_MESSAGE };
  }
  if (slot === "queue_unavailable") {
    return { title: "Sync service unavailable", description: SYNC_QUEUE_UNAVAILABLE_MESSAGE };
  }
  // The workspace is at (or over) its stored-rows plan limit: the shared
  // plan-limit sentence names the metric, the limit and current use.
  const quota = getQuotaDetails(error);
  if (quota) return { title: "Plan limit reached", description: quotaMessage(quota) };
  if (error instanceof ApiError) {
    if (error.statusCode === 413 || error.code === "FILE_TOO_LARGE") {
      if (error.code === "ROW_LIMIT_EXCEEDED" || error.code === "XLSX_TOO_MANY_COLUMNS") {
        return { title: "File has too much data", description: error.message };
      }
      return {
        title: "File too large",
        description: `${error.message} Split the file or remove unused rows and columns, then upload it again.`,
      };
    }
    if (
      error.statusCode === 415 ||
      error.code === "UNSUPPORTED_FILE_TYPE" ||
      error.code === "FILE_TYPE_MISMATCH"
    ) {
      const hint = accepted ? ` This connector accepts ${accepted} files.` : "";
      return {
        title:
          error.code === "FILE_TYPE_MISMATCH"
            ? "File type does not match"
            : "Unsupported file type",
        description: `${error.message}${hint}`.trim(),
      };
    }
    if (error.code === "FILE_PARSE_FAILED") {
      return { title: "File could not be read", description: error.message };
    }
    if (error.code === "TENANT_NOT_ACTIVE") {
      return { title: "Workspace not active", description: error.message };
    }
    if (error.code === "CONNECTOR_PAUSED") {
      return { title: "Connector paused", description: error.message };
    }
    return { title: "Upload failed", description: error.message };
  }
  return {
    title: "Upload failed",
    description: error instanceof Error ? error.message : "Something went wrong. Try again.",
  };
}

/** Backend validation errors are `{ field, message }` objects; render them as text. */
export function formatValidationErrors(
  errors?: Array<string | { field?: string; message?: string }>,
): string {
  if (!errors || errors.length === 0) return "unknown error";
  return errors
    .map((e) => (typeof e === "string" ? e : (e?.message ?? e?.field ?? "invalid")))
    .join(", ");
}
