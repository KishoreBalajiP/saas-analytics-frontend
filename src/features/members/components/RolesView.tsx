import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import * as membersApi from "@/features/members/api";
import {
  roleLabel,
  type PermissionCatalogueEntry,
  type WorkspaceRole,
} from "@/features/members/types";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

/**
 * Workspace roles: the built-in templates (read-only) and custom roles the
 * user may create, edit and delete. A custom role can only hold permissions
 * the user holds (the backend enforces this ceiling too).
 */
export function RolesView() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.ROLES_VIEW);
  const canCreate = hasPermission(permissions, Permissions.ROLES_CREATE);
  const [editing, setEditing] = useState<WorkspaceRole | "new" | null>(null);

  const rolesQuery = useQuery({
    queryKey: [...membersApi.membersKeys.roles],
    queryFn: () => membersApi.listRoles(),
    enabled: canView,
  });
  const catalogueQuery = useQuery({
    queryKey: [...membersApi.membersKeys.catalogue],
    queryFn: () => membersApi.listPermissionCatalogue(),
    enabled: canView,
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Roles" />;
  if (rolesQuery.isLoading) return <TableSkeleton rows={4} cols={3} />;
  if (rolesQuery.isError)
    return (
      <ErrorState error={rolesQuery.error} onRetry={() => rolesQuery.refetch()} resource="Roles" />
    );

  const roles = rolesQuery.data ?? [];
  const permissionByKey = new Map((catalogueQuery.data ?? []).map((entry) => [entry.key, entry]));
  return (
    <div className="space-y-4">
      {canCreate ? (
        <Button onClick={() => setEditing("new")}>
          <Plus className="mr-1 h-4 w-4" /> New role
        </Button>
      ) : null}
      {editing ? (
        <RoleForm role={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
      {roles.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              permissionByKey={permissionByKey}
              onEdit={() => setEditing(role)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No roles" description="This workspace has not been initialised yet." />
      )}
    </div>
  );
}

function RoleCard({
  role,
  permissionByKey,
  onEdit,
}: {
  role: WorkspaceRole;
  permissionByKey: Map<string, PermissionCatalogueEntry>;
  onEdit: () => void;
}) {
  const { permissions } = useTenantSession();
  const canUpdate = hasPermission(permissions, Permissions.ROLES_UPDATE) && role.editable;
  const canDelete = hasPermission(permissions, Permissions.ROLES_DELETE) && role.editable;
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: () => membersApi.deleteRole(role.id),
    onSuccess: () => {
      toast.success(`Role "${role.name}" deleted`);
      void client.invalidateQueries({ queryKey: [...membersApi.membersKeys.all] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to delete the role"),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {roleLabel(role.name)}
          {role.editable ? (
            <Badge variant="outline">Custom</Badge>
          ) : (
            <Badge variant="secondary">
              <Lock className="mr-1 h-3 w-3" /> Built-in
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {role.description || "No description"} · {role.memberCount}{" "}
          {role.memberCount === 1 ? "member" : "members"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <details>
          <summary className="cursor-pointer text-sm">
            {role.permissions.length} permissions
          </summary>
          <ul className="mt-2 flex flex-wrap gap-1">
            {role.permissions.map((key) => {
              const entry = permissionByKey.get(key);
              return (
                <li key={key} className="rounded-md border p-2">
                  <div className="font-medium text-sm">
                    {entry ? `${entry.module} · ${entry.action}` : key}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry?.description || "Permission granted by this role."}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
        {canUpdate || canDelete ? (
          <div className="flex gap-2">
            {canUpdate ? (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
              </Button>
            ) : null}
            {canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${role.name}`}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete role “{role.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {role.memberCount > 0
                        ? `${role.memberCount} member(s) still hold this role. Change their roles first.`
                        : "The role is removed for good. Its name can be used again later."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => remove.mutate()}
                      disabled={remove.isPending || role.memberCount > 0}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RoleForm({ role, onClose }: { role: WorkspaceRole | null; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [error, setError] = useState<unknown>(null);
  const catalogue = useQuery({
    queryKey: [...membersApi.membersKeys.catalogue],
    queryFn: () => membersApi.listPermissionCatalogue(),
  });
  const grouped = useMemo(() => {
    const groups = new Map<string, PermissionCatalogueEntry[]>();
    for (const entry of catalogue.data ?? []) {
      const list = groups.get(entry.module) ?? [];
      list.push(entry);
      groups.set(entry.module, list);
    }
    return [...groups.entries()];
  }, [catalogue.data]);

  const mutation = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim(), permissions: selected };
      return role ? membersApi.updateRole(role.id, body) : membersApi.createRole(body);
    },
    onSuccess: (saved) => {
      toast.success(role ? `Role "${saved.name}" updated` : `Role "${saved.name}" created`);
      void client.invalidateQueries({ queryKey: [...membersApi.membersKeys.all] });
      onClose();
    },
    onError: setError,
  });

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{role ? `Edit role “${role.name}”` : "New role"}</CardTitle>
        <CardDescription>
          A custom role can only include permissions you hold yourself. Transferring ownership and
          deleting the workspace stay with the Owner role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setError(new Error("Enter a role name."));
              return;
            }
            if (!selected.length) {
              setError(new Error("Choose at least one permission."));
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Label className="space-y-1">
              <span>Role name</span>
              <Input
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
              />
            </Label>
            <Label className="space-y-1">
              <span>Description</span>
              <Input
                value={description}
                maxLength={300}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Label>
          </div>
          {catalogue.isLoading ? (
            <TableSkeleton rows={3} cols={3} />
          ) : catalogue.isError ? (
            <ErrorState
              error={catalogue.error}
              onRetry={() => catalogue.refetch()}
              resource="Permissions"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grouped.map(([module, entries]) => (
                <fieldset key={module} className="rounded-md border border-border p-3">
                  <legend className="px-1 text-sm font-medium">{module}</legend>
                  {entries.map((entry) => (
                    <label
                      key={entry.key}
                      className="flex items-center gap-2 text-sm"
                      title={
                        entry.assignable ? entry.description : "You do not hold this permission"
                      }
                    >
                      <input
                        type="checkbox"
                        aria-label={entry.key}
                        checked={selected.includes(entry.key)}
                        disabled={!entry.assignable}
                        onChange={() => toggle(entry.key)}
                      />
                      <span className={entry.assignable ? "" : "text-muted-foreground"}>
                        {entry.action}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          )}
          <InlineFieldErrors error={error} />
          {error instanceof Error && !(error as { errors?: unknown[] }).errors?.length ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : role ? "Save role" : "Create role"}
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
