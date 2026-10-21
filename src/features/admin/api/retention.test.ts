import { beforeEach, describe, expect, it, vi } from "vitest";

import * as client from "@/lib/api/client";
import { Permissions } from "@/lib/permissions";

import * as adminApi from "./index";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);
beforeEach(() => vi.clearAllMocks());

describe("retention admin API contract", () => {
  it("reads mail health, the outbox and the retention status with the admin audience", async () => {
    request.mockResolvedValue({});
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    await adminApi.mailHealth();
    await adminApi.retentionStatus();
    await adminApi.listOutbox({ status: "dead", page: 2 });
    expect(request).toHaveBeenNthCalledWith(1, "/monitoring/health/mail", { audience: "admin" });
    expect(request).toHaveBeenNthCalledWith(2, "/monitoring/retention", { audience: "admin" });
    expect(requestPaged).toHaveBeenCalledWith("/monitoring/outbox", {
      audience: "admin",
      query: { status: "dead", page: 2 },
    });
  });

  it("requeues a dead letter with POST and an encoded id", async () => {
    request.mockResolvedValue({});
    await adminApi.requeueOutboxMessage("a/b");
    expect(request).toHaveBeenCalledWith("/monitoring/outbox/a%2Fb/requeue", {
      method: "POST",
      audience: "admin",
    });
  });

  it("polls export status on the audit and access-log endpoints", async () => {
    request.mockResolvedValue({ exportId: "e1", status: "queued" });
    await adminApi.auditExportStatus("e1");
    await adminApi.accessExportStatus("e2");
    expect(request).toHaveBeenNthCalledWith(1, "/audit-logs/export/e1", { audience: "admin" });
    expect(request).toHaveBeenNthCalledWith(2, "/access-logs/export/e2", { audience: "admin" });
  });

  it("names the requeue permission", () => {
    expect(Permissions.MONITORING_UPDATE).toBe("monitoring.update");
  });
});
