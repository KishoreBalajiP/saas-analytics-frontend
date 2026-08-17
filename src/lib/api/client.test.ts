import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  ApiError,
  setAccessToken,
  getAccessToken,
  subscribeTokens,
  request,
  requestFull,
  requestPaged,
  redactHeaders,
  apiUrl,
} from "./client";

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
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as ReturnType<typeof vi.spyOn>;
    setAccessToken("tenant", null);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
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

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
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

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
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

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("sends X-Idempotency-Key on POST requests", async () => {
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

    await request("/connectors", { method: "POST", body: { type: "csv", name: "test" } });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Idempotency-Key"]).toBeDefined();
    expect(typeof headers["X-Idempotency-Key"]).toBe("string");
    expect(headers["X-Idempotency-Key"]!.length).toBeGreaterThan(0);
  });

  it("does not send X-Idempotency-Key on GET requests", async () => {
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

    await request("/connectors");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Idempotency-Key"]).toBeUndefined();
  });

  it("sends Authorization header when token is set", async () => {
    setAccessToken("tenant", "my_token_123");
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "ok",
          data: { id: "1" },
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await request("/users/me");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my_token_123");
  });

  it("always sends credentials: include for cookie-based refresh", async () => {
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

    await request("/users/me");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.credentials).toBe("include");
  });
});

// ---------------------------------------------------------------------------
// 401 refresh-and-retry flow
// ---------------------------------------------------------------------------

describe("401 refresh-and-retry", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as ReturnType<typeof vi.spyOn>;
    setAccessToken("tenant", null);
    // Flush any lingering refreshInFlight promise from prior tests.
    // The production code uses setTimeout(0) to reset the singleton,
    // so we wait for the macrotask queue to drain.
    await new Promise<void>((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("retries once after a successful refresh on 401", async () => {
    // First call: 401
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: "Unauthorized",
          timestamp: new Date().toISOString(),
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    // Refresh call: 200 with new token
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "ok",
          data: { accessToken: "refreshed_tok" },
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    // Retry call: 200 with data
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "ok",
          data: { id: "1" },
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await request<{ id: string }>("/users/me");
    expect(result).toEqual({ id: "1" });
    expect(getAccessToken("tenant")).toBe("refreshed_tok");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("clears token and throws if refresh also returns 401", async () => {
    setAccessToken("tenant", "expired_tok");

    // First call: 401
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: "Unauthorized",
          timestamp: new Date().toISOString(),
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    // Refresh call: also 401
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: "Invalid refresh",
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
    }

    expect(getAccessToken("tenant")).toBeNull();
  });

  it("does not retry on 401 when path contains /login or /refresh", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: "Bad credentials",
          timestamp: new Date().toISOString(),
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    try {
      await request("/auth/login", { method: "POST", body: {} });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(401);
    }

    // Should only have been called once (no retry for /login)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry when noRefresh is true", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: "Unauthorized",
          timestamp: new Date().toISOString(),
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    try {
      await request("/auth/refresh", { method: "POST", audience: "tenant", noRefresh: true });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(401);
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry for public audience", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: "Unauthorized",
          timestamp: new Date().toISOString(),
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    try {
      await request("/some/public/route", { audience: "public" });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(401);
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// requestFull() returns full envelope
// ---------------------------------------------------------------------------

describe("requestFull()", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as ReturnType<typeof vi.spyOn>;
    setAccessToken("tenant", null);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("returns full ApiResponse envelope including meta", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "ok",
          data: [{ id: "1" }],
          meta: { page: 1, limit: 10, total: 1, pages: 1, cached: true },
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const payload = await requestFull<unknown[]>("/analytics", {
      query: { connectorIds: "abc" },
    });

    expect(payload.data).toEqual([{ id: "1" }]);
    expect(payload.meta).toEqual({ page: 1, limit: 10, total: 1, pages: 1, cached: true });
    expect(payload.success).toBe(true);

    // Verify query string was sent
    const [url] = fetchSpy.mock.calls[0]!;
    expect(url).toContain("connectorIds=abc");
  });

  it("handles empty response body gracefully", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const payload = await requestFull<unknown>("/some/route");
    expect(payload.success).toBe(true);
    expect(payload.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// requestPaged() normalizes pagination
// ---------------------------------------------------------------------------

describe("requestPaged()", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as ReturnType<typeof vi.spyOn>;
    setAccessToken("tenant", null);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("normalizes pagination meta with defaults", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          statusCode: 200,
          message: "ok",
          data: [],
          meta: {},
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const paged = await requestPaged<unknown>("/connectors");
    expect(paged.data).toEqual([]);
    expect(paged.meta.page).toBe(1);
    expect(paged.meta.limit).toBe(0);
    expect(paged.meta.total).toBe(0);
    expect(paged.meta.pages).toBe(1);
  });

  it("handles non-array data by wrapping in empty array", async () => {
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

    const paged = await requestPaged<unknown>("/connectors");
    expect(paged.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// redactHeaders()
// ---------------------------------------------------------------------------

describe("redactHeaders()", () => {
  it("redacts Authorization header", () => {
    const result = redactHeaders({ Authorization: "Bearer secret123", Accept: "application/json" });
    expect(result["Authorization"]).toBe("[redacted]");
    expect(result["Accept"]).toBe("application/json");
  });

  it("redacts X-Api-Key header", () => {
    const result = redactHeaders({ "X-Api-Key": "prefix.secret_value" });
    expect(result["X-Api-Key"]).toBe("[redacted]");
  });

  it("is case-insensitive for redaction", () => {
    const result = redactHeaders({ authorization: "Bearer tok" });
    expect(result["authorization"]).toBe("[redacted]");
  });

  it("does not mutate the original headers object", () => {
    const original = { Authorization: "Bearer secret" };
    redactHeaders(original);
    expect(original["Authorization"]).toBe("Bearer secret");
  });
});

// ---------------------------------------------------------------------------
// apiUrl()
// ---------------------------------------------------------------------------

describe("apiUrl()", () => {
  it("builds a full URL with base and prefix", () => {
    const url = apiUrl("/users/me");
    expect(url).toContain("/api/v1/users/me");
    expect(url).toContain("localhost:8080");
  });

  it("appends query params", () => {
    const url = apiUrl("/analytics", { page: "1", limit: "50" });
    expect(url).toContain("page=1");
    expect(url).toContain("limit=50");
  });

  it("skips undefined/null/empty query params", () => {
    const url = apiUrl("/analytics", {
      page: "1",
      search: undefined,
      filter: null as unknown as string,
    });
    expect(url).toContain("page=1");
    expect(url).not.toContain("search=");
    expect(url).not.toContain("filter=");
  });
});

// ---------------------------------------------------------------------------
// Token isolation
// ---------------------------------------------------------------------------

describe("token isolation", () => {
  beforeEach(() => {
    setAccessToken("tenant", null);
    setAccessToken("admin", null);
  });

  it("tenant and admin tokens are independent", () => {
    setAccessToken("tenant", "tenant_tok");
    setAccessToken("admin", "admin_tok");
    expect(getAccessToken("tenant")).toBe("tenant_tok");
    expect(getAccessToken("admin")).toBe("admin_tok");

    setAccessToken("tenant", null);
    expect(getAccessToken("admin")).toBe("admin_tok");
    expect(getAccessToken("tenant")).toBeNull();
  });

  it("token is never persisted to localStorage", () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
    const localStorageGetSpy = vi.spyOn(Storage.prototype, "getItem");

    setAccessToken("tenant", "secret_token");

    // setAccessToken should NOT call localStorage.setItem
    expect(localStorageSpy).not.toHaveBeenCalled();

    // Token should only be retrievable via getAccessToken (in-memory)
    expect(getAccessToken("tenant")).toBe("secret_token");

    // localStorage should not contain the token
    const storedValue = localStorageGetSpy.mock.results.find((r) => r.value === "secret_token");
    expect(storedValue).toBeUndefined();

    localStorageSpy.mockRestore();
    localStorageGetSpy.mockRestore();
  });
});
