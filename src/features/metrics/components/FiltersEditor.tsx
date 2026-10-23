import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FilterOp, QueryFilter } from "@/lib/api/types";

/** The analytics engine's filter operators (analytics.engine.js FILTER_OPS), in plain English. */
export const FILTER_OP_OPTIONS: Array<{ value: FilterOp; label: string }> = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "in", label: "is one of" },
  { value: "nin", label: "is none of" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is at least" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is at most" },
  { value: "exists", label: "has a value" },
];

const OPS = new Set<string>(FILTER_OP_OPTIONS.map((o) => o.value));
const RANGE_OPS = new Set<string>(["gt", "gte", "lt", "lte"]);

/** Editable form state for one filter (value always text). */
export interface FilterDraft {
  field: string;
  op: FilterOp;
  value: string;
}

export const EMPTY_FILTER: FilterDraft = { field: "", op: "eq", value: "" };

/**
 * "is one of" values as text: comma-separated; a value containing a comma or
 * a double quote is wrapped in double quotes, with inner quotes doubled
 * (e.g. `EU, "Acme, Inc"`).
 */
export function formatValueList(values: string[]) {
  return values.map((v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(", ");
}

/** Inverse of formatValueList (blank items are dropped). */
export function parseValueList(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  let wasQuoted = false;
  const flush = () => {
    const v = wasQuoted ? cur : cur.trim();
    if (v) out.push(v);
    cur = "";
    wasQuoted = false;
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] ?? "";
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === ",") flush();
    else if (c === '"' && !wasQuoted && !cur.trim()) {
      quoted = true;
      wasQuoted = true;
      cur = "";
    } else if (!wasQuoted) cur += c;
  }
  flush();
  return out;
}

/** Form state for stored filters, or null when they cannot be shown in the guided editor. */
export function draftsFromFilters(value: unknown): FilterDraft[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const out: FilterDraft[] = [];
  for (const f of value) {
    if (!f || typeof f !== "object" || Array.isArray(f)) return null;
    const { field, op, value: v } = f as Record<string, unknown>;
    if (typeof field !== "string" || typeof op !== "string" || !OPS.has(op)) return null;
    let text: string;
    if (op === "in" || op === "nin") {
      const list = Array.isArray(v) ? v : [v];
      // Numbers would come back as text: keep such filters read-only instead.
      if (!list.every((x) => typeof x === "string" && x === x.trim() && x !== "")) return null;
      text = formatValueList(list as string[]);
    } else if (RANGE_OPS.has(op)) {
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      text = String(v);
    } else if (op === "exists") {
      if (typeof v !== "boolean") return null;
      text = String(v);
    } else {
      // eq / neq: only plain text survives the editor unchanged.
      if (typeof v !== "string" || v !== v.trim()) return null;
      text = v;
    }
    out.push({ field, op: op as FilterOp, value: text });
  }
  return out;
}

/** Engine filters for the drafts (blank rows are skipped). */
export function filtersFromDrafts(drafts: FilterDraft[]): QueryFilter[] {
  return drafts
    .filter((d) => d.field.trim())
    .map((d) => {
      const field = d.field.trim();
      const raw = d.value.trim();
      if (d.op === "in" || d.op === "nin") {
        return {
          field,
          op: d.op,
          value: parseValueList(raw),
        };
      }
      if (RANGE_OPS.has(d.op)) return { field, op: d.op, value: Number(raw) };
      if (d.op === "exists") return { field, op: d.op, value: raw !== "false" };
      return { field, op: d.op, value: raw };
    });
}

/** Client-side checks mirroring the engine contract (the server stays authoritative). */
export function validateFilterDrafts(drafts: FilterDraft[]): string[] {
  const issues: string[] = [];
  drafts.forEach((d, i) => {
    const n = i + 1;
    if (!d.field.trim()) {
      if (d.value.trim()) issues.push(`Filter ${n}: choose a column.`);
      return;
    }
    if (/[$.]/.test(d.field)) issues.push(`Filter ${n}: column names cannot contain $ or .`);
    if (RANGE_OPS.has(d.op) && (!d.value.trim() || !Number.isFinite(Number(d.value.trim()))))
      issues.push(`Filter ${n}: enter a number.`);
    if ((d.op === "in" || d.op === "nin") && !d.value.trim())
      issues.push(`Filter ${n}: enter at least one value, separated by commas.`);
  });
  return issues;
}

/** Plain-English summary, e.g. "region is EU and amount is greater than 10". */
export function describeFilters(drafts: FilterDraft[]) {
  const rows = drafts.filter((d) => d.field.trim());
  if (!rows.length) return "All rows";
  return rows
    .map((d) => {
      const label = FILTER_OP_OPTIONS.find((o) => o.value === d.op)?.label ?? d.op;
      if (d.op === "exists") return `${d.field} ${d.value === "false" ? "has no value" : label}`;
      return `${d.field} ${label} ${d.value}`;
    })
    .join(" and ");
}

/** Guided filter rows: column, operator, value. All rows must match (AND). */
export function FiltersEditor({
  value,
  onChange,
  idPrefix = "filter",
  help = "Only rows matching every filter are counted. For “is one of”, separate values with commas (put a value that contains a comma in double quotes). Greater/less-than filters need numbers; use the date range for dates.",
}: {
  value: FilterDraft[];
  onChange: (next: FilterDraft[]) => void;
  idPrefix?: string;
  help?: string;
}) {
  const set = (i: number, patch: Partial<FilterDraft>) =>
    onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Filters (optional)</legend>
      <p className="text-xs text-muted-foreground">{help}</p>
      {value.map((d, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`Filter ${i + 1} column`}
            id={`${idPrefix}-${i}-field`}
            placeholder="Column, e.g. region"
            className="w-40"
            value={d.field}
            onChange={(e) => set(i, { field: e.target.value })}
          />
          <select
            aria-label={`Filter ${i + 1} operator`}
            className="rounded-md border bg-background p-2 text-sm"
            value={d.op}
            onChange={(e) =>
              set(i, {
                op: e.target.value as FilterOp,
                ...(e.target.value === "exists" ? { value: "true" } : {}),
              })
            }
          >
            {FILTER_OP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {d.op === "exists" ? (
            <select
              aria-label={`Filter ${i + 1} value`}
              className="rounded-md border bg-background p-2 text-sm"
              value={d.value === "false" ? "false" : "true"}
              onChange={(e) => set(i, { value: e.target.value })}
            >
              <option value="true">yes</option>
              <option value="false">no</option>
            </select>
          ) : (
            <Input
              aria-label={`Filter ${i + 1} value`}
              placeholder={d.op === "in" || d.op === "nin" ? "EU, US" : "Value"}
              inputMode={RANGE_OPS.has(d.op) ? "decimal" : undefined}
              className="w-40"
              value={d.value}
              onChange={(e) => set(i, { value: e.target.value })}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove filter ${i + 1}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { ...EMPTY_FILTER }])}
      >
        <Plus className="mr-1 h-4 w-4" /> Add filter
      </Button>
    </fieldset>
  );
}
