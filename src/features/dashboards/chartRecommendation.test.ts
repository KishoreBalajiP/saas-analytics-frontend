import { describe, expect, it } from "vitest";

import { recommendChartType, supportedWidgetTypes, toWidgetQuery } from "./chartRecommendation";

const sum = { field: "amount", op: "sum" } as const;
const qty = { field: "qty", op: "sum" } as const;

describe("recommendChartType", () => {
  it("single aggregate value -> kpi", () => {
    expect(recommendChartType({ metrics: [sum] }, [{ sum_amount: 5 }])).toBe("kpi");
  });
  it("date bucket -> line", () => {
    const q = { metrics: [sum], groupBy: [{ field: "day", bucket: "month" as const }] };
    expect(recommendChartType(q, [{}, {}])).toBe("line");
  });
  it("two measures -> scatter", () => {
    expect(recommendChartType({ metrics: [sum, qty], groupBy: ["region"] }, [{}])).toBe("scatter");
  });
  it("few categories -> pie, many -> bar", () => {
    const q = { metrics: [sum], groupBy: ["region"] };
    expect(recommendChartType(q, Array(4).fill({}))).toBe("pie");
    expect(recommendChartType(q, Array(7).fill({}))).toBe("bar");
  });
  it("raw rows -> table", () => {
    expect(recommendChartType({}, [{ a: 1 }])).toBe("table");
  });
});

describe("supportedWidgetTypes", () => {
  it("mirrors the server rules", () => {
    expect(supportedWidgetTypes({ metrics: [sum] })).toEqual(["kpi", "table"]);
    expect(supportedWidgetTypes({ metrics: [sum], groupBy: ["r"] })).toContain("doughnut");
    expect(supportedWidgetTypes({ metrics: [sum], groupBy: ["r"] })).not.toContain("scatter");
    expect(supportedWidgetTypes({ metrics: [sum, qty], groupBy: ["r"] })).toContain("scatter");
    expect(supportedWidgetTypes({ metrics: [sum, qty], groupBy: ["r"] })).not.toContain("pie");
  });
});

describe("toWidgetQuery", () => {
  it("drops connector and paging keys and keeps the query exactly", () => {
    const q = toWidgetQuery({
      connectorIds: ["c1"],
      page: 2,
      limit: 50,
      metrics: [sum],
      groupBy: ["region"],
      filters: [],
      dateRange: { field: "day", preset: "last_7_days" },
    } as never);
    expect(q).toEqual({
      metrics: [sum],
      groupBy: ["region"],
      dateRange: { field: "day", preset: "last_7_days" },
    });
  });
});
