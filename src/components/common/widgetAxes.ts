import type { ResolvedVisualization } from "@/lib/api/types";

type Row = Record<string, unknown>;

export function formatCell(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Number formatter from the visualization spec (vizbuilder). Falls back to
 * locale formatting when there is no spec.
 */
export function makeNumberFormatter(viz?: ResolvedVisualization | null) {
  return (value: unknown) => {
    if (typeof value !== "number") return formatCell(value);
    const unit = viz?.unit ? ` ${viz.unit}` : "";
    switch (viz?.numberFormat) {
      case "integer":
        return `${Math.round(value).toLocaleString()}${unit}`;
      case "percent":
        return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
      case "currency":
        return value.toLocaleString(undefined, {
          style: "currency",
          currency: viz.currency ?? "USD",
        });
      case "compact":
        return `${value.toLocaleString(undefined, { notation: "compact" })}${unit}`;
      default:
        return `${value.toLocaleString()}${unit}`;
    }
  };
}

/** Legacy guess for results without a spec (ad hoc analytics runs). */
export function numericKeys(rows: Row[]) {
  const first = rows[0] ?? {};
  return Object.keys(first).filter((key) => typeof first[key] === "number");
}

function labelKey(rows: Row[]) {
  const first = rows[0] ?? {};
  return Object.keys(first).find((key) => typeof first[key] !== "number") ?? Object.keys(first)[0];
}

/**
 * Dimensions and measures: from the server-resolved spec when present (a
 * numeric dimension such as `year` stays a dimension), else guessed by type.
 */
export function axesOf(rows: Row[], viz?: ResolvedVisualization | null) {
  if (viz && (viz.xField || viz.measures.length)) {
    return { nameKey: viz.xField ?? labelKey(rows) ?? "name", valueKeys: viz.measures };
  }
  return { nameKey: labelKey(rows) ?? "name", valueKeys: numericKeys(rows) };
}
