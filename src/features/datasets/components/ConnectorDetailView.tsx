import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Database,
  FileSpreadsheet,
  Globe,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CopyableValue } from "@/features/datasets/components/FileUploadZone";
import { FileUploadZone } from "@/features/datasets/components/FileUploadZone";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { AppLink } from "@/components/common/AppLink";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as connectorsApi from "@/features/datasets/api";
import type { ConnectorType, PaginationMeta, PreviewResult } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

const TYPE_ICONS: Record<ConnectorType, React.ComponentType<{ className?: string }>> = {
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  mongodb: Database,
  webhook: Webhook,
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusVariant(status: string) {
  if (status === "active") return "default" as const;
  if (status === "paused") return "secondary" as const;
  return "destructive" as const;
}

function ConfigSummary({ summary }: { summary: Record<string, unknown> }) {
  return (
    <dl className="space-y-2 text-sm">
      {Object.entries(summary).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <dt className="w-40 shrink-0 text-muted-foreground">
            {key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
          </dt>
          <dd className="font-mono text-xs break-all">
            {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "—")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ConnectorDetailView({ connectorId }: { connectorId: string }) {
  const { permissions } = useTenantSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [dataPage, setDataPage] = useState(1);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);

  const canView = hasPermission(permissions, Permissions.CONNECTORS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.CONNECTORS_UPDATE);
  const canDelete = hasPermission(permissions, Permissions.CONNECTORS_DELETE);
  const canSync = hasPermission(permissions, Permissions.CONNECTORS_SYNC);
  const canPreview = hasPermission(permissions, Permissions.CONNECTORS_PREVIEW);

  const connectorQuery = useQuery({
    queryKey: ["connector", connectorId],
    queryFn: () => connectorsApi.get(connectorId),
    enabled: canView && !!connectorId,
  });

  const rowsQuery = useQuery({
    queryKey: ["connector", connectorId, "rows", dataPage],
    queryFn: () => connectorsApi.listRows(connectorId, { page: dataPage, limit: 25 }),
    enabled: canView && tab === "data" && !!connectorId,
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => connectorsApi.update(connectorId, { status: newStatus }),
    onSuccess: () => {
      toast.success("Status updated");
      connectorQuery.refetch();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => connectorsApi.remove(connectorId),
    onSuccess: () => {
      toast.success("Connector deleted");
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete"),
  });

  const previewMutation = useMutation({
    mutationFn: (file: File) => connectorsApi.previewFile(connectorId, file),
    onSuccess: (result) => {
      setPreviewResult(result);
      toast.success("Preview generated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Preview failed"),
  });

  const syncFileMutation = useMutation({
    mutationFn: (file: File) => connectorsApi.syncFile(connectorId, file),
    onSuccess: (result) => {
      toast.success(`Sync queued: ${result.filename ?? "file"}`);
      connectorQuery.refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sync failed"),
  });

  const syncMongoMutation = useMutation({
    mutationFn: () => connectorsApi.syncMongoDB(connectorId),
    onSuccess: () => {
      toast.success("MongoDB sync queued");
      connectorQuery.refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sync failed"),
  });

  const validateMutation = useMutation({
    mutationFn: () => connectorsApi.validate(connectorId),
    onSuccess: (result) => {
      if (result.valid) toast.success("Connector is valid");
      else toast.error(`Validation failed: ${result.errors?.join(", ") ?? "unknown error"}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Validation failed"),
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Connector" />;

  if (connectorQuery.isLoading) {
    return (
      <>
        <PageHeader
          title="Loading…"
          crumbs={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "Datasets", to: "/datasets" },
            { label: "…" },
          ]}
        />
        <TableSkeleton rows={3} cols={2} />
      </>
    );
  }

  if (connectorQuery.isError) {
    return (
      <>
        <PageHeader
          title="Error"
          crumbs={[
            { label: "Dashboard", to: "/dashboard" },
            { label: "Datasets", to: "/datasets" },
            { label: "Error" },
          ]}
        />
        <ErrorState
          error={connectorQuery.error}
          onRetry={() => connectorQuery.refetch()}
          resource="Connector"
        />
      </>
    );
  }

  const connector = connectorQuery.data;
  if (!connector) return null;

  const Icon = TYPE_ICONS[connector.type];

  const crumbs = [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Datasets", to: "/datasets" },
    { label: connector.name },
  ];

  const rowColumns: Column<Record<string, unknown>>[] = connector.configSummary
    ? Object.keys({ _id: "", ...(rowsQuery.data?.data?.[0] ?? {}) })
        .filter((k) => k !== "_id")
        .map((key) => ({
          key,
          header: key,
        }))
    : [];

  return (
    <>
      <PageHeader
        title={connector.name}
        description={`${connector.type.toUpperCase()} connector`}
        crumbs={crumbs}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(connector.status)} className="capitalize">
              {connector.status}
            </Badge>
            {canUpdate && connector.status === "paused" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate("active")}
                disabled={statusMutation.isPending}
              >
                <Play className="mr-1 h-3.5 w-3.5" /> Resume
              </Button>
            )}
            {canUpdate && connector.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate("paused")}
                disabled={statusMutation.isPending}
              >
                <Pause className="mr-1 h-3.5 w-3.5" /> Pause
              </Button>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {connector.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All ingested data will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        deleteMutation.mutate();
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          {(connector.type === "csv" || connector.type === "xlsx") && canPreview && (
            <TabsTrigger value="preview">Preview</TabsTrigger>
          )}
          {canSync && <TabsTrigger value="sync">Sync</TabsTrigger>}
          {connector.type === "webhook" && <TabsTrigger value="webhook">Webhook</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-semibold">Details</h3>
            <Separator className="my-3" />
            <dl className="space-y-3 text-sm">
              <div className="flex gap-2">
                <dt className="w-36 text-muted-foreground">Type</dt>
                <dd className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4" /> {connector.type.toUpperCase()}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-36 text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={statusVariant(connector.status)} className="capitalize">
                    {connector.status}
                  </Badge>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-36 text-muted-foreground">Last synced</dt>
                <dd>{formatDate(connector.lastSyncedAt)}</dd>
              </div>
              {connector.lastError && (
                <div className="flex gap-2">
                  <dt className="w-36 text-destructive">Last error</dt>
                  <dd className="text-destructive">{connector.lastError}</dd>
                </div>
              )}
              {connector.errorCount != null && connector.errorCount > 0 && (
                <div className="flex gap-2">
                  <dt className="w-36 text-muted-foreground">Error count</dt>
                  <dd>{connector.errorCount}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-36 text-muted-foreground">Created</dt>
                <dd>{formatDate(connector.createdAt)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-36 text-muted-foreground">Updated</dt>
                <dd>{formatDate(connector.updatedAt)}</dd>
              </div>
            </dl>
          </div>

          {connector.configSummary && Object.keys(connector.configSummary).length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-semibold">Configuration</h3>
              <Separator className="my-3" />
              <ConfigSummary summary={connector.configSummary} />
            </div>
          )}

          {connector.fieldMapping && Object.keys(connector.fieldMapping).length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-sm font-semibold">Field Mapping</h3>
              <Separator className="my-3" />
              <ConfigSummary summary={connector.fieldMapping} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="data" className="pt-4">
          {rowsQuery.isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : rowsQuery.isError ? (
            <ErrorState
              error={rowsQuery.error}
              onRetry={() => rowsQuery.refetch()}
              resource="Rows"
            />
          ) : (
            <DataTable
              columns={
                rowColumns.length
                  ? rowColumns
                  : [{ key: "_index", header: "#", render: (_, i) => i + 1 }]
              }
              data={(rowsQuery.data?.data ?? []) as Record<string, unknown>[]}
              meta={rowsQuery.data?.meta as PaginationMeta}
              onPageChange={setDataPage}
              getRowId={(row, i) =>
                String(
                  (row as Record<string, unknown>)["id"] ??
                    (row as Record<string, unknown>)["_id"] ??
                    i,
                )
              }
              emptyMessage="No rows ingested yet."
            />
          )}
        </TabsContent>

        <TabsContent value="preview" className="space-y-4 pt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-semibold">Upload file for preview</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Preview shows the first few rows without modifying your dataset.
            </p>
            <FileUploadZone
              label={`Drop a .${connector.type === "csv" ? "csv" : "xlsx"} file here`}
              accept={connector.type === "csv" ? ".csv,.txt" : ".xlsx,.xls"}
              isProcessing={previewMutation.isPending}
              onFileSelect={(file) => previewMutation.mutate(file)}
            />
          </div>

          {previewResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Fields: {previewResult.fields.length}</span>
                <span>Rows: {previewResult.sample.length}</span>
                {previewResult.meta && (
                  <>
                    {previewResult.meta["delimiter"] && (
                      <span>Delimiter: {String(previewResult.meta["delimiter"])}</span>
                    )}
                    {previewResult.meta["hasHeader"] != null && (
                      <span>Headers: {previewResult.meta["hasHeader"] ? "Yes" : "No"}</span>
                    )}
                    {previewResult.meta["sheetName"] && (
                      <span>Sheet: {String(previewResult.meta["sheetName"])}</span>
                    )}
                  </>
                )}
              </div>
              <DataTable
                columns={previewResult.fields.map((f) => ({ key: f, header: f }))}
                data={previewResult.sample as Record<string, unknown>[]}
                emptyMessage="No sample rows."
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="sync" className="space-y-4 pt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-sm font-semibold">Sync data</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {connector.type === "mongodb"
                ? "Pull the latest data from your MongoDB collection."
                : `Upload a .${connector.type} file to sync data into this connector.`}
            </p>

            {connector.type === "mongodb" ? (
              <div className="mt-4">
                <Button
                  onClick={() => syncMongoMutation.mutate()}
                  disabled={!canSync || syncMongoMutation.isPending}
                >
                  {syncMongoMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync now
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Data is pulled from MongoDB asynchronously.
                </p>
              </div>
            ) : (
              <FileUploadZone
                label={`Drop a .${connector.type === "csv" ? "csv" : "xlsx"} file to sync`}
                accept={connector.type === "csv" ? ".csv,.txt" : ".xlsx,.xls"}
                isProcessing={syncFileMutation.isPending}
                onFileSelect={(file) => syncFileMutation.mutate(file)}
              />
            )}
          </div>
        </TabsContent>

        {connector.type === "webhook" && (
          <TabsContent value="webhook" className="space-y-4 pt-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Globe className="h-4 w-4" /> Webhook Endpoint
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Send data to this endpoint using HMAC-SHA256 signed payloads.
              </p>

              {connector.webhookToken && (
                <div className="mt-4 space-y-4">
                  <CopyableValue
                    label="Endpoint URL"
                    value={`/webhooks/${connector.webhookToken}`}
                  />
                  <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-success">
                    <AlertCircle className="mr-1 inline h-3 w-3" />
                    The signing secret is never shown after creation.
                  </div>
                </div>
              )}

              {canSync && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending}
                  >
                    {validateMutation.isPending ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Validate
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
