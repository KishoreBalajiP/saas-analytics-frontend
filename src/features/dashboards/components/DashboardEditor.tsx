import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, Plus, Save, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import {
  EmptyState,
  ErrorState,
  InlineFieldErrors,
  TableSkeleton,
} from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as connectorsApi from "@/features/datasets/api";
import { AskWidgetPanel } from "@/features/ai/components/AskWidgetPanel";
import * as dashboardsApi from "@/features/dashboards/api";
import {
  WIDTH_OPTIONS,
  changedPositions,
  moveWidget,
  orderWidgets,
  reflow,
  resizeWidget,
} from "@/features/dashboards/layout";
import { selectableDatasets } from "@/features/datasets/sync";
import { DateRangeFields } from "@/features/analytics/components/DateRangeFields";
import {
  dateRangeFromDraft,
  draftFromDateRange,
  validateDateRangeDraft,
  type DateRangeDraft,
} from "@/features/analytics/dateRange";
import type { Dashboard, Widget } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

import { SharingPanel } from "./SharingPanel";
import { WidgetBuilder } from "./WidgetBuilder";

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

export function DashboardEditor({ dashboardId }: { dashboardId: string }) {
  const { permissions } = useTenantSession();
  const queryClient = useQueryClient();
  const canView = hasPermission(permissions, Permissions.DASHBOARDS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.DASHBOARDS_UPDATE);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
  const [addMode, setAddMode] = useState<"visual" | "ask">("visual");

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
  const refreshWidgets = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboards", dashboardId, "widgets"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboards", "execution", dashboardId] });
  };

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
  const widgets = orderWidgets((widgetsQuery.data?.data ?? dashboard.widgets ?? []) as Widget[]);
  // Builders offer ready datasets only; a widget's current dataset stays selectable.
  const connectors = selectableDatasets(
    connectorsQuery.data?.data ?? [],
    widgets.map((w) => w.datasetId),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Badge
            variant={dashboard.status === "published" ? "default" : "secondary"}
            className="capitalize"
          >
            {dashboard.status}
          </Badge>
          <span className="font-medium">{dashboard.name}</span>
          <span className="text-muted-foreground">
            · {widgets.length} widget{widgets.length === 1 ? "" : "s"}
          </span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <AppLink to={`/dashboards/${dashboardId}` as string}>
            <Eye className="mr-1 h-4 w-4" /> View dashboard
          </AppLink>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle>{selectedWidget ? "Edit widget" : "Add a widget"}</CardTitle>
              {selectedWidget ? (
                <Button size="sm" variant="outline" onClick={() => setSelectedWidget(null)}>
                  <Plus className="mr-1 h-4 w-4" /> New widget
                </Button>
              ) : (
                <div role="tablist" aria-label="How to add a widget" className="flex gap-1">
                  <Button
                    role="tab"
                    aria-selected={addMode === "visual"}
                    size="sm"
                    variant={addMode === "visual" ? "secondary" : "ghost"}
                    onClick={() => setAddMode("visual")}
                  >
                    <SlidersHorizontal className="mr-1 h-4 w-4" /> Build visually
                  </Button>
                  <Button
                    role="tab"
                    aria-selected={addMode === "ask"}
                    size="sm"
                    variant={addMode === "ask" ? "secondary" : "ghost"}
                    onClick={() => setAddMode("ask")}
                  >
                    <Sparkles className="mr-1 h-4 w-4" /> Ask AI
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {selectedWidget || addMode === "visual" ? (
                connectors.length === 0 && !selectedWidget ? (
                  <EmptyState
                    title="No ready datasets"
                    description="Upload a file or sync a data source first. Datasets that are still importing appear here once they are ready."
                    action={
                      <Button asChild>
                        <AppLink to="/datasets">Go to Datasets</AppLink>
                      </Button>
                    }
                  />
                ) : (
                  <WidgetBuilder
                    key={selectedWidget?._id ?? "new"}
                    dashboardId={dashboardId}
                    widget={selectedWidget}
                    connectors={connectors}
                    onSaved={() => {
                      setSelectedWidget(null);
                      refreshWidgets();
                    }}
                  />
                )
              ) : (
                <AskWidgetPanel dashboardId={dashboardId} onAdded={refreshWidgets} />
              )}
            </CardContent>
          </Card>
          <DashboardSettings
            dashboard={dashboard}
            onSaved={() =>
              void queryClient.invalidateQueries({
                queryKey: ["dashboards", "detail", dashboardId],
              })
            }
          />
          {/* vizbuilder: share management for the creator / dashboards.assign holders. */}
          {!dashboard.access || dashboard.access === "manage" ? (
            <SharingPanel dashboardId={dashboardId} />
          ) : null}
        </div>
        <LayoutPanel
          dashboardId={dashboardId}
          widgets={widgets}
          selectedId={selectedWidget?._id ?? null}
          onSelect={setSelectedWidget}
          onChanged={refreshWidgets}
        />
      </div>
    </div>
  );
}

/**
 * Widget order and width on the 12-column grid (no drag-and-drop): move a
 * widget up/down or change its width; the layout reflows and only changed
 * positions are saved.
 */
function LayoutPanel({
  dashboardId,
  widgets,
  selectedId,
  onSelect,
  onChanged,
}: {
  dashboardId: string;
  widgets: Widget[];
  selectedId: string | null;
  onSelect: (widget: Widget) => void;
  onChanged: () => void;
}) {
  const save = useMutation({
    mutationFn: async (next: ReturnType<typeof reflow>) => {
      for (const change of changedPositions(widgets, next)) {
        await dashboardsApi.updateWidget(dashboardId, change.id, { position: change.position });
      }
    },
    onSuccess: onChanged,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save the layout");
      onChanged();
    },
  });

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Layout</CardTitle>
        <p className="text-sm text-muted-foreground">
          Widgets appear in this order, left to right. Pick one to edit it.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {widgets.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No widgets yet. Build one visually or ask a question to add your first chart.
          </p>
        ) : (
          widgets.map((widget, index) => (
            <div
              key={widget._id}
              className={`flex flex-wrap items-center gap-2 rounded-md border p-2 ${selectedId === widget._id ? "border-primary bg-primary/5" : ""}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                onClick={() => onSelect(widget)}
                title={`Edit ${widget.name}`}
              >
                <span className="font-medium">{widget.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{widget.type}</span>
              </button>
              <select
                aria-label={`Width of ${widget.name}`}
                className="h-8 rounded-md border border-input bg-background px-1 text-xs"
                value={
                  WIDTH_OPTIONS.some((o) => o.value === widget.position?.w)
                    ? widget.position?.w
                    : ""
                }
                disabled={save.isPending}
                onChange={(e) =>
                  save.mutate(resizeWidget(widgets, widget._id, Number(e.target.value)))
                }
              >
                {!WIDTH_OPTIONS.some((o) => o.value === widget.position?.w) ? (
                  <option value="">Custom</option>
                ) : null}
                {WIDTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label={`Move ${widget.name} up`}
                disabled={index === 0 || save.isPending}
                onClick={() => save.mutate(moveWidget(widgets, widget._id, -1))}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label={`Move ${widget.name} down`}
                disabled={index === widgets.length - 1 || save.isPending}
                onClick={() => save.mutate(moveWidget(widgets, widget._id, 1))}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** Dashboard default filters without the date range (edited with the picker). */
function filtersWithoutDateRange(filters: Dashboard["filters"]) {
  if (!filters || typeof filters !== "object") return undefined;
  const { dateRange: _dateRange, ...rest } = filters as JsonObject;
  return Object.keys(rest).length ? rest : undefined;
}

export function DashboardSettings({
  dashboard,
  onSaved,
}: {
  dashboard: Dashboard;
  onSaved: () => void;
}) {
  const [name, setName] = useState(dashboard.name);
  const [description, setDescription] = useState(dashboard.description ?? "");
  const [layout, setLayout] = useState(jsonText(dashboard.layout));
  const [dateRange, setDateRange] = useState<DateRangeDraft>(
    draftFromDateRange((dashboard.filters as JsonObject | undefined)?.["dateRange"]),
  );
  const [filters, setFilters] = useState(jsonText(filtersWithoutDateRange(dashboard.filters)));
  const [refresh, setRefresh] = useState(jsonText(dashboard.refresh));
  const [error, setError] = useState<unknown>(null);
  const mutation = useMutation({
    mutationFn: () => {
      const parsedLayout = parseObject(layout, "Layout");
      const parsedFilters = parseObject(filters, "Filters");
      const parsedRefresh = parseObject(refresh, "Refresh");
      const dateIssue = validateDateRangeDraft(dateRange)[0]?.message;
      const firstError =
        dateIssue ?? parsedLayout.error ?? parsedFilters.error ?? parsedRefresh.error;
      if (firstError) return Promise.reject(new Error(firstError));
      // The picker owns the date range; the JSON holds filters / filtersOp.
      const { dateRange: _ignored, ...otherFilters } = parsedFilters.value ?? {};
      const range = dateRangeFromDraft(dateRange);
      return dashboardsApi.update(dashboard._id, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(parsedLayout.value ? { layout: parsedLayout.value } : {}),
        filters: { ...otherFilters, ...(range ? { dateRange: range } : {}) },
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
          <fieldset className="space-y-2">
            <Label className="text-sm font-medium">Default date range</Label>
            <p className="text-xs text-muted-foreground">
              Applies to widgets that do not set their own date range.
            </p>
            <DateRangeFields idPrefix="dashboard" value={dateRange} onChange={setDateRange} />
          </fieldset>
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Advanced: default filters, refresh and layout (JSON)
            </summary>
            <div className="mt-3 space-y-4">
              <JsonField
                id="dashboard-filters"
                label='Default filters JSON ({ "filters": [...], "filtersOp": "and" })'
                value={filters}
                onChange={setFilters}
              />
              <JsonField
                id="dashboard-refresh"
                label="Refresh JSON"
                value={refresh}
                onChange={setRefresh}
              />
              <JsonField
                id="dashboard-layout"
                label="Layout JSON"
                value={layout}
                onChange={setLayout}
              />
            </div>
          </details>
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
