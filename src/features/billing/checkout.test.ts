import { describe, expect, it, vi } from "vitest";

import type { CheckoutStatus } from "@/features/billing/api";
import { formatMoney, providerModeText, waitForConfirmation } from "./checkout";

function status(phase: CheckoutStatus["phase"]): CheckoutStatus {
  return {
    phase,
    subscription: null,
    transaction: {
      id: "t1",
      planId: "pro",
      interval: "month",
      termMonths: 1,
      amountMinor: 99900,
      currency: "INR",
      provider: "razorpay",
      orderId: "order_1",
      paymentId: null,
      status: phase === "confirmed" ? "captured" : "pending",
      applied: phase === "confirmed",
      failureReason: null,
      createdAt: null,
      capturedAt: null,
      appliedAt: null,
      failedAt: null,
      refundedAt: null,
      expiredAt: null,
    },
  };
}

describe("waitForConfirmation", () => {
  it("keeps polling until the server confirms the provider capture", async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce(status("pending_confirmation"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(status("applying"))
      .mockResolvedValueOnce(status("confirmed"));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const result = await waitForConfirmation(fetchStatus, {
      intervalMs: 10,
      timeoutMs: 1000,
      sleep,
    });
    expect(result.outcome).toBe("confirmed");
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it("stops at a failed phase and times out while still pending", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const failed = await waitForConfirmation(vi.fn().mockResolvedValue(status("failed")), {
      sleep,
    });
    expect(failed.outcome).toBe("failed");
    const pending = vi.fn().mockResolvedValue(status("pending_confirmation"));
    const timeout = await waitForConfirmation(pending, { intervalMs: 10, timeoutMs: 30, sleep });
    expect(timeout.outcome).toBe("timeout");
    expect(pending).toHaveBeenCalledTimes(4);
  });
});

describe("providerModeText", () => {
  it("only says test mode when the backend reports test mode", () => {
    expect(providerModeText({ enabled: true, provider: "razorpay", environment: "test" })).toMatch(
      /test mode/,
    );
    const live = providerModeText({ enabled: true, provider: "razorpay", environment: "live" });
    expect(live).not.toMatch(/test mode/i);
    expect(live).toMatch(/Razorpay/);
    expect(providerModeText({ enabled: false, provider: null, environment: null })).toMatch(
      /not available/,
    );
  });
});

describe("formatMoney", () => {
  it("formats minor units", () => {
    expect(formatMoney(99900, "INR")).toContain("999");
  });
});
