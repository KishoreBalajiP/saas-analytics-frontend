import { describe, expect, it } from "vitest";

import {
  dateRangeFromDraft,
  describeDateRange,
  draftFromDateRange,
  EMPTY_DATE_RANGE,
  validateDateRangeDraft,
} from "./dateRange";

describe("date range drafts", () => {
  it("keeps relative presets as presets (never frozen to dates)", () => {
    expect(
      dateRangeFromDraft({
        field: " order_date ",
        preset: "last_month",
        from: "2026-01-01",
        to: "",
      }),
    ).toEqual({
      field: "order_date",
      preset: "last_month",
    });
  });

  it("sends custom ranges as plain dates (whole days in the workspace time zone)", () => {
    expect(
      dateRangeFromDraft({
        field: "order_date",
        preset: "custom",
        from: "2026-01-01",
        to: "2026-01-31",
      }),
    ).toEqual({
      field: "order_date",
      preset: "custom",
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(dateRangeFromDraft(EMPTY_DATE_RANGE)).toBeUndefined();
  });

  it("reads stored ranges, including legacy absolute windows and unknown shapes", () => {
    expect(draftFromDateRange({ field: "ingestedAt", preset: "last_30_days" })).toEqual({
      field: "ingestedAt",
      preset: "last_30_days",
      from: "",
      to: "",
    });
    expect(
      draftFromDateRange({ from: "2024-01-01T00:00:00.000Z", to: "2024-01-31T23:59:59.999Z" }),
    ).toEqual({
      field: "",
      preset: "custom",
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(draftFromDateRange({ preset: "someday" })).toEqual(EMPTY_DATE_RANGE);
    expect(draftFromDateRange("today")).toEqual(EMPTY_DATE_RANGE);
  });

  it("validates like the API: date column required, safe name, custom bounds in order", () => {
    expect(validateDateRangeDraft(EMPTY_DATE_RANGE)).toEqual([]);
    expect(
      validateDateRangeDraft({ field: "", preset: "today", from: "", to: "" }).map((i) => i.field),
    ).toEqual(["dateRange-field"]);
    expect(
      validateDateRangeDraft({ field: "a.b", preset: "today", from: "", to: "" })[0]?.message,
    ).toMatch(/\$ or \./);
    expect(
      validateDateRangeDraft({ field: "d", preset: "custom", from: "", to: "" })[0]?.message,
    ).toMatch(/start date/i);
    expect(
      validateDateRangeDraft({
        field: "d",
        preset: "custom",
        from: "2026-02-01",
        to: "2026-01-01",
      })[0]?.message,
    ).toMatch(/on or before/);
  });

  it("describes a range for people", () => {
    expect(describeDateRange({ field: "order_date", preset: "this_quarter" })).toBe(
      "This quarter on order_date",
    );
    expect(describeDateRange({ field: "d", preset: "custom", from: "2026-01-01" })).toBe(
      "2026-01-01 to … on d",
    );
    expect(describeDateRange(undefined)).toBe("No date filter");
  });
});
