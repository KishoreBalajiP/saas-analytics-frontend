import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as reportsApi from "./index";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);

beforeEach(() => vi.clearAllMocks());

describe("reports API contract", () => {
  it("uses the tenant report list endpoint", async () => {
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    await reportsApi.list({ page: 1 });
    expect(requestPaged).toHaveBeenCalledWith("/reports", { query: { page: 1 } });
  });
  it("sends backend report source, schedule, and run fields", async () => {
    request.mockResolvedValue({});
    await reportsApi.create({
      name: "Weekly",
      source: "widget",
      dashboardId: "d1",
      widgetId: "w1",
      format: "csv",
      schedule: { enabled: true, cron: "0 8 * * 1", timezone: "UTC", format: "csv" },
    });
    expect(request).toHaveBeenCalledWith(
      "/reports",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ dashboardId: "d1", widgetId: "w1" }),
      }),
    );
    await reportsApi.run("r1", { format: "csv", filters: { filters: [] } });
    expect(request).toHaveBeenCalledWith(
      "/reports/r1/run",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("uses update, delete, and download endpoints", async () => {
    request.mockResolvedValue({});
    await reportsApi.update("r1", { status: "paused" });
    await reportsApi.remove("r1");
    await reportsApi.download("r1", "run1");
    expect(request).toHaveBeenNthCalledWith(
      1,
      "/reports/r1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/reports/r1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(request).toHaveBeenNthCalledWith(3, "/reports/r1/download", {
      query: { runId: "run1" },
    });
  });
});
