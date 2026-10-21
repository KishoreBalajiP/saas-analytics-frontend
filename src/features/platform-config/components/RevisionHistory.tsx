import { useQuery } from "@tanstack/react-query";
import { History, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Paged } from "@/lib/api/types";
import type { ConfigRevision } from "@/features/platform-config/types";

const ACTION_LABEL: Record<string, string> = {
  baseline: "Original",
  create: "Created",
  update: "Changed",
  reset: "Reset",
  delete: "Deleted",
  rollback: "Rolled back",
};

function when(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

/**
 * Version history of one configuration resource, newest first, with a
 * "Restore" action per earlier version. The backend records the exact state
 * of every version; restoring creates a new version (so it can be undone).
 */
export function RevisionHistory<State extends Record<string, unknown>>({
  title,
  queryKey,
  load,
  currentVersion,
  canRestore,
  restoring,
  onRestore,
  renderState,
  isRestorable = () => true,
}: {
  title: string;
  queryKey: readonly unknown[];
  load: () => Promise<Paged<ConfigRevision<State>>>;
  currentVersion: number;
  canRestore: boolean;
  restoring?: boolean;
  onRestore: (revision: ConfigRevision<State>) => void;
  renderState: (revision: ConfigRevision<State>) => ReactNode;
  isRestorable?: (revision: ConfigRevision<State>) => boolean;
}) {
  const query = useQuery({ queryKey: [...queryKey, currentVersion], queryFn: load });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> {title}
        </CardTitle>
        <CardDescription>
          Every change is versioned. Restoring an earlier version records a new version.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? <TableSkeleton rows={3} cols={3} /> : null}
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} resource="History" />
        ) : null}
        {query.data && query.data.data.length === 0 ? (
          <EmptyState title="No changes yet" description="This value has never been changed." />
        ) : null}
        {query.data && query.data.data.length > 0 ? (
          <ol className="space-y-2" aria-label={`${title} versions`}>
            {query.data.data.map((revision) => {
              const isCurrent = revision.version === currentVersion;
              return (
                <li
                  key={revision.version}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">Version {revision.version}</span>
                      <Badge variant="outline">
                        {ACTION_LABEL[revision.action] ?? revision.action}
                      </Badge>
                      {isCurrent ? <Badge>Current</Badge> : null}
                      {revision.rolledBackFrom !== null ? (
                        <span className="text-xs text-muted-foreground">
                          from version {revision.rolledBackFrom}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm">{renderState(revision)}</div>
                    <p className="text-xs text-muted-foreground">
                      {when(revision.createdAt)}
                      {revision.changedBy?.id ? ` · by ${revision.changedBy.id}` : " · by system"}
                      {revision.reason ? ` · “${revision.reason}”` : ""}
                    </p>
                  </div>
                  {canRestore && !isCurrent && isRestorable(revision) ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={restoring}>
                          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore v{revision.version}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restore version {revision.version}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The exact state of version {revision.version} becomes the current value.
                            This is recorded as a new version and audited.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onRestore(revision)}>
                            Restore
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </CardContent>
    </Card>
  );
}
