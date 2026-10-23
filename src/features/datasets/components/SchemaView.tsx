import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import * as connectorsApi from "@/features/datasets/api";

/** datasets: read-only view of a connector's profiled schema. */
export function SchemaView({ connectorId }: { connectorId: string }) {
  const query = useQuery({
    queryKey: ["connector", connectorId, "schema"],
    queryFn: () => connectorsApi.getSchema(connectorId),
  });
  const queryClient = useQueryClient();
  const refresh = useMutation({
    mutationFn: () => connectorsApi.refreshSchema(connectorId),
    onSuccess: (data) => {
      queryClient.setQueryData(["connector", connectorId, "schema"], data);
    },
  });
  const refreshControl = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => refresh.mutate()}
        disabled={refresh.isPending}
      >
        {refresh.isPending ? "Refreshing schema…" : "Refresh schema"}
      </Button>
      {refresh.isError ? (
        <span role="alert" className="text-xs text-destructive">
          {refresh.error instanceof Error ? refresh.error.message : "Schema refresh failed."}
        </span>
      ) : refresh.isSuccess ? (
        <span role="status" className="text-xs text-muted-foreground">
          Schema refreshed.
        </span>
      ) : null}
    </div>
  );
  if (query.isLoading) return <TableSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const schema = query.data;
  if (!schema || schema.fields.length === 0) {
    return (
      <div className="space-y-2">
        {refreshControl}
        <p className="text-sm text-muted-foreground">
          No schema yet. Sync data to profile this dataset.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {refreshControl}
      <p className="text-sm text-muted-foreground">
        Schema version {schema.version}, profiled {new Date(schema.profiledAt).toLocaleString()}
        {schema.dateField ? ` · date column: ${schema.dateField}` : ""}
        {schema.keyField ? ` · key column: ${schema.keyField}` : ""}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Field</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Nulls</th>
              <th className="py-2 pr-4">Distinct</th>
              <th className="py-2 pr-4">Sample</th>
            </tr>
          </thead>
          <tbody>
            {schema.fields.map((f) => (
              <tr key={f.name} className="border-b">
                <td className="py-2 pr-4 font-medium">
                  {f.displayName ?? f.name}
                  {f.personal ? (
                    <Badge variant="outline" className="ml-2">
                      Personal
                    </Badge>
                  ) : null}
                </td>
                <td className="py-2 pr-4">
                  <Badge variant="secondary">{f.type}</Badge>
                </td>
                <td className="py-2 pr-4">{Math.round(f.nullRate * 100)}%</td>
                <td className="py-2 pr-4">{f.distinctEstimate}</td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {f.sample.map(String).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
