import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  REQUEST_ID_HEADER,
  REQUEST_TIMEOUT,
  onApiError,
  request,
  setAccessToken,
} from "./client";

// Roadmap 2.8 (findings ops.15 / ops2.14): every request carries an
// X-Request-Id, failed calls keep the id in ApiError, and requests are
// bounded by a client-side timeout.

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const failure = (extra: Record<string, unknown> = {}) => ({
  success: false,
  statusCode: 500,
  message: "Internal server error",
  code: "INTERNAL_ERROR",
  timestamp: new Date().toISOString(),
  ...extra,
});

describe("request ids", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as ReturnType<typeof vi.spyOn>;
    setAccessToken("tenant", null);
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  const sentHeaders = (call = 0) =>
    (fetchSpy.mock.calls[call]?.[1] as RequestInit).headers as Record<string, string>;

  it("sends a fresh, valid X-Request-Id on every request", async () => {
    fetchSpy.mockResolvedValueOnce(json({ success: true, data: 1 }));
    fetchSpy.mockResolvedValueOnce(json({ success: true, data: 2 }));
    await request("/a");
    await request("/b");
    const first = sentHeaders(0)[REQUEST_ID_HEADER];
    const second = sentHeaders(1)[REQUEST_ID_HEADER];
    expect(first).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
    expect(second).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
    expect(first).not.toBe(second);
  });

  it("keeps the echoed X-Request-Id on ApiError", async () => {
    fetchSpy.mockResolvedValueOnce(json(failure(), 500, { "X-Request-Id": "srv-req-000123" }));
    const err = await request("/boom").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).requestId).toBe("srv-req-000123");
    expect((err as ApiError).statusCode).toBe(500);
  });

  it("falls back to the body requestId, then to the id it sent", async () => {
    fetchSpy.mockResolvedValueOnce(json(failure({ requestId: "body-req-000456" }), 500));
    const fromBody = (await request("/boom").catch((e: unknown) => e)) as ApiError;
    expect(fromBody.requestId).toBe("body-req-000456");

    fetchSpy.mockResolvedValueOnce(json(failure(), 502));
    const fromSent = (await request("/boom").catch((e: unknown) => e)) as ApiError;
    expect(fromSent.requestId).toBe(sentHeaders(1)[REQUEST_ID_HEADER]);
  });

  it("notifies onApiError listeners and keeps working when one throws", async () => {
    const seen: ApiError[] = [];
    const offBroken = onApiError(() => {
      throw new Error("listener bug");
    });
    const off = onApiError((e) => seen.push(e));
    fetchSpy.mockResolvedValueOnce(
      json(failure({ statusCode: 404, code: "NOT_FOUND", message: "Gone" }), 404, {
        "X-Request-Id": "srv-req-000789",
      }),
    );
    const err = (await request("/x").catch((e: unknown) => e)) as ApiError;
    off();
    offBroken();
    expect(err.message).toBe("Gone");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.requestId).toBe("srv-req-000789");
  });
});

describe("request timeout", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as ReturnType<typeof vi.spyOn>;
    // A server that never answers: settles only when the signal aborts.
    fetchSpy.mockImplementation((...args: unknown[]) => {
      const init = args[1] as RequestInit | undefined;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
      });
    });
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("fails with a typed REQUEST_TIMEOUT that carries the request id", async () => {
    const err = (await request("/slow", { timeoutMs: 20 }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe(REQUEST_TIMEOUT);
    expect(err.statusCode).toBe(408);
    const sent = (fetchSpy.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(err.requestId).toBe(sent[REQUEST_ID_HEADER]);
  });

  it("a caller abort stays an AbortError (not a timeout)", async () => {
    const controller = new AbortController();
    const pending = request("/slow", { signal: controller.signal, timeoutMs: 5000 }).catch(
      (e: unknown) => e,
    );
    controller.abort();
    const err = await pending;
    expect(err).not.toBeInstanceOf(ApiError);
    expect((err as Error).name).toBe("AbortError");
  });

  it("JSON requests get a default timeout; uploads do not", async () => {
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async () => json({ success: true, data: null }));
    await request("/json");
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).signal).toBeDefined();
    const formData = new FormData();
    formData.append("file", new Blob(["a,b"]), "x.csv");
    await request("/upload", { method: "POST", formData });
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).signal).toBeUndefined();
  });
});
