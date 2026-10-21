import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as api from "@/features/data-export/api";
import { ExportList } from "@/features/data-export/components/ExportList";
import { exportErrorMessage, pollInterval, startDownload } from "@/features/data-export/lib";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

/** Admin tenant page: platform-initiated tenant data export with a reason. */
export function TenantDataExportPanel({ tenantId }: { tenantId: string }) {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.IAM_TENANTS_VIEW);
  const canExport = hasPermission(permissions, Permissions.IAM_TENANTS_EXPORT);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const key = [...api.dataExportKeys.tenant(tenantId)];
  const list = useQuery({
    queryKey: key,
    queryFn: () => api.listTenantExports(tenantId, { limit: 20 }),
    enabled: canView,
    refetchInterval: (q) => pollInterval(q.state.data?.data),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: key });
  const onError = (e: unknown) => toast.error(exportErrorMessage(e));
  const create = useMutation({
    mutationFn: () => api.requestTenantExport(tenantId, reason.trim()),
    onSuccess: () => {
      setReason("");
      invalidate();
      toast.success("Tenant export requested.");
    },
    onError,
  });
  const download = useMutation({
    mutationFn: (id: string) => api.tenantDownloadUrl(tenantId, id),
    onSuccess: (link) => startDownload(link.url),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTenantExport(tenantId, id),
    onSuccess: invalidate,
    onError,
  });

  if (!canView) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data export</CardTitle>
        <CardDescription>
          Export this tenant&apos;s data for support or recovery. Audited.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canExport ? (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim().length >= 3) create.mutate();
            }}
          >
            <Label htmlFor="tenant-export-reason">Reason</Label>
            <Textarea
              id="tenant-export-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <Button type="submit" disabled={create.isPending || reason.trim().length < 3}>
              Export tenant data
            </Button>
          </form>
        ) : null}
        {list.isLoading ? (
          <TableSkeleton rows={2} cols={3} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} resource="Data exports" />
        ) : (
          <ExportList
            rows={list.data?.data ?? []}
            canExport={canExport}
            busy={download.isPending || remove.isPending}
            onDownload={(row) => download.mutate(row.exportId)}
            onDelete={(row) => remove.mutate(row.exportId)}
          />
        )}
      </CardContent>
    </Card>
  );
}
