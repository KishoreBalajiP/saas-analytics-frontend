import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

import {
  TenantSessionProvider,
  useTenantSession,
  storeTenantSlug,
  type SessionStatus,
} from "./session";
import * as authApi from "@/features/auth/api";
import { ApiError, setAccessToken, getAccessToken } from "@/lib/api/client";
import { rememberSession } from "./sessionHint";

vi.mock("@/features/auth/api", () => ({
  refreshTenant: vi.fn(),
  tenantMe: vi.fn(),
  logoutTenant: vi.fn(),
}));

/** Captures the provider's cross-tab sign-out listener. */
const remoteSignOut = vi.hoisted(() => ({
  listeners: [] as Array<(audience: "tenant" | "admin") => void>,
}));

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return {
    ...actual,
    onRemoteSignOut: (listener: (audience: "tenant" | "admin") => void) => {
      remoteSignOut.listeners.push(listener);
      return () => {
        remoteSignOut.listeners = remoteSignOut.listeners.filter((l) => l !== listener);
      };
    },
  };
});

const mockedAuthApi = vi.mocked(authApi);

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <TenantSessionProvider>{children}</TenantSessionProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setAccessToken("tenant", null);
  window.localStorage.clear();
  remoteSignOut.listeners = [];
});

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
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

    it("reuses the loaded profile when a protected route remounts", async () => {
      setAccessToken("tenant", "existing_token");
      mockedAuthApi.tenantMe.mockResolvedValue({
        tenantId: "tenant-1",
        email: "owner@example.test",
        permissions: [],
      } as never);

      const firstRender = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      await settle();
      expect(firstRender.result.current.status).toBe("authenticated");
      expect(firstRender.result.current.permissions).toEqual([]);

      firstRender.unmount();
      const remounted = renderHook(() => useTenantSession(), {
        wrapper: createWrapper(),
      });

      expect(remounted.result.current.status).toBe("authenticated");
      expect(remounted.result.current.me?.tenantId).toBe("tenant-1");
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

    it("denies when the permissions array is empty (same rule as lib/permissions)", async () => {
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

      // The profile endpoints return effective permissions; an empty list
      // means the user holds none, so the UI must not offer the action.
      expect(result.current.hasPermission("analytics.view")).toBe(false);
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

describe("session restore failures", () => {
  const cookieMissing = () => new ApiError("Session expired", 401, "SESSION_COOKIE_MISSING");

  it("flags blocked cookies when this browser signed in and the session should be alive", async () => {
    rememberSession("tenant", new Date(Date.now() + 60 * 60 * 1000).toISOString());
    mockedAuthApi.refreshTenant.mockRejectedValue(cookieMissing());

    const { result } = renderHook(() => useTenantSession(), { wrapper: createWrapper() });
    await settle();

    expect(result.current.status).toBe("anonymous");
    expect(result.current.restoreError).toBe("cookies_blocked");
  });

  it("does not flag a visitor who never signed in", async () => {
    mockedAuthApi.refreshTenant.mockRejectedValue(cookieMissing());

    const { result } = renderHook(() => useTenantSession(), { wrapper: createWrapper() });
    await settle();

    expect(result.current.status).toBe("anonymous");
    expect(result.current.restoreError).toBeNull();
  });

  it("does not flag a session whose cookie has simply expired", async () => {
    rememberSession("tenant", new Date(Date.now() - 1000).toISOString());
    mockedAuthApi.refreshTenant.mockRejectedValue(cookieMissing());

    const { result } = renderHook(() => useTenantSession(), { wrapper: createWrapper() });
    await settle();

    expect(result.current.restoreError).toBeNull();
  });

  it("does not flag a session the server ended (revoked or expired)", async () => {
    rememberSession("tenant", new Date(Date.now() + 60_000).toISOString());
    mockedAuthApi.refreshTenant.mockRejectedValue(
      new ApiError("Session revoked", 401, "SESSION_REVOKED"),
    );

    const { result } = renderHook(() => useTenantSession(), { wrapper: createWrapper() });
    await settle();

    expect(result.current.restoreError).toBeNull();
  });
});

describe("sign-out in another tab", () => {
  it("signs this tab out of the same portal", async () => {
    setAccessToken("tenant", "tok");
    mockedAuthApi.tenantMe.mockResolvedValue({ id: "u1", email: "t@t.com", permissions: [] });

    const { result } = renderHook(() => useTenantSession(), { wrapper: createWrapper() });
    await settle();
    expect(result.current.status).toBe("authenticated");

    act(() => remoteSignOut.listeners.forEach((listener) => listener("admin")));
    expect(result.current.status).toBe("authenticated");

    act(() => remoteSignOut.listeners.forEach((listener) => listener("tenant")));
    expect(result.current.status).toBe("anonymous");
    expect(result.current.me).toBeNull();
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
