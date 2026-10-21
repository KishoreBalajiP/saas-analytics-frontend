import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, InlineFieldErrors, TableSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as workspaceSettingsApi from "@/features/workspace-settings/api";
import { useTenantSession } from "@/lib/auth/session";
import { hasPermission, perm } from "@/lib/permissions";

const SETTINGS_VIEW = perm("settings", "view");
const SETTINGS_UPDATE = perm("settings", "update");

/** IANA zones known to this browser, offered as suggestions. */
function knownTimeZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    return intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [];
  } catch {
    return [];
  }
}

/**
 * Workspace time zone: decides what "today", "last month" and scheduled
 * report/alert times mean for everyone in the workspace.
 */
export function WorkspaceTimezoneCard() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, SETTINGS_VIEW);
  const canUpdate = hasPermission(permissions, SETTINGS_UPDATE);

  const settingsQuery = useQuery({
    queryKey: workspaceSettingsKey(),
    queryFn: () => workspaceSettingsApi.get(),
    enabled: canView,
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Workspace settings" />;
  if (settingsQuery.isLoading) return <TableSkeleton rows={2} cols={2} />;
  if (settingsQuery.isError)
    return (
      <ErrorState
        error={settingsQuery.error}
        onRetry={() => settingsQuery.refetch()}
        resource="Workspace settings"
      />
    );

  return (
    <TimezoneForm
      key={settingsQuery.data?.timezone ?? "UTC"}
      current={settingsQuery.data?.timezone ?? "UTC"}
      canUpdate={canUpdate}
    />
  );
}

function workspaceSettingsKey() {
  return [...workspaceSettingsApi.workspaceSettingsKey];
}

function TimezoneForm({ current, canUpdate }: { current: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [timezone, setTimezone] = useState(current);
  const [error, setError] = useState<unknown>(null);
  const zones = knownTimeZones();
  const mutation = useMutation({
    mutationFn: () => workspaceSettingsApi.update({ timezone: timezone.trim() }),
    onSuccess: (saved) => {
      setError(null);
      queryClient.setQueryData(workspaceSettingsKey(), saved);
      toast.success(`Time zone set to ${saved.timezone}`);
    },
    onError: setError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time zone</CardTitle>
        <CardDescription>
          Date ranges such as “Today” or “Last month”, date grouping, and report and alert schedules
          use this time zone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!timezone.trim()) {
              setError(new Error("Enter a time zone, for example Europe/Berlin."));
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="workspace-timezone">Workspace time zone</Label>
            <Input
              id="workspace-timezone"
              list="workspace-timezone-options"
              value={timezone}
              maxLength={64}
              disabled={!canUpdate || mutation.isPending}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="e.g. Europe/Berlin"
            />
            <datalist id="workspace-timezone-options">
              {zones.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
            {!canUpdate ? (
              <p className="text-xs text-muted-foreground">
                You can view this setting. Ask a workspace admin to change it.
              </p>
            ) : null}
          </div>
          {error ? <InlineFieldErrors error={error} /> : null}
          {error instanceof Error && !(error as { errors?: unknown[] }).errors?.length ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : null}
          {canUpdate ? (
            <Button type="submit" disabled={mutation.isPending || timezone.trim() === current}>
              <Save className="mr-1 h-4 w-4" />
              {mutation.isPending ? "Saving…" : "Save time zone"}
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
