import type { DateBucket, DatePreset, QueryDateRange } from "@/lib/api/types";

/** Presets offered in pickers (`previous_month` stays API-only, as an alias of `last_month`). */
export const DATE_PRESET_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "last_quarter", label: "Last quarter" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "custom", label: "Custom dates" },
];

export const DATE_BUCKET_OPTIONS: Array<{ value: DateBucket; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const PRESET_VALUES = new Set<string>([
  ...DATE_PRESET_OPTIONS.map((option) => option.value),
  "previous_month",
]);

/** Ingestion time: when the row was last synced, not when the event happened. */
export const INGESTED_AT_FIELD = "ingestedAt";

/** Editable form state for a date range (empty preset = no date filter). */
export interface DateRangeDraft {
  field: string;
  preset: DatePreset | "";
  from: string;
  to: string;
}

export const EMPTY_DATE_RANGE: DateRangeDraft = { field: "", preset: "", from: "", to: "" };

/** Field names may not contain `$` or `.` (the API rejects them). */
export function isSafeFieldName(value: string) {
  return value.trim().length > 0 && !/[$.]/.test(value);
}

/** Build form state from a stored or API date range (unknown shapes become empty). */
export function draftFromDateRange(value: unknown): DateRangeDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_DATE_RANGE };
  const range = value as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const preset =
    typeof range["preset"] === "string" && PRESET_VALUES.has(range["preset"])
      ? (range["preset"] as DatePreset)
      : "";
  const from = text(range["from"]).slice(0, 10);
  const to = text(range["to"]).slice(0, 10);
  return {
    field: text(range["field"]),
    // An absolute range without a preset is a custom range.
    preset: preset || (from || to ? "custom" : ""),
    from,
    to,
  };
}

/** API date range for a draft, or `undefined` when no date filter is chosen. */
export function dateRangeFromDraft(draft: DateRangeDraft): QueryDateRange | undefined {
  if (!draft.preset) return undefined;
  const field = draft.field.trim();
  if (draft.preset !== "custom") return { field, preset: draft.preset };
  const range: QueryDateRange = { field, preset: "custom" };
  // Plain dates: the API reads them as whole days in the workspace time zone.
  if (draft.from) range.from = draft.from;
  if (draft.to) range.to = draft.to;
  return range;
}

export interface DateRangeIssue {
  field: string;
  message: string;
}

/** Client-side checks mirroring the API contract (the server stays authoritative). */
export function validateDateRangeDraft(draft: DateRangeDraft, key = "dateRange"): DateRangeIssue[] {
  if (!draft.preset) return [];
  const issues: DateRangeIssue[] = [];
  if (!draft.field.trim()) {
    issues.push({ field: `${key}-field`, message: "Choose the date column the range applies to." });
  } else if (!isSafeFieldName(draft.field)) {
    issues.push({ field: `${key}-field`, message: "Field names cannot contain $ or ." });
  }
  if (draft.preset === "custom") {
    if (!draft.from && !draft.to) {
      issues.push({ field: key, message: "Enter a start date, an end date, or both." });
    } else if (draft.from && draft.to && draft.from > draft.to) {
      issues.push({ field: key, message: "Start date must be on or before end date." });
    }
  }
  return issues;
}

/** Short human description, e.g. "Last month on order_date". */
export function describeDateRange(range: QueryDateRange | null | undefined) {
  if (!range?.field) return "No date filter";
  const option = DATE_PRESET_OPTIONS.find((o) => o.value === range.preset);
  if (range.preset && range.preset !== "custom") {
    return `${option?.label ?? range.preset.replace(/_/g, " ")} on ${range.field}`;
  }
  return `${range.from ?? "…"} to ${range.to ?? "…"} on ${range.field}`;
}
