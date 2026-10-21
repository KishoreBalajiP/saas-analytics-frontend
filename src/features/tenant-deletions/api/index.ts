import { requestPaged } from "@/lib/api/client";
import type { DeletionStatus, TenantDeletion } from "@/features/members/types";

export const DELETION_STATUSES: DeletionStatus[] = [
  "scheduled",
  "purging",
  "purged",
  "failed",
  "cancelled",
];

/** GET /admin/tenant-deletions (iam.tenants.view, platform admins). */
export function listTenantDeletions(
  query: { status?: DeletionStatus; tenantId?: string; page?: number; limit?: number } = {},
) {
  return requestPaged<TenantDeletion>("/admin/tenant-deletions", { audience: "admin", query });
}
