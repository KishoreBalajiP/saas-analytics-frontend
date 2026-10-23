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
  const { features, allowed, isLoading, isError } = useFeatureFlags();

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
  const entries = [...features].sort((a, b) => a.key.localeCompare(b.key));

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
            {entries.map((feature) => (
              <li key={feature.key} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {feature.value ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <CircleSlash className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>
                    <span className="block">
                      {FLAG_LABELS[feature.key] ?? feature.name ?? feature.key}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {feature.description || featureReason(feature.reason)}
                    </span>
                  </span>
                </span>
                <Badge variant={feature.value ? "default" : "outline"}>
                  {feature.value ? "Enabled" : featureReason(feature.reason)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function featureReason(reason: string) {
  switch (reason) {
    case "disabled":
      return "Disabled by the platform";
    case "not_in_allow_list":
      return "Not enabled for this workspace";
    case "not_in_plan":
      return "Not included in the current plan";
    case "requires_configuration":
      return "Requires configuration";
    case "disabled_by_platform":
      return "Disabled by the platform";
    case "disabled_by_workspace":
      return "Disabled for this workspace";
    case "percentage_out":
      return "Not included in this rollout";
    case "no_tenant":
      return "Workspace context required";
    case "unsupported_strategy":
      return "Unavailable";
    default:
      return "Not available";
  }
}
