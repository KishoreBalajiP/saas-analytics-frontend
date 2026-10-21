import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import { errorsFor, initialState, toWidgetBody, type BuilderState } from "./builder";

const base = (over: Partial<BuilderState> = {}): BuilderState => ({
  ...initialState(null),
  name: "Revenue by region",
  datasetId: "c1",
  ...over,
});

describe("toWidgetBody (vizbuilder)", () => {
  it("builds a valid bar widget with top N, typed filters and a date preset", () => {
    const { issues, body } = toWidgetBody(
      base({
        type: "bar",
        metrics: [{ op: "sum", field: "amount", alias: "total" }],
        groupBy: [{ field: "region", bucket: "" }],
        filters: [{ field: "amount", op: "in", value: "1, 2" }],
        dateRange: { field: "order_date", preset: "last_30_days", from: "", to: "" },
        spec: {
          xField: "region",
          numberFormat: "compact",
          currency: "",
          unit: "",
          limit: "5",
          showOther: true,
          pageSize: "",
        },
      }),
      [{ name: "amount", type: "number" }],
    );
    expect(issues).toEqual([]);
    expect(body).toEqual({
      name: "Revenue by region",
      type: "bar",
      datasetId: "c1",
      query: {
        metrics: [{ op: "sum", field: "amount", alias: "total" }],
        groupBy: [{ field: "region" }],
        filters: [{ field: "amount", op: "in", value: [1, 2] }],
        dateRange: { field: "order_date", preset: "last_30_days" },
      },
      visualization: { xField: "region", numberFormat: "compact", limit: 5, showOther: true },
    });
  });

  it("flags a KPI without an aggregate and bad filter values", () => {
    const { issues } = toWidgetBody(
      base({ type: "kpi", filters: [{ field: "amount", op: "gt", value: "abc" }] }),
      [{ name: "amount", type: "number" }],
    );
    const fields = issues.map((i) => i.field);
    expect(fields).toContain("query.metrics");
    expect(fields).toContain("query.filters[0].value");
  });
});

describe("errorsFor", () => {
  it("maps server field errors to builder sections", () => {
    const err = new ApiError("Invalid", 400, "INVALID_VISUALIZATION", [
      { field: "visualization.xField", message: "must be a groupBy field" },
      { field: "query.metrics[0].field", message: "is required for sum" },
    ]);
    expect(errorsFor(err, "visualization")).toEqual(["xField: must be a groupBy field"]);
    expect(errorsFor(err, "query.metrics")).toEqual(["[0].field: is required for sum"]);
    expect(errorsFor(err, "query.groupBy")).toEqual([]);
  });
});
