import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import type { FieldError } from "@/lib/api/types";
import {
  errorMessage,
  getQuotaDetails,
  isQuotaExceeded,
  metricTitle,
  quotaMessage,
  toastError,
} from "./quota";

function quotaError(entry: Record<string, unknown>, status = 409) {
  return new ApiError("Plan limit reached", status, "QUOTA_EXCEEDED", [
    { field: String(entry["metric"] ?? ""), message: "Plan limit reached", ...entry } as FieldError,
  ]);
}

beforeEach(() => vi.clearAllMocks());

describe("quota error helpers", () => {
  it("recognises the backend QUOTA_EXCEEDED envelope and reads its details", () => {
    const err = quotaError({ metric: "dashboards", limit: 5, current: 5, period: "current" });
    expect(isQuotaExceeded(err)).toBe(true);
    expect(getQuotaDetails(err)).toEqual({
      metric: "dashboards",
      limit: 5,
      current: 5,
      period: "current",
      resetsAt: null,
    });
    expect(isQuotaExceeded(new ApiError("Conflict", 409, "CONFLICT"))).toBe(false);
    expect(getQuotaDetails(new Error("x"))).toBeNull();
  });

  it("names the metric, limit and current use for resource limits", () => {
    const err = quotaError({ metric: "dashboards", limit: 5, current: 5 });
    expect(errorMessage(err, "fallback")).toBe(
      "Plan limit reached: your plan allows 5 dashboards and 5 are in use. Delete dashboards you no longer need or upgrade your plan.",
    );
    expect(
      errorMessage(quotaError({ metric: "storedRows", limit: 10000, current: 10000 }), "x"),
    ).toBe(
      "Plan limit reached: your plan allows 10,000 stored rows and 10,000 are in use. Delete data you no longer need or upgrade your plan.",
    );
    expect(errorMessage(quotaError({ metric: "members", limit: 3, current: 3 }), "x")).toContain(
      "3 team members",
    );
  });

  it("explains metrics the plan does not include and daily API limits with the reset time", () => {
    expect(
      quotaMessage({ metric: "alerts", limit: 0, current: 0, period: null, resetsAt: null }),
    ).toBe("Your plan does not include alerts. Upgrade your plan to use them.");
    const daily = quotaError(
      {
        metric: "apiCallsPerDay",
        limit: 1000,
        current: 1000,
        period: "2026-03-10",
        resetsAt: "2026-03-11T00:00:00.000Z",
      },
      429,
    );
    expect(errorMessage(daily, "x")).toBe(
      "Your plan allows 1,000 API calls per day and today's allowance is used up. It resets at 00:00 UTC.",
    );
  });

  it("keeps other errors' messages and falls back when there is none", () => {
    expect(errorMessage(new ApiError("Name taken", 409, "CONFLICT"), "fallback")).toBe(
      "Name taken",
    );
    expect(errorMessage("weird", "fallback")).toBe("fallback");
  });

  it("toasts plan-limit errors with a title, the metric sentence and a View usage action", () => {
    toastError(quotaError({ metric: "connectors", limit: 1, current: 1 }), "Failed to create");
    expect(toast.error).toHaveBeenCalledWith(
      "Plan limit reached",
      expect.objectContaining({
        description: expect.stringContaining("your plan allows 1 connector and 1 is in use"),
        action: expect.objectContaining({ label: "View usage" }),
      }),
    );
    toastError(new Error("Boom"), "Failed to create");
    expect(toast.error).toHaveBeenLastCalledWith("Boom");
  });

  it("titles metrics for display", () => {
    expect(metricTitle("scheduledReports")).toBe("Scheduled reports");
    expect(metricTitle("apiCallsPerDay")).toBe("API calls / day");
    expect(metricTitle("unknownMetric")).toBe("UnknownMetric");
  });
});
