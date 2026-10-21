import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, InlineFieldErrors, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import * as dashboardsApi from "@/features/dashboards/api";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/**
 * Dashboard sharing (vizbuilder): visibility (whole workspace or restricted)
 * and view/edit grants to tenant users or roles. Enforced by the server;
 * only the creator or a `dashboards.assign` holder sees this panel's data.
 */
export function SharingPanel({ dashboardId }: { dashboardId: string }) {
  const queryClient = useQueryClient();
  const key = ["dashboards", dashboardId, "shares"];
  const sharesQuery = useQuery({
    queryKey: key,
    queryFn: () => dashboardsApi.listShares(dashboardId),
  });
  const [principal, setPrincipal] = useState("");
  const [level, setLevel] = useState<"view" | "edit">("view");
  const [error, setError] = useState<unknown>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["dashboards", "detail", dashboardId] });
  };

  const visibility = useMutation({
    mutationFn: (value: "workspace" | "restricted") =>
      dashboardsApi.update(dashboardId, { visibility: value }),
    onSuccess: () => {
      toast.success("Visibility updated");
      refresh();
    },
    onError: setError,
  });
  const add = useMutation({
    mutationFn: () => {
      const [principalType, principalId] = principal.split(":") as ["user" | "role", string];
      return dashboardsApi.share(dashboardId, { principalType, principalId, level });
    },
    onSuccess: () => {
      setError(null);
      setPrincipal("");
      toast.success("Access granted");
      refresh();
    },
    onError: setError,
  });
  const revoke = useMutation({
    mutationFn: (entryId: string) => dashboardsApi.revokeShare(dashboardId, entryId),
    onSuccess: () => {
      toast.success("Access removed");
      refresh();
    },
    onError: setError,
  });

  if (sharesQuery.isLoading) return <TableSkeleton rows={2} cols={2} />;
  if (sharesQuery.isError)
    return (
      <ErrorState
        error={sharesQuery.error}
        onRetry={() => sharesQuery.refetch()}
        resource="Sharing"
      />
    );
  const data = sharesQuery.data;
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sharing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="share-visibility">Who can open this dashboard</Label>
          <select
            id="share-visibility"
            className={selectClass}
            value={data.visibility}
            onChange={(e) => visibility.mutate(e.target.value as "workspace" | "restricted")}
          >
            <option value="workspace">Everyone in the workspace with dashboard access</option>
            <option value="restricted">Only people and roles listed below</option>
          </select>
        </div>
        <ul className="space-y-1" aria-label="Shares">
          {data.shares.length === 0 ? (
            <li className="text-sm text-muted-foreground">Not shared with anyone yet.</li>
          ) : (
            data.shares.map((s) => (
              <li
                key={s._id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <span>
                  {s.principalName ?? s.principalId}{" "}
                  <span className="text-xs text-muted-foreground">({s.principalType})</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{s.level === "edit" ? "Can edit" : "Can view"}</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${s.principalName ?? s.principalId}`}
                    onClick={() => revoke.mutate(s._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))
          )}
        </ul>
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (principal) add.mutate();
          }}
        >
          <select
            aria-label="Share with"
            className={selectClass}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
          >
            <option value="">Choose a person or role</option>
            <optgroup label="Roles">
              {data.candidates.roles.map((r) => (
                <option key={r.id} value={`role:${r.id}`}>
                  {r.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="People">
              {data.candidates.users.map((u) => (
                <option key={u.id} value={`user:${u.id}`}>
                  {u.name} ({u.email})
                </option>
              ))}
            </optgroup>
          </select>
          <select
            aria-label="Access level"
            className={selectClass}
            value={level}
            onChange={(e) => setLevel(e.target.value as "view" | "edit")}
          >
            <option value="view">Can view</option>
            <option value="edit">Can edit</option>
          </select>
          <Button type="submit" disabled={!principal || add.isPending}>
            Share
          </Button>
        </form>
        {error ? <InlineFieldErrors error={error} /> : null}
        {error && !(error as { errors?: unknown[] }).errors?.length ? (
          <ErrorState error={error} />
        ) : null}
      </CardContent>
    </Card>
  );
}
