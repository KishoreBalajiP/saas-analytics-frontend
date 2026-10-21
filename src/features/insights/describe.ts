import type { Insight } from "@/features/insights/api";

/** Deterministic text for an insight, built only from its own facts and cells. */
export function describeInsight(insight: Insight): string {
  const f = insight.facts as {
    change?: number;
    changePct?: number | null;
    movers?: Array<{ member: string; change: number }>;
    period?: string;
    direction?: string;
  };
  if (insight.type === "period_change") {
    const pct = typeof f.changePct === "number" ? ` (${(f.changePct * 100).toFixed(1)}%)` : "";
    return `${insight.metricKey ?? "Metric"} changed by ${String(f.change)}${pct} versus the previous period.`;
  }
  if (insight.type === "top_movers") {
    const movers = f.movers ?? [];
    return `Top movers: ${movers.map((m) => `${m.member} (${m.change > 0 ? "+" : ""}${m.change})`).join(", ")}.`;
  }
  return `${insight.metricKey ?? "Metric"} in ${String(f.period)} is ${String(f.direction)} its usual range.`;
}
