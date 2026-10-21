import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import * as insightsApi from "@/features/insights/api";
import { describeInsight } from "@/features/insights/describe";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

export function InsightFeed({ dashboardId, metric }: { dashboardId?: string; metric?: string }) {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.ANALYTICS_VIEW);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["insights", dashboardId ?? null, metric ?? null],
    queryFn: () =>
      insightsApi.list({ ...(dashboardId ? { dashboardId } : {}), ...(metric ? { metric } : {}) }),
    enabled: canView,
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => insightsApi.dismiss(id),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["insights"] }),
  });
  const rate = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: "up" | "down" }) =>
      insightsApi.feedback(id, rating),
  });
  if (!canView || query.isLoading || query.isError) return null;
  const items = query.data?.data ?? [];
  if (!items.length) return null;
  return (
    <section aria-label="Insights" className="space-y-2 rounded-lg border border-border p-3">
      <h2 className="text-sm font-medium">Insights</h2>
      {items.map((i) => (
        <div key={i._id} className="flex items-start justify-between gap-2 text-sm">
          <div>
            <p>{describeInsight(i)}</p>
            {i.narration?.claims.map((c) => (
              <p key={c.text} className="text-muted-foreground">
                {c.text}
              </p>
            ))}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => rate.mutate({ id: i._id, rating: "up" })}
            >
              Useful
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(i._id)}>
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
