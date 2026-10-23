import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ApiError, getAccessToken, request, setAccessToken } from "./client";

// Regression: navigating to Subscription signed users out because a 401 that
// did not reject the CURRENT session (stale token, non-session code) still
// cleared the in-memory access token.

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("session preservation on 401", () => {
  beforeEach(() => setAccessToken("tenant", "current"));
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken("tenant", null);
  });

  it("does not clear the session for a non-session 401 code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/refresh")
          ? json(200, { data: { accessToken: "current" } })
          : json(401, { message: "Invalid embed token", code: "EMBED_TOKEN_INVALID" }),
      ),
    );
    await expect(request("/embed/thing")).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken("tenant")).toBe("current");
  });

  it("retries with a token refreshed concurrently instead of signing out", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>)["Authorization"];
      if (auth === "Bearer stale") {
        // Simulate another request refreshing while this one was in flight.
        setAccessToken("tenant", "fresh");
        return json(401, { message: "Invalid or expired token", code: "UNAUTHORIZED" });
      }
      return json(200, { data: { ok: true } });
    });
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("tenant", "stale");
    await expect(request("/tenants/x/subscription")).resolves.toEqual({ ok: true });
    expect(getAccessToken("tenant")).toBe("fresh");
  });

  it("keeps the session on 403/500 billing errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(500, { message: "boom" })),
    );
    await expect(request("/tenants/x/subscription")).rejects.toBeInstanceOf(ApiError);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(403, { message: "nope", code: "FORBIDDEN" })),
    );
    await expect(request("/tenants/x/plans")).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken("tenant")).toBe("current");
  });
});
