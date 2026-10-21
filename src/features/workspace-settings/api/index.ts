import { request } from "@/lib/api/client";
import type { WorkspaceSettings } from "@/lib/api/types";

/** TanStack Query key for the workspace settings. */
export const workspaceSettingsKey = ["workspace", "settings"] as const;

/** GET /workspace/settings (requires `settings.view`). */
export function get() {
  return request<WorkspaceSettings>("/workspace/settings");
}

/**
 * PATCH /workspace/settings (requires `settings.update`). An invalid time zone
 * is a 400 with a field error on `timezone`.
 */
export function update(body: Partial<WorkspaceSettings>) {
  return request<WorkspaceSettings>("/workspace/settings", { method: "PATCH", body });
}
