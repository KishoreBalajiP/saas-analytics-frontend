/**
 * Multi-tab refresh through the real API client.
 *
 * Two fresh module instances of `client.ts` play two browser tabs. They
 * share one cookie jar (the fake server's rotating refresh cookie), one
 * `navigator.locks` and one BroadcastChannel hub, exactly what two tabs of
 * one origin share. Both tabs hit a 401 at the same moment; the refresh
 * cookie must be rotated once, never presented twice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ClientModule = typeof import("./client");

/* ------------------------------ test doubles ------------------------------ */

function installLocks() {
  const tails = new Map<string, Promise<unknown>>();
  const locks = {
    request<T>(name: string, callback: () => Promise<T>) {
      const run = (tails.get(name) ?? Promise.resolve()).then(() => callback());
      tails.set(
        name,
        run.catch(() => undefined),
      );
      return run;
    },
  };
  Object.defineProperty(navigator, "locks", { value: locks, configurable: true });
}

function installBroadcastChannel() {
  const members = new Set<FakeBroadcastChannel>();
  class FakeBroadcastChannel {
    listeners: Array<(event: { data: unknown }) => void> = [];
    constructor(public name: string) {
      members.add(this);
    }
    postMessage(message: unknown) {
      for (const other of members) {
        if (other === this || other.name !== this.name) continue;
        const data = structuredClone(message);
        queueMicrotask(() => other.listeners.forEach((listener) => listener({ data })));
      }
    }
    addEventListener(_type: string, listener: (event: { data: unknown }) => void) {
      this.listeners.push(listener);
    }
    close() {
      members.delete(this);
    }
  }
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
}

/** Fake API: rotating refresh cookie + bearer-checked resource. */
function installServer() {
  const state = {
    // One HttpOnly refresh cookie per portal (distinct names and paths).
    cookies: { tenant: "rt-0", admin: "rt-0" } as Record<"tenant" | "admin", string>,
    rotations: 0,
    replays: 0,
    activeRefreshes: 0,
    maxActiveRefreshes: 0,
    refreshCalls: 0,
    validTokens: new Set<string>(),
    idempotencyKeys: [] as string[],
  };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (url.pathname.endsWith("/refresh")) {
      const portal = url.pathname.includes("/admin-auth/") ? "admin" : "tenant";
      state.refreshCalls += 1;
      const presented = state.cookies[portal];
      state.activeRefreshes += 1;
      state.maxActiveRefreshes = Math.max(state.maxActiveRefreshes, state.activeRefreshes);
      await new Promise((resolve) => setTimeout(resolve, 5));
      state.activeRefreshes -= 1;
      if (presented !== state.cookies[portal]) {
        state.replays += 1;
        return json(401, { success: false, message: "Session revoked", code: "SESSION_REVOKED" });
      }
      state.rotations += 1;
      state.cookies[portal] = `rt-${state.rotations}`;
      const accessToken = `access-${state.rotations}`;
      state.validTokens.add(accessToken);
      return json(200, {
        success: true,
        data: {
          accessToken,
          expiresIn: 900,
          sessionExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      });
    }
    if (headers["X-Idempotency-Key"]) state.idempotencyKeys.push(headers["X-Idempotency-Key"]);
    const token = headers["Authorization"]?.replace(/^Bearer /, "");
    if (!token || !state.validTokens.has(token)) {
      return json(401, { success: false, message: "Invalid or expired token" });
    }
    return json(200, { success: true, data: { ok: true, path: url.pathname } });
  });
  return { state, fetchSpy };
}

async function openTab(): Promise<ClientModule> {
  vi.resetModules();
  return import("./client");
}

/* ---------------------------------- tests --------------------------------- */

describe("multi-tab refresh through the API client", () => {
  let server: ReturnType<typeof installServer>;

  beforeEach(() => {
    installLocks();
    installBroadcastChannel();
    server = installServer();
    window.localStorage.clear();
  });

  afterEach(() => {
    server.fetchSpy.mockRestore();
    vi.unstubAllGlobals();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).locks;
  });

  it("two tabs hitting 401 at once rotate the refresh cookie once and both recover", async () => {
    const tabA = await openTab();
    const tabB = await openTab();
    tabA.setAccessToken("tenant", "expired-a");
    tabB.setAccessToken("tenant", "expired-b");

    const [a, b] = await Promise.all([
      tabA.request<{ ok: boolean }>("/users/me"),
      tabB.request<{ ok: boolean }>("/users/me"),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(server.state.replays).toBe(0);
    expect(server.state.maxActiveRefreshes).toBe(1);
    expect(server.state.refreshCalls).toBe(1);
    expect(tabA.getAccessToken("tenant")).toBe("access-1");
    expect(tabB.getAccessToken("tenant")).toBe("access-1");
    tabA.resetRefreshCoordination();
    tabB.resetRefreshCoordination();
  });

  it("five tabs restoring at once never present a rotated cookie", async () => {
    const tabs = await Promise.all([0, 1, 2, 3, 4].map(() => openTab()));
    const results = await Promise.all(tabs.map((tab) => tab.refreshAccessToken("tenant")));

    expect(server.state.replays).toBe(0);
    expect(server.state.maxActiveRefreshes).toBe(1);
    expect(new Set(results.map((r) => r.accessToken))).toEqual(new Set(["access-1"]));
    tabs.forEach((tab) => tab.resetRefreshCoordination());
  });

  it("a refresh in one tab updates the access token of the other tabs", async () => {
    const tabA = await openTab();
    const tabB = await openTab();
    tabB.setAccessToken("tenant", "old-b"); // a signed-in tab listens to its peers

    const result = await tabA.refreshAccessToken("tenant");
    await Promise.resolve();

    expect(tabB.getAccessToken("tenant")).toBe(result.accessToken);
    expect(server.state.refreshCalls).toBe(1);
    tabA.resetRefreshCoordination();
    tabB.resetRefreshCoordination();
  });

  it("signing out in one tab signs the other tab out", async () => {
    const tabA = await openTab();
    const tabB = await openTab();
    tabB.setAccessToken("tenant", "live-b");
    const onSignOut = vi.fn();
    tabB.onRemoteSignOut(onSignOut);

    tabA.announceSignOut("tenant");
    await Promise.resolve();

    expect(onSignOut).toHaveBeenCalledWith("tenant");
    expect(tabB.getAccessToken("tenant")).toBeNull();
    tabA.resetRefreshCoordination();
    tabB.resetRefreshCoordination();
  });

  it("the retry after a refresh reuses the request's idempotency key", async () => {
    const tab = await openTab();
    tab.setAccessToken("tenant", "expired");

    await tab.request("/connectors", { method: "POST", body: { name: "x" } });

    expect(server.state.idempotencyKeys).toHaveLength(2);
    expect(server.state.idempotencyKeys[0]).toBe(server.state.idempotencyKeys[1]);
    tab.resetRefreshCoordination();
  });

  it("tenant and admin refreshes do not share an in-flight request", async () => {
    const tab = await openTab();
    await Promise.all([tab.refreshAccessToken("tenant"), tab.refreshAccessToken("admin")]);
    const refreshPaths = server.fetchSpy.mock.calls
      .map(([input]) => new URL(String(input)).pathname)
      .filter((path) => path.endsWith("/refresh"));
    expect(refreshPaths.some((p) => p.endsWith("/auth/refresh") && !p.includes("admin"))).toBe(
      true,
    );
    expect(refreshPaths.some((p) => p.endsWith("/admin-auth/refresh"))).toBe(true);
    tab.resetRefreshCoordination();
  });

  it("a failed restore reports SESSION_COOKIE_MISSING and keeps the session hint", async () => {
    server.fetchSpy.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            message: "Session expired",
            code: "SESSION_COOKIE_MISSING",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
    );
    const tab = await openTab();
    const hint = await import("@/lib/auth/sessionHint");
    hint.rememberSession("tenant", new Date(Date.now() + 60_000).toISOString());

    await expect(tab.refreshAccessToken("tenant")).rejects.toMatchObject({
      statusCode: 401,
      code: "SESSION_COOKIE_MISSING",
    });
    expect(hint.expectsLiveSession("tenant")).toBe(true);
    tab.resetRefreshCoordination();
  });

  it("a refresh the server refuses for another reason forgets the session hint", async () => {
    server.fetchSpy.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ success: false, message: "Session revoked", code: "SESSION_REVOKED" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
    );
    const tab = await openTab();
    const hint = await import("@/lib/auth/sessionHint");
    hint.rememberSession("tenant", new Date(Date.now() + 60_000).toISOString());

    await expect(tab.refreshAccessToken("tenant")).rejects.toMatchObject({
      code: "SESSION_REVOKED",
    });
    expect(hint.expectsLiveSession("tenant")).toBe(false);
    tab.resetRefreshCoordination();
  });
});
