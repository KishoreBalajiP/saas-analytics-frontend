import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import {
  MAX_REPORTS_PER_MINUTE,
  buildClientErrorReport,
  configureErrorReporter,
  installGlobalErrorReporting,
  reportClientError,
  resetErrorReporter,
  scrubText,
  type ClientErrorReport,
} from "./reporter";

// Roadmap 2.8: frontend crashes reach a real sink (POST /client-errors),
// scrubbed and rate-limited, without ever throwing.

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJyZXBvcnRlciJ9.c2lnbmF0dXJlLXJlcG9ydGVy";

describe("client error reporter", () => {
  let sent: Array<{ url: string; report: ClientErrorReport }>;

  beforeEach(() => {
    resetErrorReporter();
    sent = [];
    configureErrorReporter({
      enabled: true,
      send: (url, report) => {
        sent.push({ url, report });
      },
    });
  });
  afterEach(() => {
    resetErrorReporter();
  });

  it("scrubs tokens, JWTs and email addresses", () => {
    const text = scrubText(
      `GET /invite/accept?token=abc123secret456 Bearer ${JWT} by jane@example.com /embed/0123456789abcdef0123`,
    );
    expect(text).not.toContain("abc123secret456");
    expect(text).not.toContain(JWT);
    expect(text).not.toContain("jane@example.com");
    expect(text).not.toContain("0123456789abcdef0123");
    expect(text).toContain("token=[REDACTED]");
  });

  it("sends a boundary crash to POST /client-errors with page context", () => {
    window.history.pushState({}, "", "/dashboards/abc?token=supersecret123");
    const err = new TypeError("Cannot read properties of undefined (reading 'x')");
    expect(reportClientError(err, { kind: "boundary", component: "root" })).toBe(true);
    expect(sent).toHaveLength(1);
    const { url, report } = sent[0]!;
    expect(url).toMatch(/\/client-errors$/);
    expect(report).toMatchObject({
      kind: "boundary",
      name: "TypeError",
      message: "Cannot read properties of undefined (reading 'x')",
      component: "root",
      route: "/dashboards/abc",
      portal: "tenant",
    });
    expect(report.url).toContain("token=[REDACTED]");
    expect(report.url).not.toContain("supersecret123");
    expect(report.stack).toContain("TypeError");
  });

  it("reports 5xx API errors with their reference id, but not expected 4xx", () => {
    const serverError = new ApiError(
      "Internal server error",
      500,
      "INTERNAL_ERROR",
      undefined,
      "srv-req-5000",
    );
    expect(reportClientError(serverError, { kind: "unhandledrejection" })).toBe(true);
    expect(sent[0]?.report).toMatchObject({
      requestId: "srv-req-5000",
      statusCode: 500,
      code: "INTERNAL_ERROR",
    });

    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      expect(reportClientError(new ApiError("x", status), { kind: "unhandledrejection" })).toBe(
        false,
      );
    }
    expect(
      reportClientError(new DOMException("aborted", "AbortError"), { kind: "unhandledrejection" }),
    ).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it("deduplicates repeats and caps reports per minute", () => {
    const same = new Error("same crash");
    expect(reportClientError(same, { kind: "error" })).toBe(true);
    expect(reportClientError(same, { kind: "error" })).toBe(false);
    for (let i = 0; i < MAX_REPORTS_PER_MINUTE + 3; i += 1) {
      reportClientError(new Error(`crash ${i}`), { kind: "error" });
    }
    expect(sent).toHaveLength(MAX_REPORTS_PER_MINUTE);
  });

  it("never throws, even when the transport fails", async () => {
    configureErrorReporter({
      send: () => {
        throw new Error("network down");
      },
    });
    expect(() => reportClientError(new Error("a"), { kind: "error" })).not.toThrow();
    configureErrorReporter({ send: () => Promise.reject(new Error("rejected")) });
    expect(() => reportClientError(new Error("b"), { kind: "error" })).not.toThrow();
    await Promise.resolve();
  });

  it("sends nothing when disabled", () => {
    configureErrorReporter({ enabled: false });
    expect(reportClientError(new Error("quiet"), { kind: "boundary" })).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("the default transport POSTs JSON without credentials", async () => {
    resetErrorReporter();
    configureErrorReporter({ enabled: true });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));
    try {
      reportClientError(new Error("transport check"), { kind: "manual" });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(String(url)).toMatch(/\/api\/v1\/client-errors$/);
      expect(init).toMatchObject({ method: "POST", credentials: "omit", keepalive: true });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        kind: "manual",
        message: "transport check",
      });
      // The reporter never adds an Authorization header.
      expect((init?.headers as Record<string, string>)["Authorization"]).toBeUndefined();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("installs global handlers for uncaught errors and rejections", () => {
    const uninstall = installGlobalErrorReporting(window);
    try {
      window.dispatchEvent(
        new ErrorEvent("error", { error: new Error("uncaught boom"), message: "uncaught boom" }),
      );
      const rejection = new Event("unhandledrejection") as Event & { reason?: unknown };
      rejection.reason = new Error("rejected boom");
      window.dispatchEvent(rejection);
    } finally {
      uninstall();
    }
    expect(sent.map((s) => [s.report.kind, s.report.message])).toEqual([
      ["error", "uncaught boom"],
      ["unhandledrejection", "rejected boom"],
    ]);
  });

  it("bounds message and stack sizes", () => {
    const err = new Error("m".repeat(5000));
    err.stack = "s".repeat(20000);
    const report = buildClientErrorReport(err, { kind: "error" });
    expect(report.message.length).toBeLessThanOrEqual(1000);
    expect(report.stack!.length).toBeLessThanOrEqual(8000);
  });

  it("scrubbing stays linear on long strings", () => {
    const started = performance.now();
    scrubText("a".repeat(200_000));
    scrubText("a.b-c_d".repeat(30_000));
    expect(performance.now() - started).toBeLessThan(1000);
    expect(scrubText("contact jane.doe@example.com")).toBe("contact [email]");
  });
});
