import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";

import { ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as analyticsApi from "@/features/analytics/api";
import type { AnalyticsExport } from "@/lib/api/types";
import { formatRows, triggerDownload } from "@/lib/download";

/** How often a pending or running export is re-read (ms). */
export const EXPORT_POLL_MS = 1500;

const ACTIVE = new Set<AnalyticsExport["status"]>(["pending", "running"]);

/**
 * Live status of an async analytics export: polls until it is ready or
 * failed, then offers the download (a short-lived signed link).
 */
export function ExportStatus({
  exportId,
  onDismiss,
}: {
  exportId: string;
  onDismiss?: () => void;
}) {
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const status = useQuery({
    queryKey: ["analytics", "exports", exportId],
    queryFn: () => analyticsApi.getExport(exportId),
    // Poll while pending or running; stop once finished or when the status
    // itself cannot be read (e.g. 404 for an export that is not yours).
    refetchInterval: (q) =>
      q.state.status === "error" || (q.state.data && !ACTIVE.has(q.state.data.status))
        ? false
        : EXPORT_POLL_MS,
  });
  const download = useMutation({
    mutationFn: () => analyticsApi.downloadExport(exportId),
    onSuccess: (descriptor) => {
      setDownloadError(null);
      triggerDownload(descriptor.url, descriptor.fileName);
    },
    onError: (e) => setDownloadError(e),
  });

  if (status.isError) return <ErrorState error={status.error} resource="Export" />;
  const data = status.data;
  const active = !data || ACTIVE.has(data.status);
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs"
      role="status"
      aria-live="polite"
    >
      <span className="font-medium">Export</span>
      <span className="font-mono uppercase">{data?.format ?? ""}</span>
      {active ? (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {data?.status === "running" ? "Generating…" : "Queued…"}
        </span>
      ) : null}
      {data?.status === "ready" ? (
        <>
          <Badge variant="secondary">Ready</Badge>
          <span>{formatRows(data.rowCount)}</span>
          {data.truncated ? (
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              Truncated at {formatRows(data.rowLimit ?? data.rowCount)}
            </Badge>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => download.mutate()}
            disabled={download.isPending}
          >
            <Download className="mr-1 h-3 w-3" />
            {download.isPending ? "Preparing…" : "Download"}
          </Button>
        </>
      ) : null}
      {data?.status === "failed" ? (
        <>
          <Badge variant="destructive">Failed</Badge>
          <span className="text-destructive">{data.error ?? "The export failed."}</span>
        </>
      ) : null}
      {onDismiss && !active ? (
        <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={onDismiss}>
          Dismiss
        </Button>
      ) : null}
      {downloadError ? (
        <div className="basis-full">
          <ErrorState error={downloadError} resource="Export download" />
        </div>
      ) : null}
    </div>
  );
}
