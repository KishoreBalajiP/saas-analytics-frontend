import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import * as connectorsApi from "@/features/datasets/api";
import { toastError } from "@/lib/api/quota";

/**
 * datasets: browse the databases / collections / views the MongoDB
 * connector's credentials can see and pick the one to sync.
 */
export function MongoSourcePicker({
  connectorId,
  currentDatabase,
  currentCollection,
}: {
  connectorId: string;
  currentDatabase?: string | undefined;
  currentCollection?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [database, setDatabase] = useState<string | undefined>(currentDatabase);
  const [collection, setCollection] = useState<string | undefined>(currentCollection);
  const [enabled, setEnabled] = useState(false);
  const query = useQuery({
    queryKey: ["connector", connectorId, "discover", database ?? ""],
    queryFn: () => connectorsApi.discoverMongo(connectorId, database),
    enabled,
    retry: false,
  });
  const save = useMutation({
    mutationFn: (db: string) =>
      connectorsApi.update(connectorId, { config: { database: db, collection } }),
    onSuccess: () => {
      toast.success("Source updated. Sync to pull data from it.");
      void queryClient.invalidateQueries({ queryKey: ["connector", connectorId] });
    },
    onError: (error) => toastError(error, "Could not update the source"),
  });

  if (!enabled) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEnabled(true)}>
        Browse collections
      </Button>
    );
  }
  if (query.isLoading) {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Listing databases and collections…
      </p>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data;
  if (!data) return null;
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium">
        Database
        <select
          aria-label="Database"
          className="mt-1 block w-full rounded border border-border bg-background p-1 text-sm"
          value={database ?? data.database ?? ""}
          onChange={(e) => {
            setDatabase(e.target.value);
            setCollection(undefined);
          }}
        >
          {data.databases.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      {!data.databasesListed ? (
        <p className="text-xs text-muted-foreground">
          This user cannot list databases; only the configured database is shown.
        </p>
      ) : null}
      {data.collections.length === 0 ? (
        <p className="text-xs text-muted-foreground">No collections visible in this database.</p>
      ) : (
        <label className="block text-xs font-medium">
          Collection
          <select
            aria-label="Collection"
            className="mt-1 block w-full rounded border border-border bg-background p-1 text-sm"
            value={collection ?? ""}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="" disabled>
              Choose a collection
            </option>
            {data.collections.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
                {c.type === "view" ? " (view)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        size="sm"
        disabled={!collection || !(database ?? data.database) || save.isPending}
        onClick={() => {
          save.mutate((database ?? data.database) as string);
        }}
      >
        Use this source
      </Button>
    </div>
  );
}
