import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";

import { ApiError, request } from "@/lib/api/client";
import { toastError } from "@/lib/api/quota";
import {
  installErrorToastReferences,
  referenceToastOptions,
  requestIdOf,
  toastApiError,
  uninstallErrorToastReferences,
} from "./reference";

// Roadmap 2.8: error toasts show the failed call's reference id.

const apiErr = (message: string, status = 500, id = "srv-req-000777") =>
  new ApiError(message, status, status === 500 ? "INTERNAL_ERROR" : "CONFLICT", undefined, id);

describe("reference helpers", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("reads the request id of ApiErrors only", () => {
    expect(requestIdOf(apiErr("x"))).toBe("srv-req-000777");
    expect(requestIdOf(new Error("x"))).toBeUndefined();
    expect(requestIdOf(null)).toBeUndefined();
  });

  it("toastApiError adds the reference id and a copy action", () => {
    toastApiError(apiErr("Export failed"), "fallback");
    expect(toast.error).toHaveBeenCalledWith("Export failed", {
      description: "Reference ID: srv-req-000777",
      action: { label: "Copy ID", onClick: expect.any(Function) },
    });
    toastApiError(new Error("Local problem"), "fallback");
    expect(toast.error).toHaveBeenLastCalledWith("Local problem");
  });

  it("the copy action writes the id to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    referenceToastOptions("srv-req-000888").action.onClick();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("srv-req-000888");
  });

  it("toastError (create actions) carries the reference id for plain and quota errors", () => {
    toastError(apiErr("Name already used", 409), "Failed to create");
    expect(toast.error).toHaveBeenLastCalledWith(
      "Name already used",
      expect.objectContaining({ description: "Reference ID: srv-req-000777" }),
    );
    const quota = new ApiError(
      "Plan limit reached",
      409,
      "QUOTA_EXCEEDED",
      [
        {
          field: "dashboards",
          message: "limit",
          metric: "dashboards",
          limit: 1,
          current: 1,
        } as never,
      ],
      "srv-req-000999",
    );
    toastError(quota, "Failed to create");
    const [title, options] = vi.mocked(toast.error).mock.calls.at(-1)!;
    expect(title).toBe("Plan limit reached");
    expect((options as { description: string }).description).toMatch(
      /Reference ID: srv-req-000999$/,
    );
  });
});

describe("installErrorToastReferences", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let original: ReturnType<typeof vi.fn>;
  let target: { error: (message: unknown, data?: Record<string, unknown>) => unknown };

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch") as unknown as ReturnType<typeof vi.spyOn>;
    original = vi.fn();
    target = { error: original };
    installErrorToastReferences(target);
  });
  afterEach(() => {
    uninstallErrorToastReferences();
    fetchSpy.mockRestore();
  });

  async function failWith(message: string, id: string) {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, statusCode: 500, message, code: "INTERNAL_ERROR" }),
        { status: 500, headers: { "Content-Type": "application/json", "X-Request-Id": id } },
      ),
    );
    return (await request("/x").catch((e: unknown) => e)) as ApiError;
  }

  it("adds the reference id to an existing toast.error(err.message) call", async () => {
    const err = await failWith("Unable to delete report", "srv-req-001002");
    target.error(err.message);
    expect(original).toHaveBeenCalledWith("Unable to delete report", {
      description: "Reference ID: srv-req-001002",
      action: { label: "Copy ID", onClick: expect.any(Function) },
    });
    // A sentence quoting the API message matches too.
    target.error(`Export failed: ${err.message}`);
    expect(original).toHaveBeenLastCalledWith(
      "Export failed: Unable to delete report",
      expect.objectContaining({ description: "Reference ID: srv-req-001002" }),
    );
  });

  it("leaves unrelated toasts and toasts with their own details untouched", async () => {
    await failWith("Unable to update alert", "srv-req-002001");
    target.error("Reason is required");
    expect(original).toHaveBeenLastCalledWith("Reason is required", undefined);
    target.error("Unable to update alert", { description: "custom" });
    expect(original).toHaveBeenLastCalledWith("Unable to update alert", { description: "custom" });
  });

  it("does not attach stale ids (older than the match window)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await failWith("Unable to run report", "srv-req-003001");
      vi.setSystemTime(Date.now() + 60_000);
      target.error("Unable to run report");
      expect(original).toHaveBeenLastCalledWith("Unable to run report", undefined);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uninstall restores the original toast.error", () => {
    expect(target.error).not.toBe(original);
    uninstallErrorToastReferences();
    expect(target.error).toBe(original);
  });
});
