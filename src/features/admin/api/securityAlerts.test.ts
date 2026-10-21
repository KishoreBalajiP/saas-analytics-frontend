import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as api from "./securityAlerts";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);
beforeEach(() => vi.clearAllMocks());

describe("security alerts API contract", () => {
  it("lists alerts with the admin audience and drops empty filters", async () => {
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    await api.listSecurityAlerts({
      status: "open,acknowledged",
      severity: "",
      search: undefined,
      page: 2,
    });
    expect(requestPaged).toHaveBeenCalledWith("/admin/security-alerts", {
      audience: "admin",
      query: { status: "open,acknowledged", page: 2 },
    });
  });

  it("reads one alert and the rule catalogue", async () => {
    request.mockResolvedValue({});
    await api.getSecurityAlert("64b000000000000000000001");
    await api.listDetectionRules();
    expect(request).toHaveBeenNthCalledWith(1, "/admin/security-alerts/64b000000000000000000001", {
      audience: "admin",
    });
    expect(request).toHaveBeenNthCalledWith(2, "/admin/security-alerts/rules", {
      audience: "admin",
    });
  });

  it("posts triage actions with a trimmed note (or none)", async () => {
    request.mockResolvedValue({});
    await api.triageSecurityAlert("a1", "acknowledge");
    await api.triageSecurityAlert("a1", "resolve", "  blocked at the edge  ");
    await api.triageSecurityAlert("a1", "false-positive", "   ");
    expect(request).toHaveBeenNthCalledWith(1, "/admin/security-alerts/a1/acknowledge", {
      method: "POST",
      audience: "admin",
      body: {},
    });
    expect(request).toHaveBeenNthCalledWith(2, "/admin/security-alerts/a1/resolve", {
      method: "POST",
      audience: "admin",
      body: { note: "blocked at the edge" },
    });
    expect(request).toHaveBeenNthCalledWith(3, "/admin/security-alerts/a1/false-positive", {
      method: "POST",
      audience: "admin",
      body: {},
    });
  });

  it("reads status counts from the list meta", () => {
    expect(api.statusCountsOf({ statusCounts: { open: 2, resolved: 1 } })).toEqual({
      open: 2,
      acknowledged: 0,
      false_positive: 0,
      resolved: 1,
    });
    expect(api.statusCountsOf(undefined).open).toBe(0);
  });
});
