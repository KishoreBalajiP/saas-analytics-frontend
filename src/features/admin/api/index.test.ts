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

  it("reads job runs and queue/scheduler health with the admin audience", async () => {
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    request.mockResolvedValue({});
    await adminApi.listJobRuns({ page: 2, status: "failed" });
    await adminApi.schedulerHealth();
    await adminApi.queueHealth();
    expect(requestPaged).toHaveBeenCalledWith("/monitoring/jobs/runs", {
      audience: "admin",
      query: { page: 2, status: "failed" },
    });
    expect(request).toHaveBeenNthCalledWith(1, "/monitoring/health/scheduler", {
      audience: "admin",
    });
    expect(request).toHaveBeenNthCalledWith(2, "/monitoring/health/queue", { audience: "admin" });
  });
  it("sends support actions with the backend payloads (user id + reason)", async () => {
    request.mockResolvedValue({});
    await adminApi.recoverAccount("usr_1", "Locked out");
    await adminApi.revokeUserSessions("usr_1", "Compromised");
    await adminApi.broadcast({ tenantId: "ten_A", title: "Notice", reason: "Planned" });
    await adminApi.impersonate("usr_1", "Investigate");
    expect(request).toHaveBeenNthCalledWith(1, "/support/account/recover", {
      method: "POST",
      audience: "admin",
      body: { userId: "usr_1", reason: "Locked out" },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/support/account/revoke-sessions", {
      method: "POST",
      audience: "admin",
      body: { userId: "usr_1", reason: "Compromised" },
    });
    expect(request).toHaveBeenNthCalledWith(3, "/support/notifications/broadcast", {
      method: "POST",
      audience: "admin",
      body: { tenantId: "ten_A", title: "Notice", reason: "Planned" },
    });
    expect(request).toHaveBeenNthCalledWith(4, "/support/impersonate", {
      method: "POST",
      audience: "admin",
      body: { targetUserId: "usr_1", reason: "Investigate" },
    });
  });

  it("approves access requests with an allowed role and revokes scoped grants by tenant", async () => {
    request.mockResolvedValue({});
    await adminApi.approveAccessRequest("ar1", "ten_A", "Manager");
    await adminApi.removeAdminRole("adm_1", "role_1", "ten_A");
    await adminApi.removeAdminRole("adm_1", "role_1");
    expect(request).toHaveBeenNthCalledWith(1, "/access-requests/ar1/approve", {
      method: "POST",
      audience: "admin",
      body: { tenantId: "ten_A", note: "", roleName: "Manager" },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/admin/admins/adm_1/roles/role_1", {
      method: "DELETE",
      audience: "admin",
      query: { tenantId: "ten_A" },
    });
    expect(request).toHaveBeenNthCalledWith(3, "/admin/admins/adm_1/roles/role_1", {
      method: "DELETE",
      audience: "admin",
    });
    expect(adminApi.APPROVABLE_ROLES).toEqual(["Viewer", "Manager"]);
  });

  it("files and cancels compliance requests with the backend contract", async () => {
    request.mockResolvedValue({ requestId: "crq_1" });
    await adminApi.createComplianceRequest({
      subjectId: "usr_1",
      subjectType: "user",
      type: "export",
      reason: "Subject access request",
    });
    await adminApi.cancelComplianceRequest("crq_1", "Duplicate");
    expect(request).toHaveBeenNthCalledWith(1, "/compliance/requests", {
      method: "POST",
      audience: "admin",
      body: {
        subjectId: "usr_1",
        subjectType: "user",
        type: "export",
        reason: "Subject access request",
      },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/compliance/requests/crq_1/cancel", {
      method: "POST",
      audience: "admin",
      body: { reason: "Duplicate" },
    });
  });
});
