/**
 * Platform settings (roadmap 2.4): the platform value of every catalogue
 * setting, which workspaces inherit unless they override it. Edits are
 * validated per key by the backend, versioned, audited and reversible.
 * Secret settings are masked; revealing one needs `settings.secrets.view`
 * and changing one needs `settings.secrets.update`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, Pencil, RotateCcw, Save, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  InlineFieldErrors,
  TableSkeleton,
} from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as configApi from "@/features/platform-config/api";
import { RevisionHistory } from "@/features/platform-config/components/RevisionHistory";
import { configErrorMessage } from "@/features/platform-config/errors";
import type { PlatformSetting } from "@/features/platform-config/types";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

const selectClass = "border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

/** Display form of a stored value. */
function formatSettingValue(setting: Pick<PlatformSetting, "type">, value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (setting.type === "json") return JSON.stringify(value);
  return String(value);
}

function initialDraft(setting: PlatformSetting): string {
  if (setting.isSecret) return "";
  if (setting.type === "json") return JSON.stringify(setting.value ?? null, null, 2);
  if (setting.value === null || setting.value === undefined) return "";
  return String(setting.value);
}

/** Convert the form text to the value sent to the server (which validates it). */
function toValue(setting: PlatformSetting, draft: string): unknown {
  if (setting.type === "boolean") return draft === "true";
  if (setting.type === "number" || setting.type === "duration") {
    const trimmed = draft.trim();
    return trimmed !== "" && Number.isFinite(Number(trimmed)) ? Number(trimmed) : trimmed;
  }
  return draft;
}

export function PlatformSettingsView() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.SETTINGS_VIEW);
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [...configApi.configKeys.settings, { group, search }],
    queryFn: () =>
      configApi.listSettings({ group: group || undefined, search: search.trim() || undefined }),
    enabled: canView,
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Platform settings" />;
  if (query.isLoading) return <TableSkeleton rows={6} cols={4} />;
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => query.refetch()}
        resource="Platform settings"
      />
    );
  }
  const settings = query.data?.data ?? [];
  const groups = query.data?.groups ?? [];
  const selected = settings.find((setting) => setting.key === selectedKey) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="settings-group">Group</Label>
          <select
            id="settings-group"
            className={selectClass}
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          >
            <option value="">All groups</option>
            {groups.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-60 flex-1 space-y-1">
          <Label htmlFor="settings-search">Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="settings-search"
              className="pl-8"
              placeholder="Key or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      {settings.length === 0 ? (
        <EmptyState title="No settings match" description="Try another group or search term." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Setting</th>
                <th className="px-3 py-2">Platform value</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.key} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs">{setting.key}</div>
                    <div className="text-xs text-muted-foreground">{setting.description}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {setting.isSecret ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Lock className="h-3.5 w-3.5" />
                          {setting.hasValue ? "•••••••• (set)" : "Not set"}
                        </span>
                      ) : (
                        <span className="break-all font-mono text-xs">
                          {formatSettingValue(setting, setting.value)}
                        </span>
                      )}
                      {setting.source === "default" ? (
                        <Badge variant="outline">default</Badge>
                      ) : null}
                      {setting.isReadonly ? <Badge variant="secondary">read-only</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">v{setting.version}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant={selectedKey === setting.key ? "default" : "outline"}
                      onClick={() => setSelectedKey(setting.key)}
                      aria-label={`Open ${setting.key}`}
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
        <SettingDetail key={`${selected.key}:${selected.version}`} setting={selected} />
      ) : null}
    </div>
  );
}

function SettingDetail({ setting }: { setting: PlatformSetting }) {
  const { permissions } = useAdminSession();
  const queryClient = useQueryClient();
  const canUpdate = hasPermission(permissions, Permissions.SETTINGS_UPDATE);
  const canViewSecrets = hasPermission(permissions, Permissions.SETTINGS_SECRETS_VIEW);
  const canUpdateSecrets = hasPermission(permissions, Permissions.SETTINGS_SECRETS_UPDATE);
  const canEdit = canUpdate && !setting.isReadonly && (!setting.isSecret || canUpdateSecrets);

  const [draft, setDraft] = useState(() => initialDraft(setting));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [...configApi.configKeys.settings] });

  const onError = (err: unknown) => {
    setError(err);
    toast.error(configErrorMessage(err));
  };

  const save = useMutation({
    mutationFn: () =>
      configApi.updateSetting(setting.key, {
        value: toValue(setting, draft),
        version: setting.version,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (saved) => {
      setError(null);
      toast.success(`${saved.key} saved (version ${saved.version})`);
      void refresh();
    },
    onError,
  });
  const reset = useMutation({
    mutationFn: () =>
      configApi.resetSetting(setting.key, {
        version: setting.version,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`${setting.key} reset to its default`);
      void refresh();
    },
    onError,
  });
  const rollback = useMutation({
    mutationFn: (toVersion: number) =>
      configApi.rollbackSetting(setting.key, { toVersion, version: setting.version }),
    onSuccess: (saved) => {
      toast.success(`${saved.key} restored`);
      void refresh();
    },
    onError,
  });
  const reveal = useMutation({
    mutationFn: () => configApi.revealSecret(setting.key),
    onSuccess: (secret) => setRevealed(secret.value),
    onError: (err) => toast.error(configErrorMessage(err)),
  });

  const busy = save.isPending || reset.isPending || rollback.isPending;
  const inputId = `setting-${setting.key}`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-base">{setting.key}</CardTitle>
          <CardDescription>
            {setting.description} Type: {setting.type}.{" "}
            {setting.isSecret
              ? "Secret: stored encrypted, never shown in lists or history."
              : `Default: ${formatSettingValue(setting, setting.defaultValue)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            {setting.isSecret && canViewSecrets && setting.hasValue ? (
              <div className="space-y-1">
                <Label>Stored secret</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={revealed ?? "••••••••"} aria-label="Stored secret" />
                  {revealed === null ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => reveal.mutate()}
                      disabled={reveal.isPending}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" /> Reveal
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRevealed(null)}
                    >
                      <EyeOff className="mr-1 h-3.5 w-3.5" /> Hide
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Every reveal is recorded in the audit log.
                </p>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor={inputId}>
                {setting.isSecret ? "New secret value" : "Platform value"}
              </Label>
              {setting.type === "boolean" ? (
                <select
                  id={inputId}
                  className={selectClass}
                  value={draft}
                  disabled={!canEdit || busy}
                  onChange={(event) => setDraft(event.target.value)}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : setting.type === "json" ? (
                <Textarea
                  id={inputId}
                  rows={6}
                  className="font-mono text-xs"
                  value={draft}
                  disabled={!canEdit || busy}
                  onChange={(event) => setDraft(event.target.value)}
                />
              ) : (
                <Input
                  id={inputId}
                  type={setting.isSecret ? "password" : "text"}
                  inputMode={
                    setting.type === "number" || setting.type === "duration" ? "numeric" : undefined
                  }
                  autoComplete="off"
                  value={draft}
                  disabled={!canEdit || busy}
                  onChange={(event) => setDraft(event.target.value)}
                />
              )}
            </div>
            {canEdit ? (
              <div className="space-y-1">
                <Label htmlFor={`${inputId}-reason`}>Reason (optional, kept in history)</Label>
                <Input
                  id={`${inputId}-reason`}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {setting.isReadonly
                  ? "Read-only: this setting is managed in code."
                  : setting.isSecret && canUpdate
                    ? "Changing a secret needs the settings.secrets.update permission."
                    : "You can view this setting. Changing it needs the settings.update permission."}
              </p>
            )}
            {error ? <InlineFieldErrors error={error} /> : null}
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => reset.mutate()}
                >
                  <RotateCcw className="mr-1 h-4 w-4" /> Reset to default
                </Button>
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <RevisionHistory<{ value?: unknown; hasValue?: boolean }>
        title="History"
        queryKey={configApi.configKeys.settingHistory(setting.key)}
        load={() => configApi.settingHistory(setting.key, { limit: 50 })}
        currentVersion={setting.version}
        canRestore={canEdit}
        restoring={rollback.isPending}
        onRestore={(revision) => rollback.mutate(revision.version)}
        renderState={(revision) =>
          setting.isSecret ? (
            <span className="text-muted-foreground">
              {revision.hasSecretValue ? "Secret value set" : "No secret value"}
            </span>
          ) : (
            <span className="break-all font-mono text-xs">
              {formatSettingValue(setting, revision.state?.value)}
            </span>
          )
        }
      />
    </div>
  );
}
