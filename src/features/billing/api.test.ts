import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as billingApi from "./api";

vi.mock("@/lib/api/client", () => ({ request: vi.fn() }));
const request = vi.mocked(client.request);
beforeEach(() => vi.clearAllMocks());

describe("workspace billing API contract", () => {
  it("lists plans with tenant audience", async () => {
    request.mockResolvedValue([]);
    await billingApi.listPlans("t1");
    expect(request).toHaveBeenCalledWith("/tenants/t1/plans", { audience: "tenant" });
  });
  it("creates checkout with server-priced plan only (no amounts from client)", async () => {
    request.mockResolvedValue({ orderId: "order_1" });
    await billingApi.createCheckout("t1", { planId: "pro" });
    expect(request).toHaveBeenCalledWith(
      "/tenants/t1/subscription/checkout",
      expect.objectContaining({
        audience: "tenant",
        method: "POST",
        body: { planId: "pro" },
      }),
    );
    const body = (request.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty("amountMinor");
    expect(body).not.toHaveProperty("currency");
    expect(body).not.toHaveProperty("tenantId");
  });
  it("verifies payment with provider ids + signature only", async () => {
    request.mockResolvedValue({ verified: true });
    await billingApi.verifyPayment("t1", {
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "sig",
    });
    expect(request).toHaveBeenCalledWith(
      "/tenants/t1/subscription/verify",
      expect.objectContaining({ audience: "tenant", method: "POST" }),
    );
    const body = (request.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty("planId");
    expect(body).not.toHaveProperty("state");
  });
});
