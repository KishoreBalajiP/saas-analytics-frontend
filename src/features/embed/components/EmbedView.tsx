import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, EmptyState, TableSkeleton } from "@/components/common/states";
import { WidgetView } from "@/components/common/WidgetView";
import { DataTable } from "@/components/common/DataTable";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as dashboardsApi from "@/features/dashboards/api";
import * as embedApi from "@/features/embed/api";
import type { DashboardExecutionEntry, EmbedToken, PaginationMeta } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function EmbedView() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.EMBED_VIEW);
  const canCreate = hasPermission(permissions, Permissions.EMBED_CREATE);
  const canDelete = hasPermission(permissions, Permissions.EMBED_DELETE);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({
    queryKey: ["embed", "tokens", page],
    queryFn: () => embedApi.list({ page, limit: 20 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Embed tokens" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={5} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Embed tokens" />
    );
  const tokens = query.data?.data ?? [];
  const meta = query.data?.meta as PaginationMeta | undefined;
  return (
    <div className="space-y-4">
      {canCreate && (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create embed token
        </Button>
      )}
      {tokens.length ? (
        <EmbedTable
          tokens={tokens}
          {...(meta ? { meta } : {})}
          setPage={setPage}
          canDelete={canDelete}
        />
      ) : (
        <EmptyState
          title="No embed tokens"
          description="Create a short-lived token for a published dashboard or widget."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>Create embed token</Button>
            ) : undefined
          }
        />
      )}
      {createOpen && <EmbedTokenForm onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function EmbedTable({
  tokens,
  meta,
  setPage,
  canDelete,
}: {
  tokens: EmbedToken[];
  meta?: PaginationMeta;
  setPage: (page: number) => void;
  canDelete: boolean;
}) {
  const client = useQueryClient();
  const revoke = useMutation({
    mutationFn: (id: string) => embedApi.revoke(id),
    onSuccess: () => {
      toast.success("Embed token revoked");
      void client.invalidateQueries({ queryKey: ["embed"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to revoke token"),
  });
  const columns = [
    {
      key: "name",
      header: "Name",
      render: (token: EmbedToken) => (
        <span className="font-medium">{token.name || "Unnamed token"}</span>
      ),
    },
    {
      key: "dashboardId",
      header: "Dashboard",
      render: (token: EmbedToken) => <code className="text-xs">{token.dashboardId}</code>,
    },
    {
      key: "widgetId",
      header: "Widget",
      render: (token: EmbedToken) => (
        <code className="text-xs">{token.widgetId || "Dashboard"}</code>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (token: EmbedToken) => (
        <Badge variant={token.status === "active" ? "default" : "secondary"} className="capitalize">
          {token.status}
        </Badge>
      ),
    },
    {
      key: "expiresAt",
      header: "Expires",
      render: (token: EmbedToken) => (
        <span className="text-xs text-muted-foreground">{date(token.expiresAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (token: EmbedToken) =>
        canDelete && token.status === "active" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Revoke ${token.name || token.dashboardId}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke embed token?</AlertDialogTitle>
                <AlertDialogDescription>
                  Any existing embed using this token will stop working.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => revoke.mutate(token.id)}
                  disabled={revoke.isPending}
                >
                  Revoke
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null,
    },
  ];
  const rows = tokens as Array<EmbedToken & Record<string, unknown>>;
  return (
    <DataTable
      columns={columns as never}
      data={rows}
      {...(meta ? { meta } : {})}
      onPageChange={setPage}
      getRowId={(token) => String(token["id"])}
    />
  );
}

function EmbedTokenForm({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const dashboards = useQuery({
    queryKey: ["dashboards", "list", { limit: 200 }],
    queryFn: () => dashboardsApi.list({ limit: 200 }),
  });
  const [dashboardId, setDashboardId] = useState("");
  const [widgetId, setWidgetId] = useState("");
  const [name, setName] = useState("");
  const [ttl, setTtl] = useState("3600");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const ttlSec = Number(ttl);
      if (!dashboardId) throw new Error("Dashboard is required.");
      if (!Number.isInteger(ttlSec) || ttlSec <= 0)
        throw new Error("TTL must be a positive number of seconds.");
      return embedApi.create({
        dashboardId,
        ...(widgetId ? { widgetId } : {}),
        ...(name.trim() ? { name: name.trim() } : {}),
        ttlSec,
      });
    },
    onSuccess: (result) => {
      setSecret(result.secret);
      setError("");
      void client.invalidateQueries({ queryKey: ["embed"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Unable to create embed token"),
  });
  const dashboardRows = dashboards.data?.data ?? [];
  if (secret) {
    const url = embedApi.embedPublicUrl(secret);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Embed token created</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">
            Copy this token and URL now. The token is shown once and is not persisted by this page.
          </p>
          <div className="flex gap-2">
            <Input readOnly type="password" value={secret} aria-label="One-time embed token" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void navigator.clipboard?.writeText(secret)}
              aria-label="Copy embed token"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label="Public embed URL" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void navigator.clipboard?.writeText(url)}
              aria-label="Copy embed URL"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <EmbedPreview token={secret} />
          <Button onClick={onClose}>Done</Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create embed token</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Label>
            Name
            <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </Label>
          <Label>
            Dashboard
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={dashboardId}
              onChange={(event) => setDashboardId(event.target.value)}
            >
              <option value="">Select a dashboard</option>
              {dashboardRows.map((dashboard) => (
                <option key={dashboard._id} value={dashboard._id}>
                  {dashboard.name}
                </option>
              ))}
            </select>
          </Label>
          <Label>
            Widget ID (optional)
            <Input value={widgetId} onChange={(event) => setWidgetId(event.target.value)} />
          </Label>
          <Label>
            Lifetime in seconds
            <Input
              type="number"
              min="1"
              value={ttl}
              onChange={(event) => setTtl(event.target.value)}
            />
          </Label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create token"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function EmbedPreview({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["embed", "preview"],
    queryFn: () => embedApi.getEmbed(token),
    enabled: Boolean(token),
  });
  if (query.isLoading) return <TableSkeleton rows={3} cols={2} />;
  if (query.isError) return <ErrorState error={query.error} resource="Embedded analytics" />;
  const entries = query.data ?? [];
  if (!entries.length) return <EmptyState title="No embedded data" />;
  return (
    <div className="space-y-3">
      {entries.map((entry: DashboardExecutionEntry) => (
        <Card key={entry.widgetId}>
          <CardHeader>
            <CardTitle className="text-sm">{entry.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {entry.error ? (
              <ErrorState error={new Error(entry.error.message)} resource={entry.name} />
            ) : (
              <WidgetView type={entry.type} result={entry.result} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
