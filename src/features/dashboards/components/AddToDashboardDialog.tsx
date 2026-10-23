import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { useState } from "react";

import { AppLink } from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as dashboardsApi from "@/features/dashboards/api";
import {
  WIDGET_TYPE_LABELS,
  recommendChartType,
  supportedWidgetTypes,
  toWidgetQuery,
} from "@/features/dashboards/chartRecommendation";
import { ApiError } from "@/lib/api/client";
import type { AnalyticsQueryParams, WidgetType } from "@/lib/api/types";

const NEW = "__new__";

export interface AddToDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The exact query that produced the result (connector/paging keys are dropped). */
  query: AnalyticsQueryParams | Record<string, unknown>;
  /** The single dataset (connector) the query ran on. */
  datasetId: string;
  rows?: Array<Record<string, unknown>>;
  defaultTitle?: string;
  defaultType?: WidgetType;
}

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    const details = error.errors?.map((e) => `${e.field}: ${e.message}`).join("; ");
    return details ? `${error.message} (${details})` : error.message;
  }
  return error instanceof Error ? error.message : "Could not add the widget.";
}

export function AddToDashboardDialog({
  open,
  onOpenChange,
  query,
  datasetId,
  rows = [],
  defaultTitle = "",
  defaultType,
}: AddToDashboardDialogProps) {
  const queryClient = useQueryClient();
  const widgetQuery = toWidgetQuery(query);
  const types = supportedWidgetTypes(widgetQuery);
  const recommended = defaultType ?? recommendChartType(widgetQuery, rows);
  const [type, setType] = useState<WidgetType>(
    types.includes(recommended) ? recommended : types[0]!,
  );
  const [title, setTitle] = useState(defaultTitle);
  const [target, setTarget] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [created, setCreated] = useState<{ dashboardId: string; name: string } | null>(null);

  const dashboards = useQuery({
    queryKey: ["dashboards", "picker"],
    queryFn: () => dashboardsApi.list({ limit: 100 }),
    enabled: open,
  });
  const items = dashboards.data?.data ?? [];
  const selected = target || (items.length ? items[0]!._id : NEW);

  const add = useMutation({
    mutationFn: async () => {
      let dashboardId = selected;
      let name = items.find((d) => d._id === selected)?.name ?? "";
      if (selected === NEW) {
        const dashboard = await dashboardsApi.create({
          name: newName.trim(),
          ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
        });
        dashboardId = dashboard._id;
        name = dashboard.name;
      }
      await dashboardsApi.createWidget(dashboardId, {
        name: title.trim(),
        type,
        datasetId,
        query: widgetQuery,
      });
      return { dashboardId, name };
    },
    onSuccess: (result) => {
      setCreated(result);
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });

  const canSubmit =
    !!datasetId &&
    !!title.trim() &&
    (selected !== NEW || !!newName.trim()) &&
    !add.isPending &&
    !dashboards.isLoading;

  function close(next: boolean) {
    if (!next) {
      setCreated(null);
      add.reset();
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to dashboard</DialogTitle>
          <DialogDescription>
            Saves this exact query as a dashboard widget. It re-runs with live data on the
            dashboard.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div role="status" className="space-y-3 text-sm">
            <p>
              Widget added to <strong>{created.name}</strong>.
            </p>
            <AppLink
              to={`/dashboards/${created.dashboardId}`}
              className="font-medium text-primary underline"
            >
              Open dashboard
            </AppLink>
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) add.mutate();
            }}
          >
            {!datasetId ? (
              <p role="alert" className="text-sm text-destructive">
                Run the query on exactly one data source to add it to a dashboard.
              </p>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="atd-dashboard">Dashboard</Label>
              <select
                id="atd-dashboard"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={selected}
                onChange={(e) => setTarget(e.target.value)}
              >
                {items.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
                <option value={NEW}>+ New dashboard</option>
              </select>
            </div>
            {selected === NEW ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="atd-new-name">New dashboard name</Label>
                  <Input
                    id="atd-new-name"
                    value={newName}
                    maxLength={120}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="atd-new-description">Description (optional)</Label>
                  <Input
                    id="atd-new-description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="atd-title">Widget title</Label>
              <Input
                id="atd-title"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="atd-type">Widget type</Label>
              <select
                id="atd-type"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as WidgetType)}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {WIDGET_TYPE_LABELS[t]}
                    {t === recommended ? " (recommended)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {add.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {errorText(add.error)}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                <LayoutDashboard className="mr-1 h-4 w-4" />
                {add.isPending ? "Adding…" : "Add widget"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Button + dialog pair for result views. */
export function AddToDashboardButton(
  props: Omit<AddToDashboardDialogProps, "open" | "onOpenChange">,
) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <LayoutDashboard className="mr-1 h-3 w-3" />
        Add to dashboard
      </Button>
      {open ? <AddToDashboardDialog {...props} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
