import { useQuery } from "@tanstack/react-query";

import { ErrorState, TableSkeleton } from "@/components/common/states";
import * as apiKeysApi from "@/features/api-keys/api";

/** Per-key usage: daily bars (requests, errors) and counts by endpoint/status. */
export function KeyUsagePanel({ keyId }: { keyId: string }) {
  const query = useQuery({
    queryKey: ["api-keys", "usage", keyId],
    queryFn: () => apiKeysApi.usage(keyId, 7),
  });
  if (query.isLoading) return <TableSkeleton rows={3} cols={3} />;
  if (query.isError) return <ErrorState error={query.error} resource="API key usage" />;
  const data = query.data;
  if (!data) return null;
  const max = Math.max(1, ...data.days.map((d) => d.total));
  return (
    <div className="space-y-3" aria-label="API key usage">
      <p className="text-sm">
        <span className="font-medium">{data.total}</span> requests in the last 7 days
      </p>
      <div className="flex h-24 items-end gap-1" role="img" aria-label="Requests per day">
        {data.days.map((d) => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-sm bg-primary"
              style={{ height: `${Math.round((d.total / max) * 80)}px` }}
              title={`${d.day}: ${d.total} requests, ${d.errors} errors`}
              data-testid="usage-bar"
            />
            <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
          </div>
        ))}
      </div>
      {data.byEndpoint.length ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th>Endpoint</th>
              <th>Status</th>
              <th className="text-right">Requests</th>
            </tr>
          </thead>
          <tbody>
            {data.byEndpoint.map((e) => (
              <tr key={`${e.endpoint}-${e.status}`}>
                <td>
                  <code>{e.endpoint}</code>
                </td>
                <td>{e.status}</td>
                <td className="text-right">{e.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-muted-foreground">No requests yet.</p>
      )}
    </div>
  );
}
