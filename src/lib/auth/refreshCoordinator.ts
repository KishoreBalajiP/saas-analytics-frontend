/**
 * Cross-tab refresh coordination.
 *
 * The backend rotates the refresh cookie on every refresh and treats reuse of
 * a rotated token as an attack (it revokes every session of the user). Two
 * tabs that refresh at the same moment would both present the same cookie and
 * the loser would trigger that revocation. This module makes a refresh
 * single-flight across every tab of the browser:
 *
 * - Within a tab, concurrent callers share one in-flight refresh per portal.
 * - Across tabs, Web Locks (`navigator.locks`) serialise refreshes per portal.
 *   A tab that waited for the lock reuses the token another tab obtained
 *   while it waited instead of rotating again.
 * - Every refresh result is broadcast over a `BroadcastChannel`, so all tabs
 *   pick up the new access token at once (and fewer refreshes happen at all).
 * - Without Web Locks, a tab that hears another tab start a refresh waits
 *   for that tab's result (bounded by `peerWaitMs`) before trying itself.
 * - Sign-out in one tab is announced so the other tabs drop their token.
 *
 * Only the short-lived access token travels between tabs (same-origin only);
 * the refresh token stays in the HttpOnly cookie.
 */

export type PortalAudience = "tenant" | "admin";

/** What a refresh produces. Shared between tabs; contains no refresh token. */
export interface RefreshResult {
  accessToken: string;
  expiresIn?: number;
  sessionExpiresAt?: string | null;
}

/** The subset of the Web Locks API this module needs. */
export interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

/** The subset of `BroadcastChannel` this module needs. */
export interface ChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  close?(): void;
}

type CoordinatorMessage =
  | { type: "refresh-start"; audience: PortalAudience; tabId: string }
  | { type: "refreshed"; audience: PortalAudience; tabId: string; result: RefreshResult }
  | { type: "refresh-failed"; audience: PortalAudience; tabId: string }
  | { type: "signed-out"; audience: PortalAudience; tabId: string };

export interface RefreshCoordinatorOptions {
  locks?: LockManagerLike | null;
  channel?: ChannelLike | null;
  now?: () => number;
  /** How long a tab without Web Locks waits for another tab's refresh. */
  peerWaitMs?: number;
  /** Another tab refreshed: adopt its access token. */
  onPeerRefresh?: (audience: PortalAudience, result: RefreshResult) => void;
  /** Another tab signed out of this portal. */
  onPeerSignOut?: (audience: PortalAudience) => void;
}

export interface RefreshCoordinator {
  /** Run `refresh` at most once at a time for `audience`, across all tabs. */
  run(audience: PortalAudience, refresh: () => Promise<RefreshResult>): Promise<RefreshResult>;
  /** Tell the other tabs this portal was signed out. */
  announceSignOut(audience: PortalAudience): void;
  dispose(): void;
}

export const REFRESH_CHANNEL_NAME = "analivo-auth";
export const refreshLockName = (audience: PortalAudience) => `analivo-auth-refresh:${audience}`;

type PeerOutcome = { result: RefreshResult } | { failed: true };

function isMessage(value: unknown): value is CoordinatorMessage {
  if (!value || typeof value !== "object") return false;
  const msg = value as Partial<CoordinatorMessage>;
  return (
    typeof msg.type === "string" &&
    typeof msg.tabId === "string" &&
    (msg.audience === "tenant" || msg.audience === "admin")
  );
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createRefreshCoordinator(
  options: RefreshCoordinatorOptions = {},
): RefreshCoordinator {
  const locks = options.locks ?? null;
  const channel = options.channel ?? null;
  const now = options.now ?? (() => Date.now());
  const peerWaitMs = options.peerWaitMs ?? 10_000;
  const tabId = randomId();

  const inflight = new Map<PortalAudience, Promise<RefreshResult>>();
  /** Latest result another tab broadcast, with the time we received it. */
  const latestPeer = new Map<PortalAudience, { result: RefreshResult; at: number }>();
  /** When another tab announced it started refreshing (no-locks fallback). */
  const peerStartedAt = new Map<PortalAudience, number>();
  const waiters = new Map<PortalAudience, Set<(outcome: PeerOutcome) => void>>();

  function post(message: CoordinatorMessage) {
    try {
      channel?.postMessage(message);
    } catch {
      /* a closed channel only loses the optimisation */
    }
  }

  function settleWaiters(audience: PortalAudience, outcome: PeerOutcome) {
    const pending = waiters.get(audience);
    if (!pending) return;
    waiters.delete(audience);
    pending.forEach((resolve) => resolve(outcome));
  }

  function onMessage(event: { data: unknown }) {
    const msg = event.data;
    if (!isMessage(msg) || msg.tabId === tabId) return;
    switch (msg.type) {
      case "refresh-start":
        peerStartedAt.set(msg.audience, now());
        break;
      case "refreshed":
        if (!msg.result || typeof msg.result.accessToken !== "string") return;
        latestPeer.set(msg.audience, { result: msg.result, at: now() });
        peerStartedAt.delete(msg.audience);
        options.onPeerRefresh?.(msg.audience, msg.result);
        settleWaiters(msg.audience, { result: msg.result });
        break;
      case "refresh-failed":
        peerStartedAt.delete(msg.audience);
        settleWaiters(msg.audience, { failed: true });
        break;
      case "signed-out":
        latestPeer.delete(msg.audience);
        peerStartedAt.delete(msg.audience);
        options.onPeerSignOut?.(msg.audience);
        settleWaiters(msg.audience, { failed: true });
        break;
    }
  }

  channel?.addEventListener("message", onMessage);

  async function refreshAndAnnounce(
    audience: PortalAudience,
    refresh: () => Promise<RefreshResult>,
  ): Promise<RefreshResult> {
    post({ type: "refresh-start", audience, tabId });
    try {
      const result = await refresh();
      post({ type: "refreshed", audience, tabId, result });
      return result;
    } catch (error) {
      post({ type: "refresh-failed", audience, tabId });
      throw error;
    }
  }

  function waitForPeer(audience: PortalAudience, timeoutMs: number): Promise<PeerOutcome | null> {
    return new Promise((resolve) => {
      const set = waiters.get(audience) ?? new Set();
      const timer = setTimeout(() => {
        set.delete(done);
        resolve(null);
      }, timeoutMs);
      function done(outcome: PeerOutcome) {
        clearTimeout(timer);
        resolve(outcome);
      }
      set.add(done);
      waiters.set(audience, set);
    });
  }

  /** Web Locks: one refresh per portal across tabs; reuse a peer's fresh result. */
  async function viaLock(
    audience: PortalAudience,
    refresh: () => Promise<RefreshResult>,
  ): Promise<RefreshResult> {
    const requestedAt = now();
    return locks!.request(refreshLockName(audience), async () => {
      const peer = latestPeer.get(audience);
      // Another tab refreshed while this one queued for the lock: the cookie
      // has already rotated, and its access token is fresh. Use it.
      if (peer && peer.at >= requestedAt) return peer.result;
      return refreshAndAnnounce(audience, refresh);
    });
  }

  /** No Web Locks: defer to a tab that is already refreshing. */
  async function viaChannel(
    audience: PortalAudience,
    refresh: () => Promise<RefreshResult>,
  ): Promise<RefreshResult> {
    const startedAt = peerStartedAt.get(audience);
    if (startedAt !== undefined && now() - startedAt < peerWaitMs) {
      const outcome = await waitForPeer(audience, peerWaitMs - (now() - startedAt));
      if (outcome && "result" in outcome) return outcome.result;
    }
    return refreshAndAnnounce(audience, refresh);
  }

  return {
    run(audience, refresh) {
      const existing = inflight.get(audience);
      if (existing) return existing;
      const strategy = locks ? viaLock : channel ? viaChannel : refreshAndAnnounce;
      const promise = strategy(audience, refresh).finally(() => {
        if (inflight.get(audience) === promise) inflight.delete(audience);
      });
      inflight.set(audience, promise);
      return promise;
    },
    announceSignOut(audience) {
      latestPeer.delete(audience);
      post({ type: "signed-out", audience, tabId });
    },
    dispose() {
      waiters.forEach((set, audience) => settleWaiters(audience, { failed: true }));
      try {
        channel?.close?.();
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * The browser's own transports, when available (both are missing during SSR
 * and in some test environments; the coordinator then degrades to in-tab
 * single-flight).
 */
export function browserTransports(): Pick<RefreshCoordinatorOptions, "locks" | "channel"> {
  const nav =
    typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: unknown }) : null;
  const locks =
    nav && nav.locks && typeof (nav.locks as LockManagerLike).request === "function"
      ? (nav.locks as LockManagerLike)
      : null;
  let channel: ChannelLike | null = null;
  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(REFRESH_CHANNEL_NAME);
      // Node (tests, SSR tooling) keeps the process alive for an open
      // channel; browsers have no `unref` and ignore this.
      (bc as unknown as { unref?: () => void }).unref?.();
      channel = bc as unknown as ChannelLike;
    } catch {
      channel = null;
    }
  }
  return { locks, channel };
}
