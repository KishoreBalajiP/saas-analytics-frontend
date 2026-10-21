import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDateTime, statusLabel } from "@/features/data-export/lib";
import type { DataExport } from "@/features/data-export/types";

/** Shared table of exports with download / delete actions. */
export function ExportList({
  rows,
  canExport,
  busy,
  onDownload,
  onDelete,
}: {
  rows: DataExport[];
  canExport: boolean;
  busy: boolean;
  onDownload: (row: DataExport) => void;
  onDelete: (row: DataExport) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No exports yet.</p>;
  return (
    <ul className="space-y-1 text-sm" aria-label="Data exports">
      {rows.map((row) => (
        <li key={row.exportId} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
          <Badge variant={row.status === "completed" ? "default" : "secondary"}>
            {statusLabel(row.status)}
          </Badge>
          <span className="text-muted-foreground">
            {formatDateTime(row.createdAt)} · {row.requestedBy?.display ?? "—"} ·{" "}
            {formatBytes(row.sizeBytes)}
            {row.expiresAt ? ` · expires ${formatDateTime(row.expiresAt)}` : ""}
          </span>
          {canExport ? (
            <div className="ml-auto flex gap-2">
              {row.status === "completed" && row.downloadable ? (
                <Button size="sm" disabled={busy} onClick={() => onDownload(row)}>
                  Download
                </Button>
              ) : null}
              {row.status === "completed" ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onDelete(row)}>
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
