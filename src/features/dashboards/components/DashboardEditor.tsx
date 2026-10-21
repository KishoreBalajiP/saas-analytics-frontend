import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
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
      <div className="space-y-6">
        <DashboardSettings
          dashboard={dashboard}
          onSaved={() =>
            void queryClient.invalidateQueries({ queryKey: ["dashboards", "detail", dashboardId] })
          }
        />
        {/* vizbuilder: share management for the creator / dashboards.assign holders. */}
        {!dashboard.access || dashboard.access === "manage" ? (
          <SharingPanel dashboardId={dashboardId} />
        ) : null}
      </div>
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
        <WidgetBuilder
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
          <JsonField
            id="dashboard-layout"
            label="Layout JSON"
            value={layout}
            onChange={setLayout}
          />
          <fieldset className="space-y-2">
            <Label className="text-sm font-medium">Default date range</Label>
            <p className="text-xs text-muted-foreground">
              Applies to widgets that do not set their own date range.
            </p>
            <DateRangeFields idPrefix="dashboard" value={dateRange} onChange={setDateRange} />
          </fieldset>
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
