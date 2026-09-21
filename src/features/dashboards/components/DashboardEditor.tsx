import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, InlineFieldErrors, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as connectorsApi from "@/features/datasets/api";
import * as dashboardsApi from "@/features/dashboards/api";
import type { AnalyticsQueryParams, Dashboard, Widget, WidgetType } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

const WIDGET_TYPES: WidgetType[] = ["kpi", "table", "bar", "line", "area", "pie"];
const DEFAULT_POSITION = { x: 0, y: 0, w: 6, h: 4 };

type JsonObject = Record<string, unknown>;

function jsonText(value: unknown) {
  return value ? JSON.stringify(value, null, 2) : "";
}

function parseObject(value: string, label: string): { value?: JsonObject; error?: string } {
  if (!value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: `${label} must be a JSON object.` };
    }
    return { value: parsed as JsonObject };
  } catch {
    return { error: `${label} must contain valid JSON.` };
  }
}

function parsePosition(value: string) {
  const parsed = parseObject(value, "Position");
  if (parsed.error || !parsed.value) return parsed;
  const position = parsed.value;
  const keys = ["x", "y", "w", "h"] as const;
  if (keys.some((key) => typeof position[key] !== "number")) {
    return { error: "Position must include numeric x, y, w, and h values." };
  }
  return { value: position };
}

export function DashboardEditor({ dashboardId }: { dashboardId: string }) {
  const { permissions } = useTenantSession();
  const queryClient = useQueryClient();
  const canView = hasPermission(permissions, Permissions.DASHBOARDS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.DASHBOARDS_UPDATE);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["dashboards", "detail", dashboardId],
    queryFn: () => dashboardsApi.get(dashboardId),
    enabled: canView && !!dashboardId,
  });
  const widgetsQuery = useQuery({
    queryKey: ["dashboards", dashboardId, "widgets", { page: 1, limit: 200 }],
    queryFn: () => dashboardsApi.listWidgets(dashboardId, { page: 1, limit: 200 }),
    enabled: canView && !!dashboardId,
  });
  const connectorsQuery = useQuery({
    queryKey: ["connectors", "list", { limit: 200 }],
    queryFn: () => connectorsApi.list({ limit: 200 }),
    enabled: canUpdate,
  });

  if (!canView || !canUpdate)
    return <ErrorState error={{ statusCode: 403 }} resource="Dashboard editor" />;
  if (dashboardQuery.isLoading || widgetsQuery.isLoading || connectorsQuery.isLoading)
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
  if (connectorsQuery.isError)
    return (
      <ErrorState
        error={connectorsQuery.error}
        onRetry={() => connectorsQuery.refetch()}
        resource="Datasets"
      />
    );

  const dashboard = dashboardQuery.data as Dashboard | undefined;
  if (!dashboard) return null;
  const widgets = (widgetsQuery.data?.data ?? dashboard.widgets ?? []) as Widget[];
  const connectors = connectorsQuery.data?.data ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)]">
      <DashboardSettings
        dashboard={dashboard}
        onSaved={() =>
          void queryClient.invalidateQueries({ queryKey: ["dashboards", "detail", dashboardId] })
        }
      />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Widgets</h2>
            <p className="text-sm text-muted-foreground">
              Configure the analytics query and preserved grid position.
            </p>
          </div>
          <Button size="sm" onClick={() => setSelectedWidget(null)}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        <WidgetEditorForm
          key={selectedWidget?._id ?? "new"}
          dashboardId={dashboardId}
          widget={selectedWidget}
          connectors={connectors}
          onSaved={() => {
            setSelectedWidget(null);
            void queryClient.invalidateQueries({
              queryKey: ["dashboards", dashboardId, "widgets"],
            });
          }}
        />
        {widgets.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No widgets configured.
          </p>
        ) : (
          <div className="space-y-2">
            {widgets.map((widget) => (
              <button
                key={widget._id}
                type="button"
                className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-accent"
                onClick={() => setSelectedWidget(widget)}
              >
                <span>
                  <span className="font-medium">{widget.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{widget.type}</span>
                </span>
                <Badge variant="outline">Edit</Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardSettings({ dashboard, onSaved }: { dashboard: Dashboard; onSaved: () => void }) {
  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description ?? "");
  const [layout, setLayout] = useState(jsonText(dashboard.layout));
  const [filters, setFilters] = useState(jsonText(dashboard.filters));
  const [refresh, setRefresh] = useState(jsonText(dashboard.refresh));
  const [error, setError] = useState<unknown>(null);
  const mutation = useMutation({
    mutationFn: () => {
      const parsedLayout = parseObject(layout, "Layout");
      const parsedFilters = parseObject(filters, "Filters");
      const parsedRefresh = parseObject(refresh, "Refresh");
      const firstError = parsedLayout.error ?? parsedFilters.error ?? parsedRefresh.error;
      if (firstError) return Promise.reject(new Error(firstError));
      return dashboardsApi.update(dashboard._id, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(parsedLayout.value ? { layout: parsedLayout.value } : {}),
        ...(parsedFilters.value ? { filters: parsedFilters.value } : {}),
        ...(parsedRefresh.value ? { refresh: parsedRefresh.value } : {}),
      });
    },
    onSuccess: () => {
      setError(null);
      toast.success("Dashboard saved");
      onSaved();
    },
    onError: setError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setError(new Error("Name is required."));
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="dashboard-name">Name</Label>
            <Input
              id="dashboard-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dashboard-description">Description</Label>
            <Textarea
              id="dashboard-description"
              value={description}
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <JsonField
            id="dashboard-layout"
            label="Layout JSON"
            value={layout}
            onChange={setLayout}
          />
          <JsonField
            id="dashboard-filters"
            label="Filters JSON"
            value={filters}
            onChange={setFilters}
          />
          <JsonField
            id="dashboard-refresh"
            label="Refresh JSON"
            value={refresh}
            onChange={setRefresh}
          />
          {error ? <InlineFieldErrors error={error} /> : null}
          {error && !(error instanceof Error && error.message) ? (
            <ErrorState error={error} />
          ) : error instanceof Error ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : null}
          <Button type="submit" disabled={mutation.isPending}>
            <Save className="mr-1 h-4 w-4" />
            {mutation.isPending ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function WidgetEditorForm({
  dashboardId,
  widget,
  connectors,
  onSaved,
}: {
  dashboardId: string;
  widget: Widget | null;
  connectors: Array<{ _id: string; name: string }>;
  onSaved: () => void;
}) {
  const [name, setName] = useState(widget?.name ?? "");
  const [type, setType] = useState<WidgetType>(widget?.type ?? "table");
  const [datasetId, setDatasetId] = useState(widget?.datasetId ?? "");
  const [query, setQuery] = useState(jsonText(widget?.query));
  const [visualization, setVisualization] = useState(jsonText(widget?.visualization));
  const [position, setPosition] = useState(jsonText(widget?.position ?? DEFAULT_POSITION));
  const [error, setError] = useState<unknown>(null);
  const mutation = useMutation({
    mutationFn: () => {
      const parsedQuery = parseObject(query, "Query");
      const parsedVisualization = parseObject(visualization, "Visualization");
      const parsedPosition = parsePosition(position);
      const firstError = parsedQuery.error ?? parsedVisualization.error ?? parsedPosition.error;
      if (firstError) return Promise.reject(new Error(firstError));
      if (!name.trim()) return Promise.reject(new Error("Widget name is required."));
      if (!datasetId) return Promise.reject(new Error("Dataset is required."));
      const body = {
        name: name.trim(),
        type,
        datasetId,
        ...(parsedQuery.value ? { query: parsedQuery.value as AnalyticsQueryParams } : {}),
        ...(parsedVisualization.value ? { visualization: parsedVisualization.value } : {}),
        ...(parsedPosition.value
          ? { position: parsedPosition.value as { x: number; y: number; w: number; h: number } }
          : {}),
      };
      return widget
        ? dashboardsApi.updateWidget(dashboardId, widget._id, body)
        : dashboardsApi.createWidget(dashboardId, body);
    },
    onSuccess: () => {
      setError(null);
      toast.success(widget ? "Widget updated" : "Widget added");
      onSaved();
    },
    onError: setError,
  });
  const deleteMutation = useMutation({
    mutationFn: () => dashboardsApi.removeWidget(dashboardId, widget?._id ?? ""),
    onSuccess: () => {
      toast.success("Widget deleted");
      onSaved();
    },
    onError: setError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{widget ? "Edit widget" : "Add widget"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="widget-name">Name</Label>
            <Input
              id="widget-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="widget-type">Type</Label>
            <select
              id="widget-type"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as WidgetType)}
            >
              {WIDGET_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="widget-dataset">Dataset</Label>
            <select
              id="widget-dataset"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={datasetId}
              onChange={(event) => setDatasetId(event.target.value)}
            >
              <option value="">Select a dataset</option>
              {connectors.map((connector) => (
                <option key={connector._id} value={connector._id}>
                  {connector.name}
                </option>
              ))}
            </select>
          </div>
          <JsonField id="widget-query" label="Query JSON" value={query} onChange={setQuery} />
          <JsonField
            id="widget-visualization"
            label="Visualization JSON"
            value={visualization}
            onChange={setVisualization}
          />
          <JsonField
            id="widget-position"
            label="Position JSON"
            value={position}
            onChange={setPosition}
          />
          {error instanceof Error && (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending || deleteMutation.isPending}>
              {mutation.isPending ? "Saving…" : widget ? "Save widget" : "Add widget"}
            </Button>
            {widget && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={mutation.isPending || deleteMutation.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function JsonField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        className="min-h-24 font-mono text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="{}"
      />
    </div>
  );
}
