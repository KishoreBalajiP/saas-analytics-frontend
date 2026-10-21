import { describe, expect, it } from "vitest";

import { isGrouped, metricAlias, parseQueryJson, queryOutputs } from "./metrics";

describe("alert metric contract", () => {
  it("names metrics like the API: alias, else <op>_<field>, count for a bare count", () => {
    expect(metricAlias({ op: "sum", field: "amount" })).toBe("sum_amount");
    expect(metricAlias({ op: "sum", field: "amount", alias: "revenue" })).toBe("revenue");
    expect(metricAlias({ op: "count" })).toBe("count");
  });

  it("lists the outputs of a query, count when it defines no metrics", () => {
    expect(queryOutputs({ metrics: [{ op: "count" }, { op: "max", field: "x" }] })).toEqual([
      "count",
      "max_x",
    ]);
    expect(queryOutputs({ datasetId: "d1" })).toEqual(["count"]);
    expect(queryOutputs(undefined)).toEqual(["count"]);
    expect(queryOutputs({ metrics: [] })).toEqual(["count"]);
  });

  it("detects grouped queries and parses query JSON leniently", () => {
    expect(isGrouped({ groupBy: ["region"] })).toBe(true);
    expect(isGrouped({ groupBy: [] })).toBe(false);
    expect(parseQueryJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseQueryJson("[1]")).toBeUndefined();
    expect(parseQueryJson("{bad")).toBeUndefined();
  });
});
