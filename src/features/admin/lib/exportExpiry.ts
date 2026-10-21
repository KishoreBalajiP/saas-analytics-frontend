import { ApiError } from "@/lib/api/client";

/**
 * True for the API's "this export's download window has passed" answer
 * (410 `EXPORT_EXPIRED`; the file was deleted by the retention job).
 */
export function isExportExpiredError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "EXPORT_EXPIRED" || error.statusCode === 410);
}
