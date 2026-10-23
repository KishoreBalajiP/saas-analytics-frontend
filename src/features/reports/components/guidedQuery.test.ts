import { describe, expect, it } from "vitest";

import { buildGuidedQuery, guidedFromQuery } from "./ReportsView";

describe("report guided query builder", () => {
  it("builds a strict-contract query without raw JSON", () => {
    expect(buildGuidedQuery({ datasetId: "d1", op: "count", field: "", groupBy: "" })).toEqual({
      datasetId: "d1",
      metrics: [{ op: "count" }],
    });
    expect(
      buildGuidedQuery({ datasetId: "d1", op: "sum", field: "amount", groupBy: "region" }),
    ).toEqual({
      datasetId: "d1",
      metrics: [{ op: "sum", field: "amount" }],
      groupBy: ["region"],
    });
  });

  it("round-trips guided queries and falls back to advanced for complex ones", () => {
    const q = buildGuidedQuery({ datasetId: "d1", op: "avg", field: "x", groupBy: "g" });
    expect(guidedFromQuery(q)).toEqual({ datasetId: "d1", op: "avg", field: "x", groupBy: "g" });
    expect(
      guidedFromQuery({ datasetId: "d1", metrics: [{ op: "count" }], filtersOp: "or" }),
    ).toBeNull();
    expect(guidedFromQuery(undefined)).toBeNull();
  });
});

describe("guided date range and filters", () => {
  it("builds and round-trips a date range and filters in guided mode", () => {
    const q = buildGuidedQuery({
      datasetId: "d1",
      op: "sum",
      field: "amount",
      groupBy: "",
      dateRange: { field: "order_date", preset: "last_30_days", from: "", to: "" },
      filters: [
        { field: "region", op: "in", value: "EU, US" },
        { field: "amount", op: "gt", value: "10" },
      ],
    });
    expect(q).toEqual({
      datasetId: "d1",
      metrics: [{ op: "sum", field: "amount" }],
      filters: [
        { field: "region", op: "in", value: ["EU", "US"] },
        { field: "amount", op: "gt", value: 10 },
      ],
      dateRange: { field: "order_date", preset: "last_30_days" },
    });
    const g = guidedFromQuery(q);
    expect(g?.dateRange).toEqual({ field: "order_date", preset: "last_30_days", from: "", to: "" });
    expect(g?.filters).toEqual([
      { field: "region", op: "in", value: "EU, US" },
      { field: "amount", op: "gt", value: "10" },
    ]);
    expect(
      guidedFromQuery({
        datasetId: "d1",
        metrics: [{ op: "count" }],
        dateRange: { field: "d", preset: "custom", from: "2026-01-01", to: "2026-01-31" },
      })?.dateRange,
    ).toEqual({ field: "d", preset: "custom", from: "2026-01-01", to: "2026-01-31" });
  });
});
