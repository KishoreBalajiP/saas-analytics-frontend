import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

import {
  TenantSessionProvider,
  useTenantSession,
  storeTenantSlug,
  type SessionStatus,
} from "./session";
import * as authApi from "@/lib/api/auth";
import { setAccessToken, getAccessToken } from "@/lib/api/client";

vi.mock("@/lib/api/auth", () => ({
  refreshTenant: vi.fn(),
  tenantMe: vi.fn(),
  logoutTenant: vi.fn(),
}));

const mockedAuthApi = vi.mocked(authApi);

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <TenantSessionProvider>{children}</TenantSessionProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("tenant", null);
});

describe("TenantSessionProvider", () => {
  describe("initial loading", () => {
    it("starts with loading status", () => {
      // Prevent the auto-load from completing
      mockedAuthApi.refreshTenant.mockRejectedValue(new Error("no session"));
      mockedAuthApi.tenantMe.mockRejectedValue(new Error("not authenticated"));

      const { result } = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      expect(result.current.status).toBe("loading");
    });
  });

  describe("anonymous session", () => {
    it("sets anonymous when refresh fails", async () => {
      mockedAuthApi.refreshTenant.mockRejectedValue(new Error("no session"));
      mockedAuthApi.tenantMe.mockRejectedValue(new Error("not authenticated"));

      const { result } = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      // Wait for the load effect to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.status).toBe("anonymous");
      expect(result.current.me).toBeNull();
    });
  });

  describe("authenticated session", () => {
    it("sets authenticated when me() succeeds with token", async () => {
      setAccessToken("tenant", "existing_token");
      const me = {
        id: "u1",
        email: "test@acme.com",
        tenantId: "acme",
        permissions: ["dashboards.view", "analytics.view"],
      };
      mockedAuthApi.tenantMe.mockResolvedValue(me);

      const { result } = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.status).toBe("authenticated");
      expect(result.current.me?.email).toBe("test@acme.com");
      expect(result.current.tenantSlug).toBe("acme");
      expect(result.current.permissions).toEqual(["dashboards.view", "analytics.view"]);
    });

    it("refreshes then fetches me when no token exists", async () => {
      mockedAuthApi.refreshTenant.mockResolvedValue({
        accessToken: "new_token",
        expiresIn: 3600,
      });
      const me = { id: "u1", email: "test@acme.com", permissions: [] };
      mockedAuthApi.tenantMe.mockResolvedValue(me);

      const { result } = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(mockedAuthApi.refreshTenant).toHaveBeenCalled();
      expect(result.current.status).toBe("authenticated");
    });
  });

  describe("setSession()", () => {
    it("sets authenticated state with profile", async () => {
      mockedAuthApi.refreshTenant.mockRejectedValue(new Error("no session"));
      mockedAuthApi.tenantMe.mockRejectedValue(new Error("no session"));

      const { result } = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const me = { id: "u1", email: "test@acme.com", tenantId: "acme" };
      act(() => {
        result.current.setSession(me, "acme");
      });

      expect(result.current.status).toBe("authenticated");
      expect(result.current.me).toEqual(me);
      expect(result.current.tenantSlug).toBe("acme");
    });
  });

  describe("hasPermission()", () => {
    it("returns true when user has the permission", async () => {
      setAccessToken("tenant", "tok");
      mockedAuthApi.tenantMe.mockResolvedValue({
        id: "u1",
        email: "t@t.com",
        permissions: ["analytics.view", "connectors.view"],
      });

      const { result } = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.hasPermission("analytics.view")).toBe(true);
      expect(result.current.hasPermission("dashboards.view")).toBe(false);
    });

    it("returns true when permissions array is empty (backend authoritative)", async () => {
      setAccessToken("tenant", "tok");
      mockedAuthApi.tenantMe.mockResolvedValue({
        id: "u1",
        email: "t@t.com",
        permissions: [],
      });

      const { result } = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Empty permissions means "backend stays authoritative; UX-only gate"
      expect(result.current.hasPermission("analytics.view")).toBe(true);
    });
  });

  describe("signOut()", () => {
    it("clears session and calls logout", async () => {
      setAccessToken("tenant", "tok");
      mockedAuthApi.tenantMe.mockResolvedValue({
        id: "u1",
        email: "t@t.com",
        permissions: [],
      });
      mockedAuthApi.logoutTenant.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.status).toBe("authenticated");

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.status).toBe("anonymous");
      expect(result.current.me).toBeNull();
      expect(mockedAuthApi.logoutTenant).toHaveBeenCalled();
    });
  });

  describe("permissions extraction", () => {
    it("defaults to empty array when me has no permissions", async () => {
      setAccessToken("tenant", "tok");
      mockedAuthApi.tenantMe.mockResolvedValue({
        id: "u1",
        email: "t@t.com",
      });

      const { result } = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current.permissions).toEqual([]);
    });
  });
});

describe("storeTenantSlug()", () => {
  it("writes to localStorage", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    storeTenantSlug("acme");
    expect(spy).toHaveBeenCalledWith("saas.tenantSlug", "acme");
    spy.mockRestore();
  });
});
