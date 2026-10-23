import { useQuery } from "@tanstack/react-query";

import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import * as connectorsApi from "@/features/datasets/api";

/** datasets: read-only view of a connector's profiled schema. */
export function SchemaView({ connectorId }: { connectorId: string }) {
  const query = useQuery({
    queryKey: ["connector", connectorId, "schema"],
    queryFn: () => connectorsApi.getSchema(connectorId),
  });
  if (query.isLoading) return <TableSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const schema = query.data;
  if (!schema || schema.fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No schema yet. Sync data to profile this dataset.
      </p>
    );
  }
  return (
    <div className="space-y-3">
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
