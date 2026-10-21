import { beforeEach, describe, expect, it, vi } from "vitest";

import * as client from "@/lib/api/client";
import * as adminApi from "./index";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);

beforeEach(() => {
  vi.clearAllMocks();
  request.mockResolvedValue({});
  requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
});

/**
 * Contract tests: each body must match backend/src/validators/support.validator.js
 * exactly (the old client sent {userId}, {email,type}, {title,body,audience}...).
 */
describe("admin support API contract", () => {
  it("starts a support session with targetUserId + reason (+ optional ticket)", async () => {
    await adminApi.impersonate("usr_1", "Investigate empty dashboard");
    await adminApi.impersonate("usr_1", "Investigate empty dashboard", "T-9");
    expect(request).toHaveBeenNthCalledWith(1, "/support/impersonate", {
      method: "POST",
      audience: "admin",
      body: { targetUserId: "usr_1", reason: "Investigate empty dashboard" },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/support/impersonate", {
      method: "POST",
      audience: "admin",
      body: { targetUserId: "usr_1", reason: "Investigate empty dashboard", ticket: "T-9" },
    });
  });

  it("stops a session with sessionId + reason", async () => {
    await adminApi.stopImpersonation("ses_1", "Resolved");
    expect(request).toHaveBeenCalledWith("/support/impersonate/stop", {
      method: "POST",
      audience: "admin",
      body: { sessionId: "ses_1", reason: "Resolved" },
    });
  });

  it("recovers an account and revokes sessions with userId + reason", async () => {
    await adminApi.recoverAccount("usr_2", "Forgot password");
    await adminApi.revokeUserSessions("usr_2", "Lost laptop");
    expect(request).toHaveBeenNthCalledWith(1, "/support/account/recover", {
      method: "POST",
      audience: "admin",
      body: { userId: "usr_2", reason: "Forgot password" },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/support/account/revoke-sessions", {
      method: "POST",
      audience: "admin",
      body: { userId: "usr_2", reason: "Lost laptop" },
    });
  });

  it("broadcasts with tenantId + title + reason (+ body only when given)", async () => {
    await adminApi.broadcast({ tenantId: "ten_1", title: "Maintenance", reason: "Planned" });
    await adminApi.broadcast({
      tenantId: "ten_1",
      title: "Maintenance",
      body: "02:00 UTC",
      reason: "Planned",
    });
    expect(request).toHaveBeenNthCalledWith(1, "/support/notifications/broadcast", {
      method: "POST",
      audience: "admin",
      body: { tenantId: "ten_1", title: "Maintenance", reason: "Planned" },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/support/notifications/broadcast", {
      method: "POST",
      audience: "admin",
      body: { tenantId: "ten_1", title: "Maintenance", reason: "Planned", body: "02:00 UTC" },
    });
  });

  it("reads diagnostics, grants and sessions with the admin audience", async () => {
    await adminApi.tenantDiagnostics("ten_1");
    await adminApi.listSupportGrants({ status: "pending", kind: "break_glass" });
    await adminApi.listSupportSessions({ mine: true, status: "active" });
    expect(request).toHaveBeenCalledWith("/support/tenants/ten_1/diagnostics", {
      audience: "admin",
    });
    expect(requestPaged).toHaveBeenNthCalledWith(1, "/support/access-grants", {
      audience: "admin",
      query: { status: "pending", kind: "break_glass" },
    });
    expect(requestPaged).toHaveBeenNthCalledWith(2, "/support/impersonations", {
      audience: "admin",
      query: { mine: true, status: "active" },
    });
  });

  it("requests, decides and revokes break-glass access with a reason", async () => {
    await adminApi.requestBreakGlass("ten_1", "INC-42: dashboards empty", "INC-42");
    await adminApi.approveBreakGlass("sag_1", "Confirmed with on-call");
    await adminApi.denyBreakGlass("sag_2", "Ask for consent");
    await adminApi.revokeSupportGrant("sag_1", "Resolved");
    expect(request).toHaveBeenNthCalledWith(1, "/support/access-grants/break-glass", {
      method: "POST",
      audience: "admin",
      body: { tenantId: "ten_1", reason: "INC-42: dashboards empty", ticket: "INC-42" },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/support/access-grants/sag_1/approve", {
      method: "POST",
      audience: "admin",
      body: { reason: "Confirmed with on-call" },
    });
    expect(request).toHaveBeenNthCalledWith(3, "/support/access-grants/sag_2/deny", {
      method: "POST",
      audience: "admin",
      body: { reason: "Ask for consent" },
    });
    expect(request).toHaveBeenNthCalledWith(4, "/support/access-grants/sag_1/revoke", {
      method: "POST",
      audience: "admin",
      body: { reason: "Resolved" },
    });
  });
});
