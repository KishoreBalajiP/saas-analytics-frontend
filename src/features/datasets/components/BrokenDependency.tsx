import { Unplug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  brokenReasonText,
  isBroken,
  type BrokenAware,
} from "@/features/datasets/lib/brokenDependency";

/** Compact status badge for list rows (reports, alerts, widgets). */
export function BrokenBadge({ entity }: { entity: BrokenAware }) {
  if (!isBroken(entity)) return null;
  return (
    <Badge variant="destructive" title={brokenReasonText(entity.brokenReason)}>
      <Unplug className="mr-1 h-3 w-3" aria-hidden="true" />
      Broken
    </Badge>
  );
}

/**
 * Full broken state for a widget card or detail page: says what happened
 * and how to fix it instead of showing a raw execution error.
 */
export function BrokenDependencyState({
  entity,
  resource = "widget",
  fixHint,
}: {
  entity: BrokenAware;
  resource?: string;
  fixHint?: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-4 py-6 text-center"
    >
      <Unplug className="h-5 w-5 text-destructive" aria-hidden="true" />
      <p className="text-sm font-medium">This {resource} is broken</p>
      <p className="text-xs text-muted-foreground">{brokenReasonText(entity.brokenReason)}</p>
      <p className="text-xs text-muted-foreground">
        {fixHint ?? `Edit the ${resource} and choose another dataset to restore it.`}
      </p>
    </div>
  );
}
