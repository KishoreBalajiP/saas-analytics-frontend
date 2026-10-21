import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as billingApi from "./api";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);
beforeEach(() => vi.clearAllMocks());

describe("workspace billing API contract", () => {
  it("lists plans with tenant audience", async () => {
    request.mockResolvedValue([]);
    await billingApi.listPlans("t1");
    expect(request).toHaveBeenCalledWith("/tenants/t1/plans", { audience: "tenant" });
  });
  it("creates checkout with server-priced plan only (no amounts from client)", async () => {
    request.mockResolvedValue({ orderId: "order_1" });
    await billingApi.createCheckout("t1", { planId: "pro", interval: "year" });
    expect(request).toHaveBeenCalledWith(
      "/tenants/t1/subscription/checkout",
      expect.objectContaining({
        audience: "tenant",
        method: "POST",
        body: { planId: "pro", interval: "year" },
      }),
    );
    const body = (request.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty("amountMinor");
    expect(body).not.toHaveProperty("currency");
    expect(body).not.toHaveProperty("tenantId");
  });
  it("reads usage vs limits for the tenant with the tenant audience", async () => {
    request.mockResolvedValue({ usage: {}, warnings: [], warningThreshold: 0.8 });
    await billingApi.getUsage("t1");
    expect(request).toHaveBeenCalledWith("/tenants/t1/usage", { audience: "tenant" });
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
  it("polls the checkout status and reads the billing history for the tenant", async () => {
    request.mockResolvedValue({ phase: "confirmed" });
    await billingApi.getCheckoutStatus("t1", "order_1");
    expect(request).toHaveBeenCalledWith("/tenants/t1/subscription/checkout/order_1", {
      audience: "tenant",
    });
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    await billingApi.listTransactions("t1", { limit: 20 });
    expect(requestPaged).toHaveBeenCalledWith("/tenants/t1/subscription/transactions", {
      audience: "tenant",
      query: { limit: 20 },
    });
  });
});
