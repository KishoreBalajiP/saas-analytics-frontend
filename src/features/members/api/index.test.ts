import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof client>("@/lib/api/client");
  return { ...actual, request: vi.fn(), requestPaged: vi.fn() };
});

import * as membersApi from "./index";

const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);

beforeEach(() => {
  vi.clearAllMocks();
  request.mockResolvedValue({} as never);
  requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1 } });
});

describe("membersApi", () => {
  it("lists members with search and status filters", async () => {
    await membersApi.listMembers({ search: "ann", status: "active", page: 2, limit: 20 });
    expect(requestPaged).toHaveBeenCalledWith("/workspace/members", {
      query: { search: "ann", status: "active", page: 2, limit: 20 },
    });
  });

  it("replaces a member's roles with PUT", async () => {
    await membersApi.setMemberRoles("u1", ["r1", "r2"]);
    expect(request).toHaveBeenCalledWith("/workspace/members/u1/roles", {
      method: "PUT",
      body: { roleIds: ["r1", "r2"] },
    });
  });

  it("deactivates, reactivates and removes members", async () => {
    await membersApi.deactivateMember("u1", "left");
    expect(request).toHaveBeenCalledWith("/workspace/members/u1/deactivate", {
      method: "POST",
      body: { reason: "left" },
    });
    await membersApi.reactivateMember("u1");
    expect(request).toHaveBeenCalledWith("/workspace/members/u1/reactivate", {
      method: "POST",
      body: {},
    });
    await membersApi.removeMember("u1");
    expect(request).toHaveBeenCalledWith("/workspace/members/u1", { method: "DELETE" });
  });

  it("covers the invitation lifecycle", async () => {
    await membersApi.listInvitations({ status: "expired" });
    expect(requestPaged).toHaveBeenCalledWith("/workspace/invitations", {
      query: { status: "expired" },
    });
    await membersApi.invite({ email: "a@example.com", roleName: "Viewer" });
    expect(request).toHaveBeenCalledWith("/workspace/invitations", {
      method: "POST",
      body: { email: "a@example.com", roleName: "Viewer" },
    });
    await membersApi.resendInvitation("i1");
    expect(request).toHaveBeenCalledWith("/workspace/invitations/i1/resend", {
      method: "POST",
      body: {},
    });
    await membersApi.revokeInvitation("i1");
    expect(request).toHaveBeenCalledWith("/workspace/invitations/i1/revoke", {
      method: "POST",
      body: {},
    });
  });

  it("manages custom roles", async () => {
    await membersApi.listRoles();
    expect(request).toHaveBeenCalledWith("/workspace/roles");
    await membersApi.listPermissionCatalogue();
    expect(request).toHaveBeenCalledWith("/workspace/roles/permissions");
    await membersApi.createRole({ name: "Dev", permissions: ["api_keys.view"] });
    expect(request).toHaveBeenCalledWith("/workspace/roles", {
      method: "POST",
      body: { name: "Dev", permissions: ["api_keys.view"] },
    });
    await membersApi.updateRole("r1", { permissions: ["embed.view"] });
    expect(request).toHaveBeenCalledWith("/workspace/roles/r1", {
      method: "PATCH",
      body: { permissions: ["embed.view"] },
    });
    await membersApi.deleteRole("r1");
    expect(request).toHaveBeenCalledWith("/workspace/roles/r1", { method: "DELETE" });
  });

  it("sends the password with ownership transfer and deletion", async () => {
    await membersApi.transferOwnership("u2", "secret");
    expect(request).toHaveBeenCalledWith("/workspace/ownership/transfer", {
      method: "POST",
      body: { userId: "u2", password: "secret" },
    });
    await membersApi.getDeletionContext();
    expect(request).toHaveBeenCalledWith("/workspace/deletion");
    await membersApi.requestDeletion({ confirm: "acme", password: "secret" });
    expect(request).toHaveBeenCalledWith("/workspace/deletion", {
      method: "POST",
      body: { confirm: "acme", password: "secret" },
    });
  });

  it("uses the admin audience for platform deletion oversight", async () => {
    await membersApi.getTenantDeletion("t1");
    expect(request).toHaveBeenCalledWith("/tenants/t1/deletion", { audience: "admin" });
    await membersApi.cancelTenantDeletion("t1", "customer asked");
    expect(request).toHaveBeenCalledWith("/tenants/t1/deletion/cancel", {
      method: "POST",
      audience: "admin",
      body: { reason: "customer asked" },
    });
  });
});
