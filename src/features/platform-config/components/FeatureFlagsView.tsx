/**
 * Feature flags (roadmap 2.4): roll features out to every workspace, an
 * allow-list of workspaces, or a stable percentage of workspaces (bucketed
 * by tenant id, so a workspace's assignment never flips between requests).
 * Every change is versioned, audited and reversible.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  InlineFieldErrors,
  TableSkeleton,
} from "@/components/common/states";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as configApi from "@/features/platform-config/api";
import { RevisionHistory } from "@/features/platform-config/components/RevisionHistory";
import { configErrorMessage } from "@/features/platform-config/errors";
import type {
  FeatureFlag,
  FeatureFlagRollout,
  RolloutStrategy,
} from "@/features/platform-config/types";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

const selectClass = "border-input bg-background w-full rounded-md border px-3 py-2 text-sm";
const STRATEGIES: { value: Exclude<RolloutStrategy, "attribute">; label: string }[] = [
  { value: "all", label: "Every workspace" },
  { value: "tenantId", label: "Allow-listed workspaces" },
  { value: "percentage", label: "Percentage of workspaces" },
];

function describeRollout(flag: Pick<FeatureFlag, "enabled" | "rollout">) {
  if (!flag.enabled) return "Off everywhere";
  const { strategy, tenantIds, percentage } = flag.rollout;
  if (strategy === "all") return "Every workspace";
  if (strategy === "tenantId") {
    return tenantIds.length === 1 ? "1 workspace" : `${tenantIds.length} workspaces`;
  }
  if (strategy === "percentage") return `${percentage}% of workspaces`;
  return "Unsupported strategy";
}

function parseTenantIds(text: string) {
  return text
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function FeatureFlagsView() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.FEATURE_FLAGS_VIEW);
  const canCreate = hasPermission(permissions, Permissions.FEATURE_FLAGS_CREATE);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: [...configApi.configKeys.flags, { search }],
    queryFn: () => configApi.listFlags({ search: search.trim() || undefined, limit: 100 }),
    enabled: canView,
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Feature flags" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (query.isError) {
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Feature flags" />
    );
  }
  const flags = query.data?.data ?? [];
  const selected = flags.find((flag) => flag.key === selectedKey) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1 space-y-1">
          <Label htmlFor="flags-search">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="flags-search"
              className="pl-8"
              placeholder="Key or name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        {canCreate ? (
          <Button
            onClick={() => {
              setCreating(true);
              setSelectedKey(null);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> New flag
          </Button>
        ) : null}
      </div>

      {creating ? (
        <CreateFlagForm
          onDone={(key) => {
            setCreating(false);
            if (key) setSelectedKey(key);
          }}
        />
      ) : null}

      {flags.length === 0 ? (
        <EmptyState title="No feature flags" description="Create a flag to start a rollout." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Flag</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Rollout</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.key} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{flag.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{flag.key}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={flag.enabled ? "default" : "secondary"}>
                        {flag.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      {flag.isSystem ? <Badge variant="outline">system</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">{describeRollout(flag)}</td>
                  <td className="px-3 py-2">v{flag.version}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant={selectedKey === flag.key ? "default" : "outline"}
                      aria-label={`Open ${flag.key}`}
                      onClick={() => {
                        setSelectedKey(flag.key);
                        setCreating(false);
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <FlagDetail
          key={`${selected.key}:${selected.version}`}
          flag={selected}
          onDeleted={() => setSelectedKey(null)}
        />
      ) : null}

      <FlagPreview />
    </div>
  );
}

function CreateFlagForm({ onDone }: { onDone: (key?: string) => void }) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<unknown>(null);
  const create = useMutation({
    mutationFn: () =>
      configApi.createFlag({ key: key.trim(), name: name.trim(), description: description.trim() }),
    onSuccess: (flag) => {
      toast.success(`Flag ${flag.key} created (disabled)`);
      void queryClient.invalidateQueries({ queryKey: [...configApi.configKeys.flags] });
      onDone(flag.key);
    },
    onError: (err) => {
      setError(err);
      toast.error(configErrorMessage(err));
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New feature flag</CardTitle>
        <CardDescription>
          New flags start disabled. Choose the rollout after creating the flag.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="new-flag-key">Key</Label>
            <Input
              id="new-flag-key"
              placeholder="area.feature_name"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-flag-name">Name</Label>
            <Input
              id="new-flag-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="new-flag-description">Description</Label>
            <Input
              id="new-flag-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error ? (
            <div className="md:col-span-2">
              <InlineFieldErrors error={error} />
            </div>
          ) : null}
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={create.isPending || !key.trim() || !name.trim()}>
              <Save className="mr-1 h-4 w-4" /> Create flag
            </Button>
            <Button type="button" variant="outline" onClick={() => onDone()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FlagDetail({ flag, onDeleted }: { flag: FeatureFlag; onDeleted: () => void }) {
  const { permissions } = useAdminSession();
  const queryClient = useQueryClient();
  const canUpdate = hasPermission(permissions, Permissions.FEATURE_FLAGS_UPDATE);
  const canDelete = hasPermission(permissions, Permissions.FEATURE_FLAGS_DELETE) && !flag.isSystem;
  const editable = canUpdate && !flag.isReadonly;

  const [name, setName] = useState(flag.name);
  const [description, setDescription] = useState(flag.description);
  const [enabled, setEnabled] = useState(flag.enabled);
  const [strategy, setStrategy] = useState<RolloutStrategy>(flag.rollout.strategy);
  const [percentage, setPercentage] = useState(String(flag.rollout.percentage));
  const [tenantIds, setTenantIds] = useState(flag.rollout.tenantIds.join("\n"));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [...configApi.configKeys.flags] });
  const onError = (err: unknown) => {
    setError(err);
    toast.error(configErrorMessage(err));
  };

  const save = useMutation({
    mutationFn: () => {
      const rollout: Partial<FeatureFlagRollout> = { strategy };
      if (strategy === "percentage") {
        rollout.percentage = percentage.trim() === "" ? Number.NaN : Number(percentage);
      }
      if (strategy === "tenantId") rollout.tenantIds = parseTenantIds(tenantIds);
      return configApi.updateFlag(flag.key, {
        name,
        description,
        enabled,
        rollout,
        version: flag.version,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: (saved) => {
      setError(null);
      toast.success(`${saved.key} saved (version ${saved.version})`);
      void refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => configApi.deleteFlag(flag.key, { version: flag.version }),
    onSuccess: () => {
      toast.success(`${flag.key} deleted`);
      onDeleted();
      void refresh();
    },
    onError,
  });
  const rollback = useMutation({
    mutationFn: (toVersion: number) =>
      configApi.rollbackFlag(flag.key, { toVersion, version: flag.version }),
    onSuccess: (saved) => {
      toast.success(`${saved.key} restored`);
      void refresh();
    },
    onError,
  });
  const busy = save.isPending || remove.isPending || rollback.isPending;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{flag.name}</CardTitle>
          <CardDescription className="font-mono">{flag.key}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="flag-name">Name</Label>
              <Input
                id="flag-name"
                value={name}
                disabled={!editable || busy}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="flag-description">Description</Label>
              <Input
                id="flag-description"
                value={description}
                disabled={!editable || busy}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!editable || busy}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              Enabled (master switch)
            </label>
            <div className="space-y-1">
              <Label htmlFor="flag-strategy">Rollout</Label>
              <select
                id="flag-strategy"
                className={selectClass}
                value={strategy}
                disabled={!editable || busy}
                onChange={(event) => setStrategy(event.target.value as RolloutStrategy)}
              >
                {STRATEGIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {strategy === "percentage" ? (
              <div className="space-y-1">
                <Label htmlFor="flag-percentage">Percentage of workspaces (0–100)</Label>
                <Input
                  id="flag-percentage"
                  inputMode="numeric"
                  value={percentage}
                  disabled={!editable || busy}
                  onChange={(event) => setPercentage(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Each workspace is bucketed by its id, so its assignment stays the same as you
                  raise the percentage.
                </p>
              </div>
            ) : null}
            {strategy === "tenantId" ? (
              <div className="space-y-1">
                <Label htmlFor="flag-tenants">Workspace ids (one per line)</Label>
                <Textarea
                  id="flag-tenants"
                  rows={4}
                  className="font-mono text-xs"
                  value={tenantIds}
                  disabled={!editable || busy}
                  onChange={(event) => setTenantIds(event.target.value)}
                />
              </div>
            ) : null}
            {editable ? (
              <div className="space-y-1">
                <Label htmlFor="flag-reason">Reason (optional, kept in history)</Label>
                <Input
                  id="flag-reason"
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {flag.isReadonly
                  ? "This flag is read-only."
                  : "Changing flags needs the feature_flags.update permission."}
              </p>
            )}
            {error ? <InlineFieldErrors error={error} /> : null}
            <div className="flex flex-wrap gap-2">
              {editable ? (
                <Button type="submit" disabled={busy}>
                  <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
                </Button>
              ) : null}
              {canDelete ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={busy}>
                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {flag.key}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The feature turns off for every workspace. The history is kept and the flag
                        can be restored from it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <RevisionHistory<{ enabled?: boolean; rollout?: FeatureFlagRollout; deleted?: boolean }>
        title="History"
        queryKey={configApi.configKeys.flagHistory(flag.key)}
        load={() => configApi.flagHistory(flag.key, { limit: 50 })}
        currentVersion={flag.version}
        canRestore={editable}
        restoring={rollback.isPending}
        onRestore={(revision) => rollback.mutate(revision.version)}
        isRestorable={(revision) => !revision.state?.deleted}
        renderState={(revision) =>
          revision.state?.deleted ? (
            <span className="text-muted-foreground">Deleted</span>
          ) : revision.state?.rollout ? (
            <span>
              {describeRollout({
                enabled: Boolean(revision.state.enabled),
                rollout: revision.state.rollout,
              })}
            </span>
          ) : null
        }
      />
    </div>
  );
}

function FlagPreview() {
  const [tenantId, setTenantId] = useState("");
  const [submitted, setSubmitted] = useState("");
  const query = useQuery({
    queryKey: [...configApi.configKeys.flags, "preview", submitted],
    queryFn: () => configApi.previewFlags(submitted),
    enabled: Boolean(submitted),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Check a workspace</CardTitle>
        <CardDescription>See which flags a workspace gets, and why.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(tenantId.trim());
          }}
        >
          <div className="min-w-72 flex-1 space-y-1">
            <Label htmlFor="flag-preview-tenant">Workspace id</Label>
            <Input
              id="flag-preview-tenant"
              className="font-mono"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!tenantId.trim()}>
            Check
          </Button>
        </form>
        {query.isError ? <ErrorState error={query.error} resource="Workspace" /> : null}
        {query.data ? (
          <ul className="space-y-1 text-sm" aria-label="Flag outcomes">
            {query.data.map((entry) => (
              <li key={entry.key} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{entry.key}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={entry.value ? "default" : "secondary"}>
                    {entry.value ? "On" : "Off"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {entry.reason.replaceAll("_", " ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
