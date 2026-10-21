/** User-facing message for an API error, with a fallback. */
import { ApiError } from "@/lib/api/client";

export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.code === "STEP_UP_FAILED") return "Password or code is incorrect.";
    if (error.isRateLimited) return "Too many attempts. Please wait a moment and try again.";
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
