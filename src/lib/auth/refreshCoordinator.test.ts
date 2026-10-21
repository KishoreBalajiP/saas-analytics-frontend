import { describe, expect, it, vi } from "vitest";

import {
  createRefreshCoordinator,
  type ChannelLike,
  type LockManagerLike,
  type RefreshResult,
} from "./refreshCoordinator";

/* ------------------------------ test doubles ------------------------------ */

/** Exclusive per-name locks with FIFO hand-over, like `navigator.locks`. */
function createLockManager(): LockManagerLike {
  const tails = new Map<string, Promise<unknown>>();
  return {
    request<T>(name: string, callback: () => Promise<T>) {
      const previous = tails.get(name) ?? Promise.resolve();
      const run = previous.then(() => callback());
      tails.set(
        name,
        run.catch(() => undefined),
      );
      return run;
    },
  };
}

/** Same-origin broadcast hub: every channel but the sender gets the message. */
function createHub() {
  const members = new Set<{ listeners: Array<(event: { data: unknown }) => void> }>();
  return {
    channel(): ChannelLike {
      const member = { listeners: [] as Array<(event: { data: unknown }) => void> };
      members.add(member);
      return {
        postMessage(message: unknown) {
          for (const other of members) {
            if (other === member) continue;
            const data = structuredClone(message);
            queueMicrotask(() => other.listeners.forEach((listener) => listener({ data })));
          }
        },
        addEventListener(_type, listener) {
          member.listeners.push(listener);
        },
        close() {
          members.delete(member);
        },
      };
    },
  };
}

/**
 * A server with ONE rotating refresh cookie shared by every tab (the
 * browser's cookie jar). Presenting a cookie that was already rotated is a
 * replay: the server revokes the whole family, like the backend does.
 */
function createRotatingServer({ latencyMs = 5 } = {}) {
  const state = { cookie: "rt-0", rotations: 0, replays: 0, active: 0, maxActive: 0 };
  async function refresh(): Promise<RefreshResult> {
    const presented = state.cookie; // what the browser sends at request time
    state.active += 1;
    state.maxActive = Math.max(state.maxActive, state.active);
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    state.active -= 1;
    if (presented !== state.cookie) {
      state.replays += 1;
      throw new Error("Session revoked (replay detected)");
    }
    state.rotations += 1;
    state.cookie = `rt-${state.rotations}`;
    return { accessToken: `access-${state.rotations}`, expiresIn: 900 };
  }
  return { state, refresh };
}

/* ---------------------------------- tests --------------------------------- */

describe("refresh coordination across tabs", () => {
  it("without coordination two tabs race the rotation and trip replay detection", async () => {
    // Baseline: each tab on its own (no locks, no channel).
    const server = createRotatingServer();
    const tabA = createRefreshCoordinator();
    const tabB = createRefreshCoordinator();

    const results = await Promise.allSettled([
      tabA.run("tenant", server.refresh),
      tabB.run("tenant", server.refresh),
    ]);

    expect(server.state.maxActive).toBe(2);
    expect(server.state.replays).toBe(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("with Web Locks two tabs never race: one rotation, both tabs get the token", async () => {
    const server = createRotatingServer();
    const locks = createLockManager();
    const hub = createHub();
    const tabA = createRefreshCoordinator({ locks, channel: hub.channel() });
    const tabB = createRefreshCoordinator({ locks, channel: hub.channel() });

    const [a, b] = await Promise.all([
      tabA.run("tenant", server.refresh),
      tabB.run("tenant", server.refresh),
    ]);

    expect(server.state.replays).toBe(0);
    expect(server.state.maxActive).toBe(1);
    expect(server.state.rotations).toBe(1);
    expect(a.accessToken).toBe("access-1");
    expect(b.accessToken).toBe("access-1");
  });

  it("with Web Locks but no channel, refreshes are serialised and never replay", async () => {
    const server = createRotatingServer();
    const locks = createLockManager();
    const tabs = [0, 1, 2].map(() => createRefreshCoordinator({ locks }));

    const results = await Promise.all(tabs.map((tab) => tab.run("tenant", server.refresh)));

    expect(server.state.replays).toBe(0);
    expect(server.state.maxActive).toBe(1);
    expect(results.map((r) => r.accessToken)).toEqual(["access-1", "access-2", "access-3"]);
  });

  it("without Web Locks, a tab defers to the tab that is already refreshing", async () => {
    const server = createRotatingServer({ latencyMs: 20 });
    const hub = createHub();
    const tabA = createRefreshCoordinator({ channel: hub.channel() });
    const tabB = createRefreshCoordinator({ channel: hub.channel() });

    const first = tabA.run("tenant", server.refresh);
    await Promise.resolve(); // let tab B hear "refresh-start"
    await Promise.resolve();
    const second = tabB.run("tenant", server.refresh);

    const [a, b] = await Promise.all([first, second]);
    expect(server.state.rotations).toBe(1);
    expect(server.state.replays).toBe(0);
    expect(b.accessToken).toBe(a.accessToken);
  });

  it("without Web Locks, a tab refreshes itself when the other tab's refresh fails", async () => {
    const hub = createHub();
    const tabA = createRefreshCoordinator({ channel: hub.channel() });
    const tabB = createRefreshCoordinator({ channel: hub.channel() });
    const failing = vi.fn(async (): Promise<RefreshResult> => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error("network down");
    });
    const working = vi.fn(async (): Promise<RefreshResult> => ({ accessToken: "own-token" }));

    const first = tabA.run("tenant", failing);
    await Promise.resolve();
    await Promise.resolve();
    const second = tabB.run("tenant", working);

    await expect(first).rejects.toThrow("network down");
    await expect(second).resolves.toEqual({ accessToken: "own-token" });
    expect(working).toHaveBeenCalledTimes(1);
  });

  it("without Web Locks, a tab stops waiting after peerWaitMs", async () => {
    const hub = createHub();
    const tabA = createRefreshCoordinator({ channel: hub.channel() });
    const tabB = createRefreshCoordinator({ channel: hub.channel(), peerWaitMs: 20 });
    const hanging = () => new Promise<RefreshResult>(() => undefined);
    const working = vi.fn(async (): Promise<RefreshResult> => ({ accessToken: "after-timeout" }));

    void tabA.run("tenant", hanging);
    await Promise.resolve();
    await Promise.resolve();
    await expect(tabB.run("tenant", working)).resolves.toEqual({ accessToken: "after-timeout" });
    expect(working).toHaveBeenCalledTimes(1);
  });

  it("shares a new access token with the other tabs", async () => {
    const hub = createHub();
    const onPeerRefresh = vi.fn();
    const tabA = createRefreshCoordinator({ channel: hub.channel() });
    createRefreshCoordinator({ channel: hub.channel(), onPeerRefresh });

    await tabA.run("admin", async () => ({ accessToken: "shared", expiresIn: 900 }));
    await Promise.resolve();

    expect(onPeerRefresh).toHaveBeenCalledWith("admin", { accessToken: "shared", expiresIn: 900 });
  });

  it("announces a sign-out to the other tabs only", async () => {
    const hub = createHub();
    const ownSignOut = vi.fn();
    const peerSignOut = vi.fn();
    const tabA = createRefreshCoordinator({ channel: hub.channel(), onPeerSignOut: ownSignOut });
    createRefreshCoordinator({ channel: hub.channel(), onPeerSignOut: peerSignOut });

    tabA.announceSignOut("tenant");
    await Promise.resolve();

    expect(peerSignOut).toHaveBeenCalledWith("tenant");
    expect(ownSignOut).not.toHaveBeenCalled();
  });

  it("keeps the tenant and admin portals independent", async () => {
    const locks = createLockManager();
    const tab = createRefreshCoordinator({ locks });
    const tenant = vi.fn(async () => ({ accessToken: "tenant-token" }));
    const admin = vi.fn(async () => ({ accessToken: "admin-token" }));

    const [t, a] = await Promise.all([tab.run("tenant", tenant), tab.run("admin", admin)]);

    expect(t.accessToken).toBe("tenant-token");
    expect(a.accessToken).toBe("admin-token");
    expect(tenant).toHaveBeenCalledTimes(1);
    expect(admin).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight refresh between callers in the same tab", async () => {
    const tab = createRefreshCoordinator();
    const refresh = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { accessToken: "once" };
    });

    const results = await Promise.all([tab.run("tenant", refresh), tab.run("tenant", refresh)]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(results[0]).toBe(results[1]);
  });

  it("ignores malformed messages", async () => {
    const hub = createHub();
    const onPeerRefresh = vi.fn();
    const onPeerSignOut = vi.fn();
    const rogue = hub.channel();
    createRefreshCoordinator({ channel: hub.channel(), onPeerRefresh, onPeerSignOut });

    rogue.postMessage({ type: "refreshed", audience: "tenant", tabId: "x", result: {} });
    rogue.postMessage({ type: "signed-out", audience: "everyone", tabId: "x" });
    rogue.postMessage("hello");
    await Promise.resolve();

    expect(onPeerRefresh).not.toHaveBeenCalled();
    expect(onPeerSignOut).not.toHaveBeenCalled();
  });
});
