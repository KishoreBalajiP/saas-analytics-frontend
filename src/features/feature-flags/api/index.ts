import { request } from "@/lib/api/client";

/** Flags that are ON for the caller's workspace (missing key = off). */
export interface WorkspaceFlags {
  flags: Record<string, boolean>;
  features?: Array<{
    key: string;
    name: string;
    description: string;
    value: boolean;
    reason: string;
    planIncluded?: boolean | null;
    canAdminEnable?: boolean;
    configurationRequired?: boolean;
    implemented?: boolean;
    operational?: boolean;
  }>;
}

/** TanStack Query key for the workspace's evaluated flags. */
export const workspaceFlagsKey = ["workspace", "feature-flags"] as const;

/**
 * GET /feature-flags/evaluate (tenant audience, requires `feature_flags.view`).
 * The backend evaluates every enabled flag for the session's workspace only.
 */
export function evaluate() {
  return request<WorkspaceFlags>("/feature-flags/evaluate");
}
