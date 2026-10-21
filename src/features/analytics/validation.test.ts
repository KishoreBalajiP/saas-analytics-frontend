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
      orderBy: [{ field: "$where", direction: "asc" }],
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
      dateRange: { field: "order_date", from: "2026-02-01", to: "2026-01-01" },
    });

    expect(errors).toEqual([
      { field: "dateRange", message: "Start date must be on or before end date." },
    ]);
  });

  it("requires the date column for any date range and checks its name", () => {
    expect(
      validateAnalyticsQuery({
        connectorIds: ["c1"],
        dateRange: { field: "", preset: "last_month" },
      }).map((e) => e.field),
    ).toEqual(["dateRange-field"]);
    expect(
      validateAnalyticsQuery({
        connectorIds: ["c1"],
        dateRange: { field: "data.order_date", preset: "today" },
      }),
    ).toEqual([{ field: "dateRange-field", message: "Field names cannot contain $ or ." }]);
  });

  it("needs bounds for a custom range but none for a relative preset", () => {
    expect(
      validateAnalyticsQuery({
        connectorIds: ["c1"],
        dateRange: { field: "order_date", preset: "custom" },
      }).map((e) => e.field),
    ).toEqual(["dateRange"]);
    expect(
      validateAnalyticsQuery({
        connectorIds: ["c1"],
        dateRange: { field: "order_date", preset: "this_quarter" },
      }),
    ).toEqual([]);
  });

  it("mirrors the API name rule ($ and . are rejected anywhere) and allows a bare count", () => {
    const errors = validateAnalyticsQuery({
      connectorIds: ["c1"],
      metrics: [
        { field: "", op: "count" },
        { field: "a.b", op: "sum" },
      ],
      groupBy: [{ field: "x$y", bucket: "month" }],
      filters: [{ field: "nested.key", op: "eq", value: 1 }],
    });
    expect(errors.map((e) => e.field)).toEqual(["metric-1", "group-0", "filter-0"]);
  });

  it("accepts a complete supported query", () => {
    expect(
      validateAnalyticsQuery({
        connectorIds: ["connector-1"],
        metrics: [{ field: "revenue", op: "sum" }],
        groupBy: ["region"],
        filters: [{ field: "status", op: "eq", value: "active" }],
        orderBy: [{ field: "revenue", direction: "desc" }],
        dateRange: { field: "order_date", from: "2026-01-01", to: "2026-01-31" },
        page: 1,
        limit: 50,
      }),
    ).toEqual([]);
  });
});
