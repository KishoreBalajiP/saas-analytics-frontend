import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "./client";

vi.mock("./client", () => {
  const actual = vi.importActual<typeof client>("./client");
  return {
    ...actual,
    request: vi.fn(),
    requestFull: vi.fn(),
    requestPaged: vi.fn(),
  };
});

const mockedRequestFull = vi.mocked(client.requestFull);
const mockedRequest = vi.mocked(client.request);
const mockedRequestPaged = vi.mocked(client.requestPaged);

import * as analyticsApi from "./analytics";
import type { AnalyticsQueryParams } from "./types";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyticsApi", () => {
  describe("serializeQueryParams()", () => {
    it("returns empty query when params are empty", () => {
      expect(analyticsApi.serializeQueryParams({})).toEqual({});
    });

    it("serializes connectorIds as comma-separated string", () => {
      const params: AnalyticsQueryParams = { connectorIds: ["abc", "def"] };
      expect(analyticsApi.serializeQueryParams(params)).toEqual({
        connectorIds: "abc,def",
      });
    });

    it("omits empty connectorIds array", () => {
      expect(analyticsApi.serializeQueryParams({ connectorIds: [] })).toEqual({});
    });

    it("serializes filters as JSON string", () => {
      const params: AnalyticsQueryParams = {
        filters: [{ field: "age", op: "gt", value: 18 }],
      };
      const result = analyticsApi.serializeQueryParams(params);
      expect(result["filters"]).toBe(JSON.stringify([{ field: "age", op: "gt", value: 18 }]));
    });

    it("serializes multiple filters as JSON string", () => {
      const filters = [
        { field: "age", op: "gte" as const, value: 18 },
        { field: "status", op: "eq" as const, value: "active" },
        { field: "tags", op: "in" as const, value: ["premium", "enterprise"] },
      ];
      const params: AnalyticsQueryParams = { filters };
      const result = analyticsApi.serializeQueryParams(params);
      expect(JSON.parse(result["filters"] as string)).toEqual(filters);
    });

    it("serializes filtersOp", () => {
      const params: AnalyticsQueryParams = { filtersOp: "or" };
      expect(analyticsApi.serializeQueryParams(params)).toEqual({ filtersOp: "or" });
    });

    it("serializes dateRange as JSON string", () => {
      const params: AnalyticsQueryParams = {
        dateRange: { from: "2025-01-01T00:00:00Z", to: "2025-12-31T23:59:59Z" },
      };
      const result = analyticsApi.serializeQueryParams(params);
      expect(result["dateRange"]).toBe(
        JSON.stringify({ from: "2025-01-01T00:00:00Z", to: "2025-12-31T23:59:59Z" }),
      );
    });

    it("omits dateRange when both from and to are empty", () => {
      const params: AnalyticsQueryParams = { dateRange: { from: "", to: "" } };
      expect(analyticsApi.serializeQueryParams(params)).toEqual({});
    });

    it("includes dateRange when only from is set", () => {
      const params: AnalyticsQueryParams = { dateRange: { from: "2025-01-01T00:00:00Z", to: "" } };
      const result = analyticsApi.serializeQueryParams(params);
      expect(result["dateRange"]).toBeDefined();
    });

    it("serializes metrics as JSON string", () => {
      const metrics = [
        { field: "revenue", op: "sum" as const, alias: "total_revenue" },
        { field: "id", op: "count" as const },
      ];
      const params: AnalyticsQueryParams = { metrics };
      const result = analyticsApi.serializeQueryParams(params);
      expect(JSON.parse(result["metrics"] as string)).toEqual(metrics);
    });

    it("serializes groupBy as JSON string", () => {
      const params: AnalyticsQueryParams = { groupBy: ["category", "region"] };
      const result = analyticsApi.serializeQueryParams(params);
      expect(JSON.parse(result["groupBy"] as string)).toEqual(["category", "region"]);
    });

    it("serializes orderBy as JSON string", () => {
      const orderBy = [
        { field: "revenue", dir: "desc" as const },
        { field: "date", dir: "asc" as const },
      ];
      const params: AnalyticsQueryParams = { orderBy };
      const result = analyticsApi.serializeQueryParams(params);
      expect(JSON.parse(result["orderBy"] as string)).toEqual(orderBy);
    });

    it("serializes page and limit as numbers", () => {
      const params: AnalyticsQueryParams = { page: 3, limit: 50 };
      const result = analyticsApi.serializeQueryParams(params);
      expect(result["page"]).toBe(3);
      expect(result["limit"]).toBe(50);
    });

    it("omits page and limit when not set", () => {
      const result = analyticsApi.serializeQueryParams({});
      expect(result["page"]).toBeUndefined();
      expect(result["limit"]).toBeUndefined();
    });

    it("serializes all params together", () => {
      const params: AnalyticsQueryParams = {
        connectorIds: ["abc"],
        filters: [{ field: "x", op: "eq", value: 1 }],
        filtersOp: "and",
        dateRange: { from: "2025-01-01", to: "2025-12-31" },
        metrics: [{ field: "x", op: "count" }],
        groupBy: ["x"],
        orderBy: [{ field: "x", dir: "asc" }],
        page: 1,
        limit: 25,
      };
      const result = analyticsApi.serializeQueryParams(params);
      expect(result["connectorIds"]).toBe("abc");
      expect(result["filters"]).toBe(JSON.stringify(params.filters));
      expect(result["filtersOp"]).toBe("and");
      expect(result["dateRange"]).toBe(JSON.stringify(params.dateRange));
      expect(result["metrics"]).toBe(JSON.stringify(params.metrics));
      expect(result["groupBy"]).toBe(JSON.stringify(["x"]));
      expect(result["orderBy"]).toBe(JSON.stringify(params.orderBy));
      expect(result["page"]).toBe(1);
      expect(result["limit"]).toBe(25);
    });

    it("does not include invalid filter operators in the serializer (they pass through)", () => {
      // The serializer is a transport layer — it does not validate operators.
      // Validation is the backend's responsibility.
      const params: AnalyticsQueryParams = {
        filters: [{ field: "$where", op: "eq" as const, value: "return true" }],
      };
      const result = analyticsApi.serializeQueryParams(params);
      const parsed = JSON.parse(result["filters"] as string);
      // The serializer faithfully sends whatever the QueryBuilder produces
      expect(parsed[0]["field"]).toBe("$where");
    });
  });

  describe("runQuery()", () => {
    it("calls GET /analytics with serialized query params", async () => {
      const result = {
        rows: [{ category: "A", count: 10 }],
        total: 1,
        page: 1,
        pages: 1,
      };
      const meta = { executedAt: "2025-01-01T00:00:00Z", cached: false };
      mockedRequestFull.mockResolvedValue({
        success: true,
        statusCode: 200,
        message: "OK",
        data: result,
        meta,
        timestamp: "2025-01-01T00:00:00Z",
      });

      const params: AnalyticsQueryParams = {
        connectorIds: ["abc"],
        metrics: [{ field: "id", op: "count" }],
      };
      const output = await analyticsApi.runQuery(params);

      expect(output.result).toEqual(result);
      expect(output.meta).toEqual(meta);
      expect(mockedRequestFull).toHaveBeenCalledWith("/analytics", {
        query: {
          connectorIds: "abc",
          metrics: JSON.stringify([{ field: "id", op: "count" }]),
        },
      });
    });
  });

  describe("listQueries()", () => {
    it("calls GET /analytics/queries with pagination", async () => {
      const records = [
        { _id: "q1", status: "completed", createdAt: "2025-01-01" },
        { _id: "q2", status: "running", createdAt: "2025-01-02" },
      ];
      mockedRequestPaged.mockResolvedValue({
        data: records,
        meta: { page: 1, limit: 20, total: 2, pages: 1 },
      });

      const result = await analyticsApi.listQueries({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(mockedRequestPaged).toHaveBeenCalledWith("/analytics/queries", {
        query: { page: 1, limit: 20 },
      });
    });

    it("passes empty query by default", async () => {
      mockedRequestPaged.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 0, total: 0, pages: 0 },
      });

      await analyticsApi.listQueries();

      expect(mockedRequestPaged).toHaveBeenCalledWith("/analytics/queries", { query: {} });
    });
  });

  describe("getQuery()", () => {
    it("calls GET /analytics/queries/:id", async () => {
      const record = { _id: "q1", status: "completed", params: { connectorIds: ["abc"] } };
      mockedRequest.mockResolvedValue(record);

      const result = await analyticsApi.getQuery("q1");

      expect(result).toEqual(record);
      expect(mockedRequest).toHaveBeenCalledWith("/analytics/queries/q1");
    });
  });

  describe("exportQuery()", () => {
    it("calls POST /analytics/export with format and params (minus pagination)", async () => {
      const exportResult = { accepted: true, exportId: "exp_123", status: "queued" };
      mockedRequest.mockResolvedValue(exportResult);

      const params: AnalyticsQueryParams = {
        connectorIds: ["abc"],
        metrics: [{ field: "id", op: "count" }],
        page: 3,
        limit: 50,
      };
      const result = await analyticsApi.exportQuery(params, "csv");

      expect(result).toEqual(exportResult);
      expect(mockedRequest).toHaveBeenCalledTimes(1);
      const [path, opts] = mockedRequest.mock.calls[0]!;
      expect(path).toBe("/analytics/export");
      expect(opts?.method).toBe("POST");
      // Body should include format and params but NOT page/limit
      const body = opts?.body as Record<string, unknown>;
      expect(body["format"]).toBe("csv");
      expect(body["connectorIds"]).toEqual(["abc"]);
      expect(body["metrics"]).toEqual([{ field: "id", op: "count" }]);
      expect(body["page"]).toBeUndefined();
      expect(body["limit"]).toBeUndefined();
    });

    it("supports json and xlsx formats", async () => {
      mockedRequest.mockResolvedValue({ accepted: true, exportId: "exp_456", status: "queued" });

      await analyticsApi.exportQuery({ connectorIds: ["abc"] }, "json");
      const body1 = mockedRequest.mock.calls[0]?.[1]?.body as Record<string, unknown>;
      expect(body1["format"]).toBe("json");

      await analyticsApi.exportQuery({ connectorIds: ["abc"] }, "xlsx");
      const body2 = mockedRequest.mock.calls[1]?.[1]?.body as Record<string, unknown>;
      expect(body2["format"]).toBe("xlsx");
    });
  });
});
