import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DATE_PRESET_OPTIONS,
  INGESTED_AT_FIELD,
  type DateRangeDraft,
} from "@/features/analytics/dateRange";
import type { DatePreset } from "@/lib/api/types";

interface DateRangeFieldsProps {
  idPrefix: string;
  value: DateRangeDraft;
  onChange: (value: DateRangeDraft) => void;
  /** Column names offered as suggestions for the date field. */
  fieldSuggestions?: string[];
  /** The workspace time zone, shown so users know how presets resolve. */
  timezone?: string | undefined;
}

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

/**
 * Pick the date column and a relative preset (or custom dates). Relative
 * presets are stored as presets and resolved by the server when the query
 * runs, in the workspace time zone.
 */
export function DateRangeFields({
  idPrefix,
  value,
  onChange,
  fieldSuggestions = [],
  timezone,
}: DateRangeFieldsProps) {
  const suggestions = Array.from(new Set([...fieldSuggestions, INGESTED_AT_FIELD]));
  const listId = `${idPrefix}-date-field-options`;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-date-preset`} className="text-xs text-muted-foreground">
            Range
          </Label>
          <select
            id={`${idPrefix}-date-preset`}
            className={selectClass}
            value={value.preset}
            onChange={(event) =>
              onChange({ ...value, preset: event.target.value as DatePreset | "" })
            }
          >
            <option value="">No date filter</option>
            {DATE_PRESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-date-field`} className="text-xs text-muted-foreground">
            Date field
          </Label>
          <Input
            id={`${idPrefix}-date-field`}
            list={listId}
            placeholder="e.g. order_date"
            value={value.field}
            disabled={!value.preset}
            onChange={(event) => onChange({ ...value, field: event.target.value })}
          />
          <datalist id={listId}>
            {suggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      </div>
      {value.preset === "custom" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-date-from`} className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id={`${idPrefix}-date-from`}
              type="date"
              value={value.from}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-date-to`} className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id={`${idPrefix}-date-to`}
              type="date"
              value={value.to}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
            />
          </div>
        </div>
      )}
      {value.preset ? (
        <p className="text-xs text-muted-foreground">
          {value.preset === "custom"
            ? "Dates are whole days"
            : "Relative ranges are worked out each time the query runs"}
          {timezone ? `, in the workspace time zone (${timezone})` : ", in the workspace time zone"}
          . Use <code>{INGESTED_AT_FIELD}</code> to filter on when rows were last synced.
        </p>
      ) : null}
    </div>
  );
}
