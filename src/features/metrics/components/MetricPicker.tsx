import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { MetricDefinition } from "@/features/metrics/api";

/** Pick an approved metric; the query references it as `metric:<key>`. */
export function MetricPicker({
  metrics,
  onPick,
}: {
  metrics: MetricDefinition[];
  onPick: (ref: string) => void;
}) {
  const approved = metrics.filter((m) => m.approvedVersion || m.status === "approved");
  const [key, setKey] = useState("");
  if (!approved.length) return null;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="metric-picker" className="text-xs text-muted-foreground">
        Approved metric
      </label>
      <select
        id="metric-picker"
        className="rounded border border-border bg-background p-1 text-sm"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      >
        <option value="">Choose…</option>
        {approved.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label} ({m.key})
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="outline"
        disabled={!key}
        onClick={() => {
          onPick(`metric:${key}`);
          setKey("");
        }}
      >
        Add metric
      </Button>
    </div>
  );
}
