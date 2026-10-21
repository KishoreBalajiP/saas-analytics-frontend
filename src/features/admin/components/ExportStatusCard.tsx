import { useQuery } from "@tanstack/react-query";
import { Clock, Download, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ExportStatus } from "@/features/admin/api";
import { isExportExpiredError } from "@/features/admin/lib/exportExpiry";

const IN_PROGRESS = new Set(["queued", "processing"]);

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

/** Only real links are offered (the local storage driver returns `local://`). */
function downloadable(url?: string) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

interface ExportStatusCardProps {
  exportId: string;
  fetchStatus: (exportId: string) => Promise<ExportStatus>;
  queryKey: readonly unknown[];
  /** Clear this export so a new one can be requested. */
  onReset: () => void;
  /** Poll interval while the export is queued or processing. */
  pollMs?: number;
}

/**
 * Polls an audit / access-log export until it finishes, then offers the
 * download and says when it expires. An expired export (410
 * EXPORT_EXPIRED) stops polling and asks for a new export.
 */
export function ExportStatusCard({
  exportId,
  fetchStatus,
  queryKey,
  onReset,
  pollMs = 2000,
}: ExportStatusCardProps) {
  const query = useQuery({
    queryKey: [...queryKey, exportId],
    queryFn: () => fetchStatus(exportId),
    retry: false,
    refetchInterval: (q) => {
      if (q.state.error) return false;
      const status = q.state.data?.status;
      return status && !IN_PROGRESS.has(status) ? false : pollMs;
    },
  });

  if (query.isError && isExportExpiredError(query.error)) {
    return (
      <Card role="status" aria-live="polite">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              Export <span className="font-mono">{exportId}</span> has expired and its file was
              deleted. Request a new export.
            </span>
          </span>
          <Button size="sm" variant="outline" onClick={onReset}>
            Request a new export
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = query.data;
  const status = query.isError ? "unavailable" : (data?.status ?? "queued");
  const finished = query.isError || (data?.status && !IN_PROGRESS.has(data.status));

  return (
    <Card role="status" aria-live="polite">
      <CardContent className="space-y-2 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Export <span className="font-mono">{exportId}</span>:{" "}
            <Badge
              variant={
                status === "completed" ? "default" : status === "failed" ? "destructive" : "outline"
              }
              className="capitalize"
            >
              {status}
            </Badge>
          </span>
          {finished ? (
            <Button size="sm" variant="ghost" onClick={onReset} aria-label="Dismiss export">
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        {query.isError ? (
          <p className="text-destructive">
            {query.error instanceof Error ? query.error.message : "Could not read the export."}
          </p>
        ) : null}
        {data?.status === "failed" && data.error ? (
          <p className="text-destructive">{data.error}</p>
        ) : null}
        {data?.status === "completed" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-muted-foreground">
              {data.recordCount ?? 0} records · available until {date(data.expiresAt)}
            </span>
            {downloadable(data.downloadUrl) ? (
              <Button asChild size="sm" variant="outline">
                <a href={data.downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-1 h-4 w-4" />
                  Download {data.fileName ?? ""}
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
