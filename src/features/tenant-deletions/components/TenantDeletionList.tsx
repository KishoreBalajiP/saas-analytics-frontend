import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cancelTenantDeletion } from "@/features/members/api";
import type { DeletionStatus } from "@/features/members/types";
import { DELETION_STATUSES, listTenantDeletions } from "@/features/tenant-deletions/api";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

/**
 * Platform-wide tenant deletion queue. Viewing needs `iam.tenants.view`;
 * cancelling a scheduled deletion needs `iam.tenants.restore`.
 */
export function TenantDeletionList() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.IAM_TENANTS_VIEW);
  const canCancel = hasPermission(permissions, Permissions.IAM_TENANTS_RESTORE);
  const client = useQueryClient();
  const [status, setStatus] = useState<DeletionStatus | "">("");
  const deletions = useQuery({
    queryKey: ["admin", "tenant-deletions", status],
    queryFn: () => listTenantDeletions(status ? { status } : {}),
    enabled: canView,
  });
  const cancel = useMutation<unknown, Error, string>({
    mutationFn: (tenantId) => cancelTenantDeletion(tenantId, "Cancelled from admin portal"),
    onSuccess: () => {
      toast.success("Deletion cancelled");
      void client.invalidateQueries({ queryKey: ["admin", "tenant-deletions"] });
    },
    onError: (error) => toast.error(error.message || "Unable to cancel deletion"),
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Tenant deletions" />;

  return (
    <div className="space-y-4">
      <select
        aria-label="Filter by status"
        className="h-9 rounded-md border bg-background px-3 text-sm"
        value={status}
        onChange={(event) => setStatus(event.target.value as DeletionStatus | "")}
      >
        <option value="">All statuses</option>
        {DELETION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {deletions.isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : deletions.isError ? (
        <ErrorState
          error={deletions.error}
          onRetry={() => deletions.refetch()}
          resource="Tenant deletions"
        />
      ) : !deletions.data?.data.length ? (
        <EmptyState title="No tenant deletions" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {deletions.data.data.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 p-5"
                  data-testid={`deletion-${item.id}`}
                >
                  <div>
                    <p className="font-medium">
                      {item.tenantName ?? item.tenantId}
                      {item.tenantSlug ? ` · ${item.tenantSlug}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Source {item.source} · requested {formatDate(item.requestedAt)} · purge after{" "}
                      {formatDate(item.purgeAfter)}
                    </p>
                    {item.lastError ? (
                      <p className="mt-1 text-sm text-destructive">{item.lastError.message}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
                      {item.status}
                    </span>
                    {item.status === "scheduled" && canCancel ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate(item.tenantId)}
                      >
                        Cancel deletion
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
