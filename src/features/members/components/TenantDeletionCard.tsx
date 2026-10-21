import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, InlineFieldErrors, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as membersApi from "@/features/members/api";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

/**
 * Platform-admin view of a workspace's deletion: status, grace period, the
 * purge verification report, and cancelling a scheduled deletion.
 */
export function TenantDeletionCard({ tenantId }: { tenantId: string }) {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.IAM_TENANTS_VIEW);
  const canCancel = hasPermission(permissions, Permissions.IAM_TENANTS_RESTORE);
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const key = ["admin", "tenants", tenantId, "deletion"];
  const query = useQuery({
    queryKey: key,
    queryFn: () => membersApi.getTenantDeletion(tenantId),
    enabled: canView,
  });
  const cancel = useMutation({
    mutationFn: () => membersApi.cancelTenantDeletion(tenantId, reason.trim()),
    onSuccess: (result) => {
      toast.success(
        result.reopened ? "Deletion cancelled; the workspace is open again" : "Deletion cancelled",
      );
      setReason("");
      void client.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
    onError: setError,
  });

  if (!canView) return null;
  if (query.isLoading) return <TableSkeleton rows={2} cols={2} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Deletion" />;
  const deletion = query.data ?? null;
  if (!deletion) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Workspace deletion
          <Badge
            variant={deletion.status === "purged" ? "secondary" : "destructive"}
            className="capitalize"
          >
            {deletion.status}
          </Badge>
        </CardTitle>
        <CardDescription>
          Requested {date(deletion.requestedAt)} ({deletion.source.replace("_", " ")}). Purge after{" "}
          {date(deletion.purgeAfter)}.{deletion.reason ? ` Reason: ${deletion.reason}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {deletion.lastError ? (
          <p className="text-sm text-destructive">
            Last attempt failed: {deletion.lastError.code} {deletion.lastError.message}
          </p>
        ) : null}
        {deletion.verification ? (
          <div className="space-y-1 text-sm">
            <p>
              Verification {deletion.verification.ok ? "passed" : "failed"} on{" "}
              {date(deletion.verification.checkedAt)}:{" "}
              {deletion.verification.collections.filter((c) => c.remaining === 0).length}/
              {deletion.verification.collections.length} collections empty,{" "}
              {deletion.verification.storage.remaining} files left.
            </p>
            {deletion.verification.retained.length ? (
              <p className="text-muted-foreground">
                Retained by policy:{" "}
                {deletion.verification.retained.map((r) => `${r.name} (${r.count})`).join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {canCancel && deletion.status === "scheduled" ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim().length < 3) {
                setError(new Error("Give a reason for the audit trail."));
                return;
              }
              cancel.mutate();
            }}
          >
            <Label className="flex-1 space-y-1">
              <span>Reason</span>
              <Input
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
            </Label>
            <Button type="submit" variant="outline" disabled={cancel.isPending}>
              {cancel.isPending ? "Cancelling…" : "Cancel deletion"}
            </Button>
            <div className="w-full">
              <InlineFieldErrors error={error} />
              {error instanceof Error && !(error as { errors?: unknown[] }).errors?.length ? (
                <p role="alert" className="text-sm text-destructive">
                  {error.message}
                </p>
              ) : null}
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
