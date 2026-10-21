import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof client>();
  return { ...actual, request: vi.fn(), requestPaged: vi.fn() };
});

import * as access from "./adminAccess";

const mockedRequest = vi.mocked(client.request);
const mockedPaged = vi.mocked(client.requestPaged);

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequest.mockResolvedValue({});
  mockedPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1 } });
});

describe("admin access API", () => {
  it("invites without a password", async () => {
    await access.inviteAdmin({ email: "a@b.com", adminType: "support" });
    expect(mockedRequest).toHaveBeenCalledWith("/admin/admins", {
      method: "POST",
      audience: "admin",
      body: { email: "a@b.com", adminType: "support" },
    });
  });

  it("lists, resends and revokes invitations", async () => {
    await access.listAdminInvitations({ status: "pending" });
    expect(mockedPaged).toHaveBeenCalledWith("/admin/admins/invitations", {
      audience: "admin",
      query: { status: "pending" },
    });
    await access.resendAdminInvitation("a1");
    expect(mockedRequest).toHaveBeenLastCalledWith("/admin/admins/a1/invitation/resend", {
      method: "POST",
      audience: "admin",
      body: {},
    });
    await access.revokeAdminInvitation("a1", "wrong address");
    expect(mockedRequest).toHaveBeenLastCalledWith("/admin/admins/a1/invitation/revoke", {
      method: "POST",
      audience: "admin",
      body: { reason: "wrong address" },
    });
  });

  it("admin-assisted resets carry the reason", async () => {
    await access.resetAdminMfaFor("a1", "lost phone");
    expect(mockedRequest).toHaveBeenLastCalledWith("/admin/admins/a1/mfa/reset", {
      method: "POST",
      audience: "admin",
      body: { reason: "lost phone" },
    });
    await access.resetAdminPasswordFor("a1", "leak");
    expect(mockedRequest).toHaveBeenLastCalledWith("/admin/admins/a1/password/reset", {
      method: "POST",
      audience: "admin",
      body: { reason: "leak" },
    });
  });
});
