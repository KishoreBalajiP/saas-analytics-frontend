import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as adminApi from "./index";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);
beforeEach(() => vi.clearAllMocks());

describe("admin API contract", () => {
  it("uses the admin audience for tenant and audit endpoints", async () => {
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    await adminApi.listTenants({ search: "acme" });
    await adminApi.listAuditLogs({ page: 1 });
    expect(requestPaged).toHaveBeenNthCalledWith(1, "/tenants", {
      audience: "admin",
      query: { search: "acme" },
    });
    expect(requestPaged).toHaveBeenNthCalledWith(2, "/audit-logs", {
      audience: "admin",
      query: { page: 1 },
    });
  });
  it("uses supported tenant lifecycle and monitoring endpoints", async () => {
    request.mockResolvedValue({});
    await adminApi.createTenant({
      slug: "acme",
      name: "Acme",
      owner: { email: "owner@example.test", name: "Owner" },
    });
    await adminApi.suspendTenant("t1", "maintenance");
    await adminApi.healthAggregate();
    expect(request).toHaveBeenNthCalledWith(
      1,
      "/tenants",
      expect.objectContaining({ audience: "admin", method: "POST" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/tenants/t1/suspend",
      expect.objectContaining({ audience: "admin", method: "POST" }),
    );
    expect(request).toHaveBeenNthCalledWith(3, "/monitoring/health/aggregate", {
      audience: "admin",
    });
  });
});
