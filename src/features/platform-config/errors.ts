/**
 * User-facing messages for failed platform configuration writes.
 */

/** Human message for a failed configuration write. */
export function configErrorMessage(error: unknown): string {
  const err = error as { statusCode?: number; code?: string; message?: string } | null;
  if (err?.code === "VERSION_CONFLICT") {
    return "Someone else changed this in the meantime. Reload to see the latest version, then try again.";
  }
  if (err?.code === "SECRET_PERMISSION_REQUIRED") {
    return "Changing a secret setting needs the settings.secrets.update permission.";
  }
  if (err?.statusCode === 403) return err.message ?? "You do not have permission to do this.";
  return err?.message ?? "The change could not be saved.";
}
