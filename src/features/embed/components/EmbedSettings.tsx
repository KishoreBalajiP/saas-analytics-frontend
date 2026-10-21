import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as dashboardsApi from "@/features/dashboards/api";
import * as embedApi from "@/features/embed/api";
import type { EmbedTheme } from "@/features/embed/api";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

import { parseOrigins } from "../snippet";

/** Workspace embed settings: allowed host origins and default theme. */
export function EmbedSettingsCard() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.SETTINGS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.SETTINGS_UPDATE);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["embed", "config"],
    queryFn: embedApi.getConfig,
    enabled: canView,
  });
  const [origins, setOrigins] = useState("");
  const [theme, setTheme] = useState<EmbedTheme>("auto");
  const [error, setError] = useState("");
  useEffect(() => {
    if (query.data) {
      setOrigins(query.data.allowedOrigins.join(", "));
      setTheme(query.data.defaultTheme);
    }
  }, [query.data]);
  const save = useMutation({
    mutationFn: () =>
      embedApi.updateConfig({ allowedOrigins: parseOrigins(origins), defaultTheme: theme }),
    onSuccess: () => {
      setError("");
      toast.success("Embed settings saved");
      void client.invalidateQueries({ queryKey: ["embed", "config"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Unable to save embed settings"),
  });
  if (!canView) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Embed settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Label>
            Allowed host origins
            <Input
              value={origins}
              disabled={!canUpdate}
              placeholder="https://app.example.com"
              onChange={(event) => setOrigins(event.target.value)}
            />
          </Label>
          <p className="text-xs text-muted-foreground">
            Only these sites may host your embeds. Leave empty to require origins on every token.
          </p>
          <Label>
            Default theme
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={theme}
              disabled={!canUpdate}
              onChange={(event) => setTheme(event.target.value as EmbedTheme)}
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {canUpdate && (
            <Button type="submit" disabled={save.isPending}>
              Save embed settings
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

/** Create a public, revocable, expiring share link for a published dashboard. */
export function ShareLinkCard() {
  const client = useQueryClient();
  const dashboards = useQuery({
    queryKey: ["dashboards", "list", { limit: 200, status: "published" }],
    queryFn: () => dashboardsApi.list({ limit: 200, status: "published" }),
  });
  const [dashboardId, setDashboardId] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => embedApi.createShare({ dashboardId }),
    onSuccess: (result) => {
      setLink(`${window.location.origin}/share#${result.secret}`);
      void client.invalidateQueries({ queryKey: ["embed"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to create share link"),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Public share link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label>
          Dashboard
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={dashboardId}
            onChange={(event) => setDashboardId(event.target.value)}
          >
            <option value="">Select a published dashboard</option>
            {(dashboards.data?.data ?? []).map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </Label>
        <Button disabled={!dashboardId || create.isPending} onClick={() => create.mutate()}>
          Create share link
        </Button>
        {link && (
          <div className="flex gap-2">
            <Input readOnly value={link} aria-label="Share link" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy share link"
              onClick={() => void navigator.clipboard?.writeText(link)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
