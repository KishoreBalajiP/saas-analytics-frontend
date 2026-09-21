import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "@/lib/api/client";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof client>();
  return {
    ...actual,
    request: vi.fn(),
  };
});

const mockedRequest = vi.mocked(client.request);

import * as authApi from "./index";
import { getAccessToken } from "@/lib/api/client";

beforeEach(() => {
  vi.clearAllMocks();
  client.setAccessToken("tenant", null);
  client.setAccessToken("admin", null);
});

describe("authApi", () => {
  describe("loginTenant()", () => {
    it("calls POST /auth/login with X-Tenant-Id and stores access token", async () => {
      const session = {
        accessToken: "tenant_token_abc",
        expiresIn: 3600,
        actor: { id: "u1", email: "test@acme.com", tenantId: "acme", role: "member" },
      };
      mockedRequest.mockResolvedValue(session);

      const result = await authApi.loginTenant("acme", {
        email: "test@acme.com",
        password: "secret123",
      });

      expect(result).toEqual(session);
      expect(getAccessToken("tenant")).toBe("tenant_token_abc");
      expect(mockedRequest).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        audience: "tenant",
        tenantSlug: "acme",
        body: { email: "test@acme.com", password: "secret123" },
      });
    });

    it("includes mfaToken when provided", async () => {
      mockedRequest.mockResolvedValue({ accessToken: "token", expiresIn: 3600 });

      await authApi.loginTenant("acme", {
        email: "test@acme.com",
        password: "secret123",
        mfaToken: "123456",
      });

      const body = mockedRequest.mock.calls[0]?.[1]?.body as Record<string, unknown>;
      expect(body["mfaToken"]).toBe("123456");
    });

    it("does not store token when response has mfaRequired", async () => {
      mockedRequest.mockResolvedValue({ mfaRequired: true, expiresIn: 0 });

      const result = await authApi.loginTenant("acme", {
        email: "test@acme.com",
        password: "secret123",
      });

      expect(result.mfaRequired).toBe(true);
      expect(getAccessToken("tenant")).toBeNull();
    });
  });

  describe("loginAdmin()", () => {
    it("calls POST /admin-auth/login without X-Tenant-Id", async () => {
      const session = {
        accessToken: "admin_token_xyz",
        expiresIn: 3600,
        actor: { id: "a1", email: "admin@platform.com" },
      };
      mockedRequest.mockResolvedValue(session);

      const result = await authApi.loginAdmin({
        email: "admin@platform.com",
        password: "adminpass",
      });

      expect(result).toEqual(session);
      expect(getAccessToken("admin")).toBe("admin_token_xyz");
      expect(mockedRequest).toHaveBeenCalledWith("/admin-auth/login", {
        method: "POST",
        audience: "admin",
        body: { email: "admin@platform.com", password: "adminpass" },
      });
    });
  });

  describe("refreshTenant()", () => {
    it("calls POST /auth/refresh with noRefresh flag and stores token", async () => {
      mockedRequest.mockResolvedValue({ accessToken: "new_tenant_token", expiresIn: 3600 });

      await authApi.refreshTenant();

      expect(getAccessToken("tenant")).toBe("new_tenant_token");
      expect(mockedRequest).toHaveBeenCalledWith("/auth/refresh", {
        method: "POST",
        audience: "tenant",
        noRefresh: true,
      });
    });
  });

  describe("refreshAdmin()", () => {
    it("calls POST /admin-auth/refresh with noRefresh flag", async () => {
      mockedRequest.mockResolvedValue({ accessToken: "new_admin_token", expiresIn: 3600 });

      await authApi.refreshAdmin();

      expect(getAccessToken("admin")).toBe("new_admin_token");
      expect(mockedRequest).toHaveBeenCalledWith("/admin-auth/refresh", {
        method: "POST",
        audience: "admin",
        noRefresh: true,
      });
    });
  });

  describe("logoutTenant()", () => {
    it("calls POST /auth/logout and clears token", async () => {
      client.setAccessToken("tenant", "some_token");
      mockedRequest.mockResolvedValue({ success: true });

      await authApi.logoutTenant();

      expect(getAccessToken("tenant")).toBeNull();
      expect(mockedRequest).toHaveBeenCalledWith("/auth/logout", {
        method: "POST",
        audience: "tenant",
      });
    });

    it("clears token even if API call fails", async () => {
      client.setAccessToken("tenant", "some_token");
      mockedRequest.mockRejectedValue(new Error("network error"));

      await authApi.logoutTenant().catch(() => {});

      expect(getAccessToken("tenant")).toBeNull();
    });
  });

  describe("logoutAdmin()", () => {
    it("calls POST /admin-auth/logout and clears admin token", async () => {
      client.setAccessToken("admin", "admin_token");
      mockedRequest.mockResolvedValue({ success: true });

      await authApi.logoutAdmin();

      expect(getAccessToken("admin")).toBeNull();
    });
  });

  describe("tenantMe()", () => {
    it("calls GET /users/me with tenant audience", async () => {
      const me = { id: "u1", email: "test@acme.com", permissions: ["dashboards.view"] };
      mockedRequest.mockResolvedValue(me);

      const result = await authApi.tenantMe();

      expect(result).toEqual(me);
      expect(mockedRequest).toHaveBeenCalledWith("/users/me", { audience: "tenant" });
    });
  });

  describe("adminMe()", () => {
    it("calls GET /admin-auth/me with admin audience", async () => {
      const me = { id: "a1", email: "admin@platform.com", adminType: "super_admin" };
      mockedRequest.mockResolvedValue(me);

      const result = await authApi.adminMe();

      expect(result).toEqual(me);
      expect(mockedRequest).toHaveBeenCalledWith("/admin-auth/me", { audience: "admin" });
    });
  });

  describe("forgotPassword()", () => {
    it("calls POST /auth/password/forgot with public audience and X-Tenant-Id", async () => {
      mockedRequest.mockResolvedValue({ ok: true });

      const result = await authApi.forgotPassword("acme", "user@acme.com");

      expect(result.ok).toBe(true);
      expect(mockedRequest).toHaveBeenCalledWith("/auth/password/forgot", {
        method: "POST",
        audience: "public",
        tenantSlug: "acme",
        body: { email: "user@acme.com" },
      });
    });
  });

  describe("resetPassword()", () => {
    it("calls POST /auth/password/reset with public audience and X-Tenant-Id", async () => {
      mockedRequest.mockResolvedValue({ ok: true });

      const result = await authApi.resetPassword("acme", "reset_token_abc", "newpass123");

      expect(result.ok).toBe(true);
      expect(mockedRequest).toHaveBeenCalledWith("/auth/password/reset", {
        method: "POST",
        audience: "public",
        tenantSlug: "acme",
        body: { token: "reset_token_abc", newPassword: "newpass123" },
      });
    });
  });

  describe("updateTenantProfile()", () => {
    it("calls PATCH /users/me with profile fields", async () => {
      const updated = { id: "u1", email: "test@acme.com", profile: { name: "New Name" } };
      mockedRequest.mockResolvedValue(updated);

      const result = await authApi.updateTenantProfile({ name: "New Name" });

      expect(result).toEqual(updated);
      expect(mockedRequest).toHaveBeenCalledWith("/users/me", {
        method: "PATCH",
        audience: "tenant",
        body: { name: "New Name" },
      });
    });
  });

  describe("enrollMfa()", () => {
    it("calls POST /admin-auth/mfa/enroll", async () => {
      const mfaData = {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl: "otpauth://...",
        qrCodeDataUrl: "data:image/png;...",
      };
      mockedRequest.mockResolvedValue(mfaData);

      const result = await authApi.enrollMfa();

      expect(result).toEqual(mfaData);
      expect(mockedRequest).toHaveBeenCalledWith("/admin-auth/mfa/enroll", {
        method: "POST",
        audience: "admin",
      });
    });
  });

  describe("verifyMfa()", () => {
    it("calls POST /admin-auth/mfa/verify with code", async () => {
      mockedRequest.mockResolvedValue({ verified: true });

      const result = await authApi.verifyMfa("123456");

      expect(result.verified).toBe(true);
      expect(mockedRequest).toHaveBeenCalledWith("/admin-auth/mfa/verify", {
        method: "POST",
        audience: "admin",
        body: { code: "123456" },
      });
    });
  });
});
