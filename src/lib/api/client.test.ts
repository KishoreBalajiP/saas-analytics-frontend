import { describe, it, expect, vi, beforeEach } from "vitest";

import { ApiError, setAccessToken, getAccessToken, subscribeTokens, request } from "./client";

// ---------------------------------------------------------------------------
// Token management (in-memory only)
// ---------------------------------------------------------------------------

describe("token management", () => {
  beforeEach(() => {
    setAccessToken("tenant", null);
    setAccessToken("admin", null);
  });

  it("stores and retrieves a tenant access token", () => {
    expect(getAccessToken("tenant")).toBeNull();
    setAccessToken("tenant", "tok_123");
    expect(getAccessToken("tenant")).toBe("tok_123");
  });

  it("stores and retrieves an admin access token independently", () => {
    setAccessToken("tenant", "t_tenant");
    setAccessToken("admin", "t_admin");
    expect(getAccessToken("tenant")).toBe("t_tenant");
    expect(getAccessToken("admin")).toBe("t_admin");
  });

  it("clears a token by setting null", () => {
    setAccessToken("tenant", "tok");
    setAccessToken("tenant", null);
    expect(getAccessToken("tenant")).toBeNull();
  });

  it("notifies subscribers on token change", () => {
    const listener = vi.fn();
    const unsub = subscribeTokens(listener);
    setAccessToken("tenant", "tok");
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    setAccessToken("tenant", "tok2");
    expect(listener).toHaveBeenCalledTimes(1); // no more calls after unsub
  });
});

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe("ApiError", () => {
  it("exposes status code and helpers", () => {
    const err = new ApiError("unauthorized", 401, "INVALID_TOKEN");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("INVALID_TOKEN");
    expect(err.isUnauthorized).toBe(true);
    expect(err.isForbidden).toBe(false);
    expect(err.isNotFound).toBe(false);
  });

  it("classifies common HTTP statuses", () => {
    expect(new ApiError("f", 403).isForbidden).toBe(true);
    expect(new ApiError("f", 404).isNotFound).toBe(true);
    expect(new ApiError("f", 422).isValidation).toBe(true);
    expect(new ApiError("f", 429).isRateLimited).toBe(true);
    expect(new ApiError("f", 501).isNotImplemented).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// request() with mocked fetch
// ---------------------------------------------------------------------------

describe("request()", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
    setAccessToken("tenant", null);
  });

  it("returns data from a successful response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "ok",
          data: { id: "1", name: "test" },
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await request<{ id: string; name: string }>("/users/me");
    expect(result).toEqual({ id: "1", name: "test" });
  });

  it("throws ApiError on non-OK response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: "Unauthorized",
          code: "INVALID_TOKEN",
          timestamp: new Date().toISOString(),
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    try {
      await request("/users/me");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).statusCode).toBe(401);
      expect((e as ApiError).code).toBe("INVALID_TOKEN");
    }
  });

  it("never logs Authorization header values", async () => {
    setAccessToken("tenant", "secret_token_abc");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: "Invalid",
          timestamp: new Date().toISOString(),
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    try {
      await request("/test");
    } catch {
      // expected
    }

    // The error message should not contain the token
    const calls = consoleSpy.mock.calls.flat().join(" ");
    expect(calls).not.toContain("secret_token_abc");
    consoleSpy.mockRestore();
  });

  it("sends X-Tenant-Id header only when tenantSlug is provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "ok",
          data: null,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await request("/auth/login", { method: "POST", tenantSlug: "acme", body: {} });

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Tenant-Id"]).toBe("acme");
  });

  it("does not send X-Tenant-Id when tenantSlug is omitted", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "ok",
          data: null,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await request("/admin-auth/login", { method: "POST", body: {} });

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Tenant-Id"]).toBeUndefined();
  });

  it("does not send Authorization header for public audience", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "ok",
          data: null,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await request("/auth/password/forgot", {
      method: "POST",
      audience: "public",
      body: { email: "test@test.com" },
    });

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});
