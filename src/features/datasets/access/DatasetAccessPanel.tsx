import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTenantSession } from "@/lib/auth/session";
import { hasPermission, Permissions } from "@/lib/permissions";

import * as api from "./api";

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * rls: access settings of one dataset: restriction, row rules, member
 * attributes and preview-as-user. Read with `data_access.view`, edit with
 * `data_access.configure`. The backend enforces every rule.
 */
export function DatasetAccessPanel({ connectorId }: { connectorId: string }) {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.DATA_ACCESS_VIEW);
  const canConfigure = hasPermission(permissions, Permissions.DATA_ACCESS_CONFIGURE);
  const client = useQueryClient();
  const access = useQuery({
    queryKey: [...api.datasetAccessKey(connectorId)],
    queryFn: () => api.getDatasetAccess(connectorId),
    enabled: canView,
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: [...api.datasetAccessKey(connectorId)] });

  const [field, setField] = useState("");
  const [attribute, setAttribute] = useState("");
  const [op, setOp] = useState<"eq" | "in">("eq");
  const [memberId, setMemberId] = useState("");
  const [attributesText, setAttributesText] = useState("");
  const [preview, setPreview] = useState<api.PreviewResult | null>(null);

  const toggle = useMutation({
    mutationFn: (restricted: boolean) =>
      api.setDatasetAccess(connectorId, { restricted, grants: access.data?.grants ?? [] }),
    onSuccess: () => void refresh(),
    onError: (e) => toast.error(message(e, "Could not change access")),
  });
  const addRule = useMutation({
    mutationFn: () =>
      api.addRowPolicy(connectorId, { field: field.trim(), op, attribute: attribute.trim() }),
    onSuccess: () => {
      setField("");
      setAttribute("");
      void refresh();
    },
    onError: (e) => toast.error(message(e, "Could not add the rule")),
  });
  const removeRule = useMutation({
    mutationFn: (id: string) => api.removeRowPolicy(id),
    onSuccess: () => void refresh(),
  });
  const saveAttributes = useMutation({
    mutationFn: () => api.setUserAttributes(memberId.trim(), api.parseAttributes(attributesText)),
    onSuccess: () => toast.success("Attributes saved"),
    onError: (e) => toast.error(message(e, "Could not save attributes")),
  });
  const runPreview = useMutation({
    mutationFn: () => api.previewAsUser(memberId.trim(), connectorId),
    onSuccess: setPreview,
    onError: (e) => toast.error(message(e, "Preview failed")),
  });

  if (!canView || !access.data) return null;
  const data = access.data;

  return (
    <section
      className="space-y-4 rounded-lg border border-border bg-card p-6"
      aria-label="Data access"
    >
      <div>
        <h3 className="text-sm font-semibold">Data access</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.restricted
            ? "Restricted: only granted members and roles can query this dataset."
            : "Open to every member who can read analytics."}
        </p>
      </div>
      {canConfigure ? (
        <Button variant="outline" size="sm" onClick={() => toggle.mutate(!data.restricted)}>
          {data.restricted ? "Open to all members" : "Restrict dataset"}
        </Button>
      ) : null}

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Row rules</h4>
        {data.policies.length === 0 ? (
          <p className="text-xs text-muted-foreground">No row rules: members see every row.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.policies.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span>
                  {p.field} {p.op === "in" ? "in" : "="} user.{p.attribute}
                </span>
                {canConfigure ? (
                  <Button variant="ghost" size="sm" onClick={() => removeRule.mutate(p.id)}>
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canConfigure ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addRule.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="rule-field">Field</Label>
              <Input
                id="rule-field"
                value={field}
                onChange={(e) => setField(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-op">Match</Label>
              <select
                id="rule-op"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={op}
                onChange={(e) => setOp(e.target.value === "in" ? "in" : "eq")}
              >
                <option value="eq">equals</option>
                <option value="in">is one of</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-attribute">User attribute</Label>
              <Input
                id="rule-attribute"
                value={attribute}
                onChange={(e) => setAttribute(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={addRule.isPending}>
              Add rule
            </Button>
          </form>
        ) : null}
      </div>

      {canConfigure ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Member attributes and preview</h4>
          <Label htmlFor="member-id">Member id</Label>
          <Input id="member-id" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
          <Label htmlFor="member-attributes">Attributes (one key=value per line)</Label>
          <Textarea
            id="member-attributes"
            value={attributesText}
            onChange={(e) => setAttributesText(e.target.value)}
            placeholder="region=EU"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!memberId.trim()}
              onClick={() => saveAttributes.mutate()}
            >
              Save attributes
            </Button>
            <Button size="sm" disabled={!memberId.trim()} onClick={() => runPreview.mutate()}>
              Preview as member
            </Button>
          </div>
          {preview ? (
            <p className="text-sm" role="status">
              This member sees {preview.total} row{preview.total === 1 ? "" : "s"}
              {preview.scope.deniedDatasets.includes(connectorId) ? " (dataset not granted)" : ""}.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
