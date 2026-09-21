import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";

vi.mock("@/lib/api/client", () => {
  const actual = vi.importActual<typeof client>("@/lib/api/client");
  return { ...actual, request: vi.fn(), requestFull: vi.fn(), requestPaged: vi.fn() };
});

import * as dashboardsApi from "./index";

const mockedRequest = vi.mocked(client.request);
const mockedRequestFull = vi.mocked(client.requestFull);
const mockedRequestPaged = vi.mocked(client.requestPaged);

beforeEach(() => vi.clearAllMocks());

describe("dashboardsApi", () => {
  it("uses the tenant dashboard CRUD and execution endpoints", async () => {
    await dashboardsApi.list({ page: 2, limit: 20 });
    await dashboardsApi.get("d1");
    await dashboardsApi.create({ name: "Sales" });
    await dashboardsApi.update("d1", { name: "Updated" });
    await dashboardsApi.remove("d1");
    await dashboardsApi.execute("d1");

    expect(mockedRequestPaged).toHaveBeenCalledWith("/dashboards", {
      query: { page: 2, limit: 20 },
    });
    expect(mockedRequest).toHaveBeenCalledWith("/dashboards/d1", {
      query: { includeWidgets: "true" },
    });
    expect(mockedRequest).toHaveBeenCalledWith("/dashboards", {
      method: "POST",
      body: { name: "Sales" },
    });
    expect(mockedRequest).toHaveBeenCalledWith("/dashboards/d1", {
      method: "PATCH",
      body: { name: "Updated" },
    });
    expect(mockedRequest).toHaveBeenCalledWith("/dashboards/d1", { method: "DELETE" });
    expect(mockedRequest).toHaveBeenCalledWith("/dashboards/d1/execute");
  });

  it("uses widget list, CRUD, and execution endpoints", async () => {
    const body = {
      name: "Revenue",
      type: "kpi" as const,
      datasetId: "dataset1",
      position: { x: 0, y: 0, w: 6, h: 4 },
    };
    await dashboardsApi.listWidgets("d1", { page: 1, limit: 200 });
    await dashboardsApi.getWidget("d1", "w1");
    await dashboardsApi.createWidget("d1", body);
    await dashboardsApi.updateWidget("d1", "w1", { name: "Revenue updated" });
    await dashboardsApi.removeWidget("d1", "w1");
    mockedRequestFull.mockResolvedValue({
      data: { rows: [{ revenue: 12 }] },
      meta: { widgetId: "w1" },
    } as never);
    await dashboardsApi.executeWidget("d1", "w1");

    expect(mockedRequestPaged).toHaveBeenCalledWith("/dashboards/d1/widgets", {
      query: { page: 1, limit: 200 },
    });
    expect(mockedRequest).toHaveBeenCalledWith("/dashboards/d1/widgets/w1", { method: "DELETE" });
    expect(mockedRequest).toHaveBeenCalledWith("/dashboards/d1/widgets", { method: "POST", body });
    expect(mockedRequest).toHaveBeenCalledWith("/dashboards/d1/widgets/w1", {
      method: "PATCH",
      body: { name: "Revenue updated" },
    });
    expect(mockedRequestFull).toHaveBeenCalledWith("/dashboards/d1/widgets/w1/execute");
  });
});
