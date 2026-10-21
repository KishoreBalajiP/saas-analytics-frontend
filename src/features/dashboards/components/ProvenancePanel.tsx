import { Info } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { WidgetProvenance } from "@/lib/api/types";

function when(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "—";
}

/**
 * "How this was calculated" (vizbuilder): data window, time zone, dataset
 * freshness and version, the aggregations, and excluded values.
 */
export function ProvenancePanel({ provenance }: { provenance: WidgetProvenance | undefined }) {
  const [open, setOpen] = useState(false);
  if (!provenance) return null;
  const excluded = Object.entries(provenance.excluded ?? {});
  return (
    <div className="mt-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Info className="mr-1 h-3.5 w-3.5" /> How this was calculated
      </Button>
      {open ? (
        <dl
          className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border p-2 text-xs"
          aria-label="Calculation details"
        >
          <dt className="text-muted-foreground">Dataset</dt>
          <dd>
            {provenance.dataset.name ?? provenance.dataset.id} (version{" "}
            {provenance.dataset.dataVersion})
          </dd>
          <dt className="text-muted-foreground">Last synced</dt>
          <dd>{when(provenance.dataset.lastSyncedAt)}</dd>
          <dt className="text-muted-foreground">Data window</dt>
          <dd>
            {provenance.window
              ? `${provenance.window.field}: ${when(provenance.window.from)} to ${when(provenance.window.to)}${provenance.window.preset ? ` (${provenance.window.preset})` : ""}`
              : "All data"}
          </dd>
          <dt className="text-muted-foreground">Time zone</dt>
          <dd>{provenance.timezone ?? "UTC"}</dd>
          <dt className="text-muted-foreground">Calculation</dt>
          <dd>
            {provenance.metrics.length
              ? provenance.metrics
                  .map((m) => `${m.alias} = ${m.op}(${m.field ?? "rows"})`)
                  .join(", ")
              : "row count"}
            {provenance.groupBy.length
              ? ` by ${provenance.groupBy.map((g) => (g.bucket ? `${g.field} (${g.bucket})` : g.field)).join(", ")}`
              : ""}
          </dd>
          <dt className="text-muted-foreground">Filters</dt>
          <dd>{provenance.filterCount}</dd>
          {excluded.length ? (
            <>
              <dt className="text-muted-foreground">Excluded</dt>
              <dd>{excluded.map(([k, n]) => `${n} non-numeric in ${k}`).join(", ")}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Computed</dt>
          <dd>
            {when(provenance.executedAt)}
            {provenance.cached ? " (cached)" : ""}
          </dd>
        </dl>
      ) : null}
    </div>
  );
}
