import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authApi from "@/features/auth/api";
import {
  ApiError,
  getAccessToken,
  isSupportSessionActive,
  refreshAccessToken,
  request,
  setAccessToken,
} from "@/lib/api/client";
import { TenantSessionProvider, useTenantSession } from "./session";
import {
  beginSupportSession,
  clearSupportSession,
  consumeSupportExit,
  endSupportSession,
  getSupportSession,
} from "./supportSession";

vi.mock("@/features/auth/api", () => ({
  refreshTenant: vi.fn(),
  tenantMe: vi.fn(),
  logoutTenant: vi.fn(),
}));

const start = {
  token: "support-token",
  sessionId: "ses_support",
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  breakGlass: false,
  user: { id: "usr_1", email: "user@acme.test", tenantId: "ten_1" },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  clearSupportSession();
  consumeSupportExit();
  setAccessToken("tenant", null);
  fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as ReturnType<typeof vi.spyOn>;
});

afterEach(() => {
  fetchSpy.mockRestore();
  clearSupportSession();
});

describe("support session client state", () => {
  it("puts the support token in the tenant slot and records the operator", () => {
    beginSupportSession(start, "operator@platform.test");
    expect(getAccessToken("tenant")).toBe("support-token");
    expect(isSupportSessionActive()).toBe(true);
    expect(getSupportSession()).toMatchObject({
      sessionId: "ses_support",
      user: { email: "user@acme.test" },
      operator: { email: "operator@platform.test" },
    });
  });

  it("never refreshes a support session into a cookie session", async () => {
    beginSupportSession(start, null);
    await expect(refreshAccessToken("tenant")).rejects.toMatchObject({
      code: "SUPPORT_SESSION_ENDED",
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    // A 401 (session ended/expired) does not trigger the refresh-and-retry.
    fetchSpy.mockResolvedValueOnce(json(401, { success: false, message: "Session ended" }));
    await expect(request("/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain("/auth/me");
  });

  it("ends the session on the server with the support token, then locally", async () => {
    beginSupportSession(start, null);
    fetchSpy.mockResolvedValueOnce(json(200, { success: true, data: { status: "ended" } }));
    await endSupportSession();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/support-session/end");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer support-token");
    expect(getAccessToken("tenant")).toBeNull();
    expect(isSupportSessionActive()).toBe(false);
    expect(getSupportSession()).toBeNull();
    expect(consumeSupportExit()).toBe(true);
    expect(consumeSupportExit()).toBe(false);
  });

  it("still clears locally when the server already ended the session", async () => {
    beginSupportSession(start, null);
    fetchSpy.mockResolvedValueOnce(json(401, { success: false, message: "Session ended" }));
    await expect(endSupportSession()).resolves.toBeUndefined();
    expect(getAccessToken("tenant")).toBeNull();
    expect(isSupportSessionActive()).toBe(false);
  });

  it("signing out of a support session ends it instead of the browser's tenant session", async () => {
    beginSupportSession(start, null);
    vi.mocked(authApi.tenantMe).mockResolvedValue({
      id: "usr_1",
      email: "user@acme.test",
      tenantId: "ten_1",
      permissions: ["dashboards.view"],
    });
    fetchSpy.mockResolvedValue(json(200, { success: true, data: { status: "ended" } }));
    const { result } = renderHook(() => useTenantSession(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <TenantSessionProvider>{children}</TenantSessionProvider>
      ),
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(result.current.status).toBe("authenticated");

    await act(async () => {
      await result.current.signOut();
    });
    expect(authApi.logoutTenant).not.toHaveBeenCalled();
    expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toContain("/support-session/end");
    expect(result.current.status).toBe("anonymous");
    expect(isSupportSessionActive()).toBe(false);
  });
});
