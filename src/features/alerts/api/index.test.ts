import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as alertsApi from "./index";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);

beforeEach(() => vi.clearAllMocks());

describe("alerts API contract", () => {
  it("lists tenant alert rules and events", async () => {
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    await alertsApi.list({ enabled: true });
    await alertsApi.listAllEvents({ page: 1 });
    expect(requestPaged).toHaveBeenNthCalledWith(1, "/alerts", { query: { enabled: true } });
    expect(requestPaged).toHaveBeenNthCalledWith(2, "/alerts/events", { query: { page: 1 } });
  });
  it("uses the supported threshold condition and evaluation endpoints", async () => {
    request.mockResolvedValue({});
    await alertsApi.create({
      name: "Revenue",
      datasetId: "d1",
      metric: "count",
      condition: "between",
      threshold: 1,
      thresholdHigh: 10,
      source: "query",
    });
    await alertsApi.update("a1", { enabled: false });
    await alertsApi.evaluate("a1");
    await alertsApi.listEvents("a1");
    expect(request).toHaveBeenNthCalledWith(
      1,
      "/alerts",
      expect.objectContaining({ method: "POST" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/alerts/a1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      "/alerts/a1/evaluate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(requestPaged).toHaveBeenCalledWith("/alerts/a1/events", { query: {} });
  });
});
