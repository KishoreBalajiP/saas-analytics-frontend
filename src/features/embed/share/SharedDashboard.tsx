import { useQuery } from "@tanstack/react-query";

import { WidgetView } from "@/components/common/WidgetView";
import * as embedApi from "@/features/embed/api";
import type { AnalyticsResult, WidgetType } from "@/lib/api/types";

/** Public share link page. The secret lives in the URL fragment (never sent to servers). */
export function SharedDashboard({ secret }: { secret: string }) {
  const query = useQuery({
    queryKey: ["embed", "share", secret],
    queryFn: () => embedApi.viewShare(secret),
    enabled: Boolean(secret),
    retry: false,
  });
  if (!secret || query.isError)
    return (
      <p role="alert" className="p-6 text-sm text-destructive">
        This share link is invalid, revoked or expired.
      </p>
    );
  if (query.isLoading || !query.data)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Loading…
      </p>
    );
  const { dashboard, widgets } = query.data;
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">{dashboard.name}</h1>
      {dashboard.description ? (
        <p className="text-sm text-muted-foreground">{dashboard.description}</p>
      ) : null}
      {widgets.map((w) => (
        <section key={w.key} className="rounded-md border p-3">
          <h2 className="mb-2 text-sm font-medium">{w.name}</h2>
          {w.result ? (
            <WidgetView
              type={w.type as WidgetType}
              result={w.result as unknown as AnalyticsResult}
            />
          ) : (
            <p className="text-sm text-muted-foreground">This widget could not be rendered.</p>
          )}
        </section>
      ))}
    </main>
  );
}
