import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Copy, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/DataTable";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  API_KEY_SCOPES,
  type ApiKey,
  type ApiKeyScope,
  type PaginationMeta,
} from "@/lib/api/types";
import * as apiKeysApi from "@/features/api-keys/api";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";
import { useFeature } from "@/features/billing/hooks";

import { KeyUsagePanel } from "./KeyUsagePanel";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function ApiKeysView() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.API_KEYS_VIEW);
  const apiAccess = useFeature("api_access");
  // Plan entitlement: never offer creating a key the API would refuse.
  const canCreate =
    hasPermission(permissions, Permissions.API_KEYS_CREATE) &&
    (!apiAccess.known || apiAccess.enabled);
  const canDelete = hasPermission(permissions, Permissions.API_KEYS_DELETE);
  const canUpdate =
    hasPermission(permissions, Permissions.API_KEYS_UPDATE) &&
    (!apiAccess.known || apiAccess.enabled);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({
    queryKey: ["api-keys", "list", page],
    queryFn: () => apiKeysApi.list({ page, limit: 20 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="API keys" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={5} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="API keys" />;
  const keys = query.data?.data ?? [];
  const meta = query.data?.meta as PaginationMeta | undefined;
  return (
    <div className="space-y-4">
      {canCreate && (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create API key
        </Button>
      )}
      {keys.length ? (
        <ApiKeyTable
          keys={keys}
          {...(meta ? { meta } : {})}
          setPage={setPage}
          canDelete={canDelete}
          canUpdate={canUpdate}
        />
      ) : (
        <EmptyState
          title="No API keys"
          description="Create a scoped key for external read-only API access."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>Create API key</Button>
            ) : undefined
          }
        />
      )}
      {createOpen && <ApiKeyForm onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function ApiKeyTable({
  keys,
  meta,
  setPage,
  canDelete,
  canUpdate,
}: {
  keys: ApiKey[];
  meta?: PaginationMeta;
  setPage: (page: number) => void;
  canDelete: boolean;
  canUpdate: boolean;
}) {
  const client = useQueryClient();
  const [usageFor, setUsageFor] = useState<string | null>(null);
  const [rotated, setRotated] = useState<apiKeysApi.RotateResult | null>(null);
  const rotate = useMutation({
    mutationFn: (id: string) => apiKeysApi.rotate(id),
    onSuccess: (result) => {
      setRotated(result);
      void client.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to rotate API key"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      toast.success("API key revoked");
      void client.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to revoke API key"),
  });
  const columns: Column<ApiKey & Record<string, unknown>>[] = [
    {
      key: "name",
      header: "Name",
      render: (key) => <span className="font-medium">{key.name}</span>,
    },
    {
      key: "prefix",
      header: "Prefix",
      // The credential is `<prefix>.<secret>`: show the prefix as the start
      // of the key so it can be matched against what an integration sends.
      render: (key) => <code className="text-xs">{`${key.prefix}.••••`}</code>,
    },
    {
      key: "scopes",
      header: "Scopes",
      render: (key) => (
        <div className="flex flex-wrap gap-1">
          {key.scopes.map((scope) => (
            <Badge key={scope} variant="outline">
              {scope}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (key) => (
        <Badge variant={key.status === "active" ? "default" : "secondary"} className="capitalize">
          {key.status}
        </Badge>
      ),
    },
    {
      key: "expiresAt",
      header: "Expires",
      render: (key) => <span className="text-xs text-muted-foreground">{date(key.expiresAt)}</span>,
    },
    {
      key: "lastUsedAt",
      header: "Last used",
      render: (key) => (
        <span className="text-xs text-muted-foreground">
          {date(key.lastUsedAt)}
          {key.lastUsedIp ? ` · ${key.lastUsedIp}` : ""}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (key) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Usage of ${key.name}`}
            onClick={() => setUsageFor(usageFor === key.id ? null : key.id)}
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </Button>
          {canUpdate && key.status === "active" && !key.rotatedTo ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" aria-label={`Rotate ${key.name}`}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rotate API key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A new secret is created. {key.name} keeps working for a short overlap window so
                    you can deploy the new secret, then it expires.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => rotate.mutate(key.id)}
                    disabled={rotate.isPending}
                  >
                    Rotate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          {canDelete && key.status === "active" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" aria-label={`Revoke ${key.name}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {key.name} will stop authenticating immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => revoke.mutate(key.id)}
                    disabled={revoke.isPending}
                  >
                    Revoke
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      ),
    },
  ];
  const rows = keys as Array<ApiKey & Record<string, unknown>>;
  return (
    <div className="space-y-4">
      {rotated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> New secret
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">
              Copy this secret now. The old key stops working at {date(rotated.overlapEndsAt)}.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={rotated.secret}
                type="password"
                aria-label="Rotated API key secret"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigator.clipboard?.writeText(rotated.secret)}
                aria-label="Copy rotated secret"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => setRotated(null)}>Done</Button>
          </CardContent>
        </Card>
      )}
      <DataTable
        columns={columns}
        data={rows}
        {...(meta ? { meta } : {})}
        onPageChange={setPage}
        getRowId={(key) => String(key["id"])}
      />
      {usageFor && (
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyUsagePanel keyId={usageFor} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApiKeyForm({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [scopes, setScopes] = useState<ApiKeyScope[]>([]);
  const [ips, setIps] = useState("");
  const catalogue = useQuery({ queryKey: ["api-keys", "scopes"], queryFn: apiKeysApi.scopes });
  const maxTtlDays = catalogue.data?.maxTtlDays ?? null;
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error("Name is required.");
      if (!scopes.length) throw new Error("Select at least one scope.");
      const ipAllowList = ips
        .split(/[\s,]+/)
        .map((ip) => ip.trim())
        .filter(Boolean);
      if (expiresAt && maxTtlDays) {
        const limit = Date.now() + maxTtlDays * 86_400_000;
        if (new Date(`${expiresAt}T23:59:59Z`).getTime() > limit)
          throw new Error(`Expiration must be within ${maxTtlDays} days.`);
      }
      return apiKeysApi.create({
        name: name.trim(),
        scopes,
        ...(ipAllowList.length ? { ipAllowList } : {}),
        ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T23:59:59Z`).toISOString() } : {}),
      });
    },
    onSuccess: (result) => {
      setError("");
      setSecret(result.secret);
      void client.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Unable to create API key"),
  });
  function toggle(scope: ApiKeyScope) {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  }
  if (secret)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> API key secret
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">
            Copy this secret now. It will not be shown again and is not stored by this page.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={secret} type="password" aria-label="One-time API key secret" />
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigator.clipboard?.writeText(secret)}
              aria-label="Copy API key secret"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={onClose}>Done</Button>
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create API key</CardTitle>
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
            Expiration
            <Input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </Label>
          {maxTtlDays ? (
            <p className="text-xs text-muted-foreground">
              Keys expire after at most {maxTtlDays} days (default when left empty).
            </p>
          ) : null}
          <Label>
            Allowed client IPs (optional, comma separated; IPs or CIDR)
            <Input
              value={ips}
              placeholder="203.0.113.0/24"
              onChange={(event) => setIps(event.target.value)}
            />
          </Label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Scopes</legend>
            {API_KEY_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() => toggle(scope)}
                />
                {scope}
              </label>
            ))}
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create key"}
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
