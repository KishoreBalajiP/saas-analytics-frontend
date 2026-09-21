import { describe, expect, it } from "vitest";

import { validateAnalyticsQuery } from "./validation";

describe("validateAnalyticsQuery", () => {
  it("requires a dataset and rejects incomplete query rows", () => {
    const errors = validateAnalyticsQuery({
      metrics: [{ field: "", op: "sum" }],
      filters: [{ field: "status", op: "eq", value: "" }],
    });

    expect(errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(["connectors", "metric-0", "filter-0"]),
    );
  });

  it("rejects invalid pagination, duplicate groups, and unsafe field names", () => {
    const errors = validateAnalyticsQuery({
      connectorIds: ["connector-1"],
      groupBy: ["region", "region"],
      orderBy: [{ field: "$where", dir: "asc" }],
      page: 0,
      limit: 201,
    });

    expect(errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(["page", "limit", "groupBy", "sort-0"]),
    );
  });

  it("rejects a reversed date range", () => {
    const errors = validateAnalyticsQuery({
      connectorIds: ["connector-1"],
      dateRange: { from: "2026-02-01", to: "2026-01-01" },
    });

    expect(errors).toEqual([
      { field: "dateRange", message: "Start date must be on or before end date." },
    ]);
  });

  it("accepts a complete supported query", () => {
    expect(
      validateAnalyticsQuery({
        connectorIds: ["connector-1"],
        metrics: [{ field: "revenue", op: "sum" }],
        groupBy: ["region"],
        filters: [{ field: "status", op: "eq", value: "active" }],
        orderBy: [{ field: "revenue", dir: "desc" }],
        dateRange: { from: "2026-01-01", to: "2026-01-31" },
        page: 1,
        limit: 50,
      }),
    ).toEqual([]);
  });
});
