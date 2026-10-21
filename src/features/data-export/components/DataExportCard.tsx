import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import * as api from "@/features/data-export/api";
import { ExportList } from "@/features/data-export/components/ExportList";
import { exportErrorMessage, pollInterval, startDownload } from "@/features/data-export/lib";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

/**
 * Workspace settings: export all workspace data as a portable archive
 * (roadmap 2.9). Hidden without `data_exports.view` (Owner by default).
 */
export function DataExportCard() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.DATA_EXPORTS_VIEW);
  const canExport = hasPermission(permissions, Permissions.DATA_EXPORTS_EXPORT);
  const queryClient = useQueryClient();
  const key = [...api.dataExportKeys.workspace];
  const list = useQuery({
    queryKey: key,
    queryFn: () => api.listWorkspaceExports({ limit: 20 }),
    enabled: canView,
    refetchInterval: (q) => pollInterval(q.state.data?.data),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: key });
  const onError = (e: unknown) => toast.error(exportErrorMessage(e));
  const create = useMutation({
    mutationFn: api.requestWorkspaceExport,
    onSuccess: () => {
      invalidate();
      toast.success("Export requested. We will email you when it is ready.");
    },
    onError,
  });
  const download = useMutation({
    mutationFn: (id: string) => api.workspaceDownloadUrl(id),
    onSuccess: (link) => startDownload(link.url),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteWorkspaceExport(id),
    onSuccess: invalidate,
    onError,
  });

  if (!canView) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data export</CardTitle>
        <CardDescription>
          Download everything this workspace owns (metadata and dataset rows) as an archive. Secrets
          are never included. Archives expire after a few days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canExport ? (
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Requesting…" : "Export workspace data"}
          </Button>
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
