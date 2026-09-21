import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { WidgetView } from "@/components/common/WidgetView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import * as dashboardsApi from "@/features/dashboards/api";
import type { Dashboard, Widget } from "@/lib/api/types";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

const PAGE_LIMIT = 25;

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function DashboardDetailView({ dashboardId }: { dashboardId: string }) {
  const { permissions } = useTenantSession();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canView = hasPermission(permissions, Permissions.DASHBOARDS_VIEW);
  const canExecute = hasPermission(permissions, Permissions.ANALYTICS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.DASHBOARDS_UPDATE);
  const canDelete = hasPermission(permissions, Permissions.DASHBOARDS_DELETE);

  const dashboardQuery = useQuery({
    queryKey: ["dashboards", "detail", dashboardId],
    queryFn: () => dashboardsApi.get(dashboardId),
    enabled: canView && !!dashboardId,
  });

  const widgetsQuery = useQuery({
    queryKey: ["dashboards", dashboardId, "widgets", { page: 1, limit: PAGE_LIMIT }],
    queryFn: () => dashboardsApi.listWidgets(dashboardId, { page: 1, limit: PAGE_LIMIT }),
    enabled: canView && !!dashboardId,
  });

  const executionQuery = useQuery({
    queryKey: ["dashboards", "execution", dashboardId],
    queryFn: () => dashboardsApi.execute(dashboardId),
    enabled: canView && canExecute && !!dashboardId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => dashboardsApi.remove(dashboardId),
    onSuccess: () => {
      toast.success("Dashboard deleted");
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to delete dashboard"),
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Dashboard" />;
  if (dashboardQuery.isLoading || widgetsQuery.isLoading)
    return <TableSkeleton rows={4} cols={3} />;
  if (dashboardQuery.isError)
    return (
      <ErrorState
        error={dashboardQuery.error}
        onRetry={() => dashboardQuery.refetch()}
        resource="Dashboard"
      />
    );
  if (widgetsQuery.isError)
    return (
      <ErrorState
        error={widgetsQuery.error}
        onRetry={() => widgetsQuery.refetch()}
        resource="Widgets"
      />
    );

  const dashboard = dashboardQuery.data as Dashboard | undefined;
  if (!dashboard) return null;

  const widgets = (widgetsQuery.data?.data ?? dashboard.widgets ?? []) as Widget[];
  const executionByWidget = new Map(
    (executionQuery.data ?? []).map((entry) => [entry.widgetId, entry]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant={dashboard.status === "published" ? "default" : "secondary"}
              className="capitalize"
            >
              {dashboard.status}
            </Badge>
            {dashboard.updatedAt && (
              <span className="text-xs text-muted-foreground">
                Updated {formatDate(dashboard.updatedAt)}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{dashboard.name}</h2>
          {dashboard.description && (
            <p className="mt-1 text-sm text-muted-foreground">{dashboard.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canUpdate && (
            <Button variant="outline" size="sm" asChild>
              <AppLink to={`/dashboards/${dashboardId}/edit` as string}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </AppLink>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              void executionQuery.refetch().finally(() => setIsRefreshing(false));
            }}
            disabled={!canExecute || isRefreshing || executionQuery.isFetching}
          >
            {isRefreshing || executionQuery.isFetching ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More dashboard actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void navigator.clipboard?.writeText(dashboardId)}>
                <Copy className="mr-2 h-4 w-4" /> Copy ID
              </DropdownMenuItem>
              {canDelete && <DeleteDashboardAction mutation={deleteMutation} />}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!canExecute ? (
        <ErrorState error={{ statusCode: 403 }} resource="Widget execution" />
      ) : executionQuery.isError ? (
        <ErrorState
          error={executionQuery.error}
          onRetry={() => executionQuery.refetch()}
          resource="Dashboard execution"
        />
      ) : widgets.length === 0 ? (
        <EmptyState
          title="No widgets yet"
          description="Add a KPI, table, or chart widget to start visualizing this dashboard."
          action={
            canUpdate ? (
              <Button asChild>
                <AppLink to={`/dashboards/${dashboardId}/edit` as string}>
                  <Plus className="mr-1 h-4 w-4" /> Add widget
                </AppLink>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {widgets.map((widget) => {
            const execution = executionByWidget.get(widget._id);
            return (
              <Card
                key={widget._id}
                className="overflow-hidden"
                style={
                  widget.position
                    ? {
                        gridColumn: `${Math.max(1, Math.min(12, widget.position.x + 1))} / span ${Math.max(1, Math.min(12, widget.position.w))}`,
                        gridRow: `${Math.max(1, widget.position.y + 1)} / span ${Math.max(1, widget.position.h)}`,
                      }
                    : undefined
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{widget.name}</span>
                    <Badge variant="outline" className="capitalize">
                      {widget.type}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {execution?.error ? (
                    <ErrorState
                      error={new Error(execution.error.message)}
                      resource={`${widget.name} widget`}
                    />
                  ) : execution?.result ? (
                    <WidgetView type={widget.type} result={execution.result} />
                  ) : executionQuery.isLoading ? (
                    <TableSkeleton rows={3} cols={2} />
                  ) : (
                    <EmptyState
                      title="No execution data"
                      description="Refresh this dashboard to load widget data."
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteDashboardAction({
  mutation,
}: {
  mutation: { mutate: () => void; isPending: boolean };
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem className="text-destructive" onSelect={(event) => event.preventDefault()}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this dashboard?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the dashboard and its widgets.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
