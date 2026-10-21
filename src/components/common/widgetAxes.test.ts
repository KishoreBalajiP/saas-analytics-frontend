import { describe, expect, it } from "vitest";

import { axesOf, makeNumberFormatter } from "./widgetAxes";
import type { ResolvedVisualization } from "@/lib/api/types";

const viz = (over: Partial<ResolvedVisualization> = {}): ResolvedVisualization => ({
  type: "bar",
  xField: "year",
  xBucket: null,
  dimensions: ["year"],
  measures: ["revenue"],
  numberFormat: "number",
  currency: null,
  unit: null,
  sort: null,
  limit: null,
  showOther: false,
  nullHandling: "skip",
  pageSize: null,
  columns: null,
  ...over,
});

describe("axesOf (vizbuilder)", () => {
  const rows = [
    { year: 2023, revenue: 10 },
    { year: 2024, revenue: 20 },
  ];

  it("keeps a numeric dimension as the category axis when the spec says so", () => {
    expect(axesOf(rows, viz())).toEqual({ nameKey: "year", valueKeys: ["revenue"] });
  });

  it("without a spec falls back to type guessing (numeric year becomes a series)", () => {
    expect(axesOf(rows, null).valueKeys).toContain("year");
  });
});

describe("makeNumberFormatter", () => {
  it("formats currency, percent and units", () => {
    expect(makeNumberFormatter(viz({ numberFormat: "currency", currency: "EUR" }))(5)).toMatch(/5/);
    expect(makeNumberFormatter(viz({ numberFormat: "percent" }))(0.25)).toBe("25%");
    expect(makeNumberFormatter(viz({ unit: "kg" }))(3)).toBe("3 kg");
  });
});
