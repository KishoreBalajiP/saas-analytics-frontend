import { CheckCircle2, CircleSlash } from "lucide-react";

import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFeatureFlags } from "@/features/feature-flags/hooks/useFeatureFlags";

/** Friendly names for the platform's built-in flags; other keys show as-is. */
const FLAG_LABELS: Record<string, string> = {
  "analytics.realtime": "Realtime analytics",
  "analytics.export.csv": "CSV export",
  "connectors.webhooks": "Webhook connectors",
  "compliance.eu_mode": "EU compliance mode",
};

/**
 * Read-only list of the features the platform has switched on for this
 * workspace. Rollouts are managed by the platform team.
 */
export function WorkspaceFeaturesCard() {
  const { flags, allowed, isLoading, isError } = useFeatureFlags();

  if (!allowed) return <ErrorState error={{ statusCode: 403 }} resource="Workspace features" />;
  if (isLoading) return <TableSkeleton rows={2} cols={2} />;
  if (isError) {
    return (
      <ErrorState
        error={new Error("Workspace features could not be loaded.")}
        resource="Workspace features"
      />
    );
  }
  const entries = Object.entries(flags).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace features</CardTitle>
        <CardDescription>
          Features the platform has enabled for this workspace. Contact support to join a beta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            title="No optional features"
            description="No feature rollouts apply to this workspace."
          />
        ) : (
          <ul className="divide-y divide-border" aria-label="Workspace features">
            {entries.map(([key, on]) => (
              <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {on ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <CircleSlash className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{FLAG_LABELS[key] ?? key}</span>
                </span>
                <Badge variant={on ? "default" : "outline"}>{on ? "On" : "Off"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
