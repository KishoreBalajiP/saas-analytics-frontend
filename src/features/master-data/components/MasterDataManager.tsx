import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createMasterDataItem,
  deleteMasterDataItem,
  itemId,
  listMasterData,
} from "@/features/master-data/api";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

const CATALOGUE_RE = /^[a-z0-9_]+$/;

/**
 * Shared reference catalogues. Reads are public on the API, but the screen is
 * gated on `master_data.view`; writes need `master_data.create` / `delete`.
 */
export function MasterDataManager() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.MASTER_DATA_VIEW);
  const canCreate = hasPermission(permissions, Permissions.MASTER_DATA_CREATE);
  const canDelete = hasPermission(permissions, Permissions.MASTER_DATA_DELETE);
  const client = useQueryClient();
  const [draft, setDraft] = useState("countries");
  const [catalogue, setCatalogue] = useState("countries");
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const key = ["admin", "master-data", catalogue, search];
  const items = useQuery({
    queryKey: key,
    queryFn: () => listMasterData(catalogue, search ? { search } : {}),
    enabled: canView && CATALOGUE_RE.test(catalogue),
  });
  const invalidate = () =>
    client.invalidateQueries({ queryKey: ["admin", "master-data", catalogue] });
  const create = useMutation<unknown, Error, void>({
    mutationFn: () => createMasterDataItem(catalogue, { code: code.trim(), name: name.trim() }),
    onSuccess: () => {
      toast.success("Item created");
      setCode("");
      setName("");
      void invalidate();
    },
    onError: (error) => toast.error(error.message || "Unable to create item"),
  });
  const remove = useMutation<unknown, Error, string>({
    mutationFn: (id) => deleteMasterDataItem(catalogue, id),
    onSuccess: () => {
      toast.success("Item deleted");
      void invalidate();
    },
    onError: (error) => toast.error(error.message || "Unable to delete item"),
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Master data" />;

  const onLoad = (event: FormEvent) => {
    event.preventDefault();
    setCatalogue(draft.trim());
  };
  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  const invalidCatalogue = !CATALOGUE_RE.test(catalogue);

  return (
    <div className="space-y-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onLoad}>
        <Input
          aria-label="Catalogue"
          placeholder="Catalogue (e.g. countries)"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Input
          aria-label="Search"
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" variant="outline">
          Load
        </Button>
      </form>
      {canCreate && !invalidCatalogue ? (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onCreate}>
          <Input
            aria-label="Code"
            placeholder="Code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Input
            aria-label="Name"
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={create.isPending || !code.trim() || !name.trim()}>
            Add item
          </Button>
        </form>
      ) : null}
      {invalidCatalogue ? (
        <EmptyState
          title="Invalid catalogue name"
          description="Use lowercase letters, digits and underscores."
        />
      ) : items.isLoading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : items.isError ? (
        <ErrorState error={items.error} onRetry={() => items.refetch()} resource="Master data" />
      ) : !items.data?.data.length ? (
        <EmptyState title="No items in this catalogue" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.data.data.map((item) => (
                <div
                  key={itemId(item)}
                  className="flex items-center justify-between gap-3 p-4"
                  data-testid={`master-data-${itemId(item)}`}
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.code}
                      {item.locale ? ` · ${item.locale}` : ""}
                      {item.isSystem ? " · system" : ""}
                    </p>
                  </div>
                  {canDelete && !item.isSystem ? (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Delete ${item.code}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(itemId(item))}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
