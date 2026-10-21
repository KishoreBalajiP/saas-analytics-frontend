import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/features/auth/api";
import * as connectorsApi from "@/features/datasets/api";
import * as dashboardsApi from "@/features/dashboards/api";
import { useTenantSession } from "@/lib/auth/session";
import type { Connector, PreviewResult } from "@/lib/api/types";
import { errorMessage } from "@/lib/api/quota";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Workspace setup - Analivo" }] }),
  component: OnboardingPage,
});

export function OnboardingPage() {
  return (
    <TenantPortal>
      <OnboardingContent />
    </TenantPortal>
  );
}

function OnboardingContent() {
  const queryClient = useQueryClient();
  const { me } = useTenantSession();
  const [connectorType, setConnectorType] = useState<"csv" | "xlsx">("csv");
  const [connectorName, setConnectorName] = useState("Sales data");
  const [dashboardName, setDashboardName] = useState("Executive overview");
  const [selectedConnectorId, setSelectedConnectorId] = useState("");
  const [upload, setUpload] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewConnectorId, setPreviewConnectorId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const connectorsQuery = useQuery({
    queryKey: ["connectors", "onboarding"],
    queryFn: () => connectorsApi.list({ page: 1, limit: 100 }),
  });
  const dashboardsQuery = useQuery({
    queryKey: ["dashboards", "onboarding"],
    queryFn: () => dashboardsApi.list({ page: 1, limit: 100 }),
  });
  const connectors = connectorsQuery.data?.data ?? [];
  const dashboards = dashboardsQuery.data?.data ?? [];
  const fileConnectors = connectors.filter(
    (connector) => connector.type === "csv" || connector.type === "xlsx",
  );
  const selectedConnector =
    fileConnectors.find((connector) => connector._id === selectedConnectorId) ?? fileConnectors[0];
  const connectorStatusQuery = useQuery({
    queryKey: ["connector", selectedConnector?._id, "onboarding-status"],
    queryFn: () => connectorsApi.get(selectedConnector!._id),
    enabled: Boolean(selectedConnector),
    refetchInterval: (query) =>
      query.state.data?.syncStatus === "queued" || query.state.data?.syncStatus === "running"
        ? 1000
        : false,
  });
  const selectedConnectorStatus = connectorStatusQuery.data ?? selectedConnector;
  const currentFileConnectors = fileConnectors.map((connector) =>
    connector._id === selectedConnector?._id && selectedConnectorStatus
      ? { ...connector, ...selectedConnectorStatus }
      : connector,
  );
  const syncedConnector = currentFileConnectors.find(
    (connector) =>
      connector.lastSyncedAt &&
      connector.syncStatus !== "queued" &&
      connector.syncStatus !== "running",
  );
  const syncInProgress =
    selectedConnectorStatus?.syncStatus === "queued" ||
    selectedConnectorStatus?.syncStatus === "running";
  const syncFailed = selectedConnectorStatus?.syncStatus === "failed";
  const firstDashboard = dashboards[0];

  const createConnectorMutation = useMutation({
    mutationFn: async () => {
      const name = connectorName.trim() || "Sales data";
      const current = await connectorsApi.list({ page: 1, limit: 100 });
      const existing = current.data.find(
        (item) => item.type === connectorType && item.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) return existing;
      return connectorsApi.create({
        type: connectorType,
        name,
        config: connectorType === "csv" ? { delimiter: ",", hasHeader: true } : { hasHeader: true },
      });
    },
    onSuccess: async (connector) => {
      setSelectedConnectorId(connector._id);
      setUpload(null);
      setPreview(null);
      setPreviewConnectorId("");
      await queryClient.invalidateQueries({ queryKey: ["connectors"] });
      toast.success("Data source created.");
    },
  });

  const previewMutation = useMutation({
    mutationFn: async ({ connector, file }: { connector: Connector; file: File }) => {
      const validation = await connectorsApi.validate(connector._id);
      if (!validation.valid) {
        const detail = validation.errors?.join(" ");
        throw new Error(detail || "The saved connector configuration is invalid.");
      }
      return connectorsApi.previewFile(connector._id, file);
    },
    onSuccess: (result, variables) => {
      setPreview(result);
      setPreviewConnectorId(variables.connector._id);
      toast.success("Connection validated and file preview loaded.");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ connector, file }: { connector: Connector; file: File }) => {
      const before = await connectorsApi.get(connector._id);
      await connectorsApi.syncFile(connector._id, file);
      const baselineSync = before.lastSyncedAt ?? null;
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await delay(1000);
        const current = await connectorsApi.get(connector._id);
        if (current.syncStatus === "failed")
          throw new Error(current.lastError || "The import failed. Check the file and retry.");
        if (
          current.syncStatus === "succeeded" &&
          current.lastSyncedAt &&
          current.lastSyncedAt !== baselineSync
        ) {
          const rows = await connectorsApi.listRows(connector._id, { page: 1, limit: 1 });
          return { rowCount: rows.meta.total, warning: current.lastError };
        }
      }
      throw new Error(
        "The sync was accepted but completion is not confirmed yet. Leave and return to check it again.",
      );
    },
    onSuccess: async ({ rowCount, warning }) => {
      await queryClient.invalidateQueries({ queryKey: ["connectors"] });
      await queryClient.invalidateQueries({
        queryKey: ["connector", selectedConnector?._id, "onboarding-status"],
      });
      if (warning) toast.warning(`Import completed with warnings. ${rowCount} rows are available.`);
      else toast.success(`Import completed. ${rowCount} rows are now available.`);
    },
  });

  const createDashboardMutation = useMutation({
    mutationFn: async () => {
      const name = dashboardName.trim() || "Executive overview";
      const current = await dashboardsApi.list({ page: 1, limit: 100 });
      const existing = current.data.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing;
      return dashboardsApi.create({ name, description: "Created during workspace setup." });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      toast.success("Dashboard is ready.");
    },
  });

  const invitationMutation = useMutation({
    mutationFn: () =>
      authApi.inviteTenantMember({
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        roleName: "Viewer",
      }),
    onSuccess: (result) => {
      if (result.alreadyPending) toast.info("An invitation is already pending for this address.");
      else if (result.delivered) toast.success("Invitation email sent.");
      else toast.warning("The invitation was created, but email delivery failed.");
    },
  });

  const hasPreview = Boolean(preview && previewConnectorId === selectedConnector?._id && upload);

  if (connectorsQuery.isLoading || dashboardsQuery.isLoading || connectorStatusQuery.isLoading)
    return (
      <p className="mx-auto max-w-6xl px-4 py-12 text-sm text-muted-foreground" role="status">
        Loading workspace setup…
      </p>
    );
  if (
    connectorsQuery.isError ||
    dashboardsQuery.isError ||
    (selectedConnector && connectorStatusQuery.isError)
  ) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Setup status is unavailable</CardTitle>
            <CardDescription>
              We could not load server records. No step has been marked complete.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                void connectorsQuery.refetch();
                void dashboardsQuery.refetch();
                void connectorStatusQuery.refetch();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Workspace setup
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Get your workspace ready in a few steps.
          </h1>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          {me?.email ?? "Workspace owner"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>1. Connect and import a file</CardTitle>
                  <CardDescription>
                    Use a supported CSV or Excel upload. Test and preview it before syncing.
                  </CardDescription>
                </div>
              </div>
              {syncedConnector ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Import complete" />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {fileConnectors.length ? (
                <div className="space-y-2">
                  <Label htmlFor="setup-connector">File data source</Label>
                  <select
                    id="setup-connector"
                    value={selectedConnector?._id ?? ""}
                    onChange={(event) => {
                      setSelectedConnectorId(event.target.value);
                      setPreview(null);
                      setUpload(null);
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {fileConnectors.map((connector) => (
                      <option key={connector._id} value={connector._id}>
                        {connector.name} ({connector.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="connector-name">Data source name</Label>
                    <Input
                      id="connector-name"
                      value={connectorName}
                      onChange={(event) => setConnectorName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="connector-type">File format</Label>
                    <select
                      id="connector-type"
                      value={connectorType}
                      onChange={(event) => setConnectorType(event.target.value as "csv" | "xlsx")}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="csv">CSV</option>
                      <option value="xlsx">Excel (.xlsx)</option>
                    </select>
                  </div>
                  <Button
                    onClick={() => createConnectorMutation.mutate()}
                    disabled={createConnectorMutation.isPending}
                  >
                    {createConnectorMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Create source"
                    )}
                  </Button>
                </div>
              )}
              {createConnectorMutation.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(createConnectorMutation.error, "Could not create the data source.")}{" "}
                  Retry; existing sources with the same name are checked first.
                </p>
              ) : null}
              {selectedConnector ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="source-file">
                      Upload {selectedConnector.type === "csv" ? "CSV" : "Excel"} file
                    </Label>
                    <Input
                      id="source-file"
                      type="file"
                      accept={
                        selectedConnector.type === "csv" ? ".csv,.txt,text/csv" : ".xlsx,.xls"
                      }
                      onChange={(event) => {
                        setUpload(event.target.files?.[0] ?? null);
                        setPreview(null);
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={!upload || previewMutation.isPending}
                      onClick={() =>
                        upload &&
                        previewMutation.mutate({ connector: selectedConnector, file: upload })
                      }
                    >
                      {previewMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing and previewing
                        </>
                      ) : (
                        "Test connection and preview"
                      )}
                    </Button>
                    <Button
                      disabled={
                        !upload ||
                        !hasPreview ||
                        syncMutation.isPending ||
                        syncInProgress ||
                        selectedConnectorStatus?.syncStatus === "succeeded"
                      }
                      onClick={() =>
                        upload &&
                        syncMutation.mutate({ connector: selectedConnector, file: upload })
                      }
                    >
                      {syncMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Waiting for sync
                        </>
                      ) : syncInProgress ? (
                        "Sync in progress"
                      ) : selectedConnectorStatus?.syncStatus === "succeeded" ? (
                        "Import complete"
                      ) : syncFailed ? (
                        "Retry sync"
                      ) : (
                        "Sync data"
                      )}
                    </Button>
                  </div>
                  {previewMutation.isError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {previewMutation.error.message} Select a valid file and retry.
                    </p>
                  ) : null}
                  {syncMutation.isError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {errorMessage(syncMutation.error, "The import failed.")} Check the file and
                      retry.
                    </p>
                  ) : null}
                  {syncInProgress ? (
                    <p role="status" className="text-sm text-muted-foreground">
                      Sync is {selectedConnectorStatus?.syncStatus}. You can leave and return; this
                      status is saved on the server.
                    </p>
                  ) : null}
                  {syncFailed ? (
                    <p role="alert" className="text-sm text-destructive">
                      {selectedConnectorStatus?.lastError || "The previous sync failed."} Select the
                      file again to retry.
                    </p>
                  ) : null}
                  {selectedConnectorStatus?.lastSyncedAt ? (
                    <p className="text-sm text-emerald-700">
                      Last successful sync:{" "}
                      {new Date(selectedConnectorStatus.lastSyncedAt).toLocaleString()}
                    </p>
                  ) : null}
                  {preview ? <PreviewTable preview={preview} /> : null}
                </>
              ) : null}
              {connectors.some(
                (connector) => connector.type !== "csv" && connector.type !== "xlsx",
              ) && !fileConnectors.length ? (
                <p className="text-sm text-muted-foreground">
                  This guided test, preview, and file-sync flow supports CSV and XLSX only. Other
                  connector records are unchanged.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>2. Create or open a dashboard</CardTitle>
                  <CardDescription>
                    Dashboards come from your tenant and resume after sign-in.
                  </CardDescription>
                </div>
              </div>
              {firstDashboard ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Dashboard ready" />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {firstDashboard ? (
                <p className="text-sm text-muted-foreground">
                  Your first dashboard is{" "}
                  <span className="font-medium text-foreground">{firstDashboard.name}</span>.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="dashboard-name">Dashboard name</Label>
                  <Input
                    id="dashboard-name"
                    value={dashboardName}
                    onChange={(event) => setDashboardName(event.target.value)}
                  />
                </div>
              )}
              {firstDashboard ? (
                <Button asChild variant="outline">
                  <AppLink to="/dashboards">
                    Open dashboards <ArrowRight className="ml-2 h-4 w-4" />
                  </AppLink>
                </Button>
              ) : (
                <Button
                  onClick={() => createDashboardMutation.mutate()}
                  disabled={createDashboardMutation.isPending}
                >
                  {createDashboardMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Create dashboard
                </Button>
              )}
              {createDashboardMutation.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(createDashboardMutation.error, "Could not create the dashboard.")}{" "}
                  Retry; existing dashboards are checked first.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <CardTitle>
                  3. Invite teammates{" "}
                  <span className="text-sm font-normal text-muted-foreground">Optional</span>
                </CardTitle>
                <CardDescription>Use a single-use invitation with the Viewer role.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  invitationMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Name</Label>
                  <Input
                    id="invite-name"
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                </div>
                <Button className="sm:col-span-2 sm:w-fit" disabled={invitationMutation.isPending}>
                  {invitationMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Send invitation
                </Button>
              </form>
              {invitationMutation.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(invitationMutation.error, "Could not send the invitation.")} Correct
                  the address or retry.
                </p>
              ) : null}
              <Button asChild variant="ghost" className="px-0">
                <AppLink to="/dashboard">Skip for now and return to workspace</AppLink>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {syncedConnector && firstDashboard ? "Workspace setup complete" : "Setup progress"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ProgressItem label="File source synced" complete={Boolean(syncedConnector)} />
              <ProgressItem label="First dashboard" complete={Boolean(firstDashboard)} />
              {syncedConnector && firstDashboard ? (
                <Button asChild className="w-full">
                  <AppLink to="/dashboard">
                    Open workspace <ArrowRight className="ml-2 h-4 w-4" />
                  </AppLink>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sources and dashboards are checked from the server. Leave and return any time;
                  unfinished uploads can be retried.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workspace records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {connectors.length === 0 && dashboards.length === 0 ? (
                <p>No sources or dashboards yet.</p>
              ) : null}
              {connectors.slice(0, 4).map((connector) => (
                <div key={connector._id} className="rounded-md border border-border p-3">
                  <div className="font-medium text-foreground">{connector.name}</div>
                  <div className="mt-1 uppercase">
                    {connector.type} · {connector.lastSyncedAt ? "synced" : "not synced"}
                  </div>
                </div>
              ))}
              {dashboards.slice(0, 3).map((dashboard) => (
                <div key={dashboard._id} className="rounded-md border border-border p-3">
                  <div className="font-medium text-foreground">{dashboard.name}</div>
                  <div className="mt-1 capitalize">{dashboard.status}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProgressItem({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
      <span>{label}</span>
      <span className={complete ? "font-medium text-emerald-700" : "text-muted-foreground"}>
        {complete ? "Complete" : "Pending"}
      </span>
    </div>
  );
}

function PreviewTable({ preview }: { preview: PreviewResult }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full text-left text-sm">
        <caption className="px-3 py-2 text-left text-muted-foreground">
          Preview sample ({preview.sample.length} rows)
        </caption>
        <thead className="bg-muted/50">
          <tr>
            {preview.fields.map((field) => (
              <th key={field} className="px-3 py-2 font-medium">
                {field}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.sample.map((row, index) => (
            <tr key={index} className="border-t border-border">
              {preview.fields.map((field) => (
                <td key={field} className="max-w-48 truncate px-3 py-2">
                  {String(row[field] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
