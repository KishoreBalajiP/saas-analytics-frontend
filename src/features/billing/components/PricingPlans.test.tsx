import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/billing/api", () => ({
  listPlans: vi.fn(),
  createCheckout: vi.fn(),
  verifyPayment: vi.fn(),
  getCheckoutStatus: vi.fn(),
}));

import * as billingApi from "@/features/billing/api";
import type { CheckoutSession, CheckoutStatus, PlansResponse } from "@/features/billing/api";
import { PricingPlans } from "./PricingPlans";
import type { CheckoutHandlers } from "./PricingPlans";

const api = vi.mocked(billingApi);

function plans(environment: string | null = "test"): PlansResponse {
  return {
    checkout: {
      enabled: environment !== null,
      provider: environment ? "razorpay" : null,
      environment,
      model: "prepaid_terms",
      intervals: ["month", "year"],
    },
    plans: [
      {
        code: "free",
        name: "Free",
        displayName: "Free",
        description: "For evaluation",
        tier: 0,
        trialDays: 0,
        features: { embedding: false },
        limits: {},
        prices: [],
        purchasable: false,
      },
      {
        code: "pro",
        name: "Pro",
        displayName: "Pro",
        description: "For production teams",
        tier: 2,
        trialDays: 14,
        features: { embedding: true, api_access: true },
        limits: {},
        prices: [
          { interval: "month", amountMinor: 99900, currency: "INR" },
          { interval: "year", amountMinor: 999000, currency: "INR" },
        ],
        purchasable: environment !== null,
      },
    ],
  };
}

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
      paymentId: "pay_1",
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

const session: CheckoutSession = {
  transactionId: "t1",
  orderId: "order_1",
  keyId: "rzp_test_key",
  amountMinor: 99900,
  currency: "INR",
  planId: "pro",
  interval: "month",
  termMonths: 1,
  environment: "test",
  reused: false,
};

function renderPlans(props: Partial<Parameters<typeof PricingPlans>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PricingPlans
        tenantId="t1"
        currentPlanId="free"
        // Keep the timeout-path test deterministic without flooding the event loop
        // with dozens of React updates when the full suite is under load.
        pollIntervalMs={10}
        pollTimeoutMs={50}
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PricingPlans", () => {
  it("renders the backend catalogue with monthly and annual prices", async () => {
    api.listPlans.mockResolvedValue(plans());
    renderPlans();
    const pro = await screen.findByTestId("plan-pro");
    expect(pro.textContent).toMatch(/999/);
    expect(pro.textContent).toMatch(/\/ month/);
    fireEvent.click(screen.getByRole("button", { name: "Annual" }));
    expect(screen.getByTestId("plan-pro").textContent).toMatch(/9,990|9990/);
    expect(screen.getByTestId("plan-pro").textContent).toMatch(/\/ year/);
    expect(screen.getByTestId("plan-free").textContent).toMatch(/Free/);
    expect(screen.getByTestId("provider-mode").textContent).toMatch(/test mode/);
  });

  it("never claims test mode in live mode and disables checkout when payments are off", async () => {
    api.listPlans.mockResolvedValue(plans("live"));
    const { unmount } = renderPlans();
    expect((await screen.findByTestId("provider-mode")).textContent).not.toMatch(/test mode/i);
    unmount();
    api.listPlans.mockResolvedValue(plans(null));
    renderPlans();
    const button = await screen.findByRole("button", { name: /Buy monthly term/ });
    expect(button).toBeDisabled();
    expect(screen.getByTestId("provider-mode").textContent).toMatch(/not available/);
  });

  it("waits for the webhook-confirmed status before showing success", async () => {
    api.listPlans.mockResolvedValue(plans());
    api.createCheckout.mockResolvedValue(session);
    api.verifyPayment.mockResolvedValue({ verified: true, ...status("pending_confirmation") });
    let resolveConfirmed: (value: CheckoutStatus) => void = () => {};
    api.getCheckoutStatus
      .mockResolvedValueOnce(status("pending_confirmation"))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveConfirmed = resolve)));
    const openCheckout = vi.fn(async (_s: CheckoutSession, handlers: CheckoutHandlers) => {
      handlers.onPaid({
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "sig",
      });
    });
    renderPlans({ openCheckout });
    fireEvent.click(await screen.findByRole("button", { name: /Buy monthly term/ }));
    await waitFor(() =>
      expect(api.createCheckout).toHaveBeenCalledWith("t1", { planId: "pro", interval: "month" }),
    );
    expect(await screen.findByTestId("checkout-confirming")).toBeInTheDocument();
    expect(screen.queryByTestId("checkout-confirmed")).toBeNull();
    expect(api.verifyPayment).toHaveBeenCalledWith("t1", {
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "sig",
    });
    await waitFor(() => expect(api.getCheckoutStatus).toHaveBeenCalledTimes(2));
    resolveConfirmed(status("confirmed"));
    expect(await screen.findByTestId("checkout-confirmed")).toBeInTheDocument();
  });

  it("tells the user the payment is still being confirmed when the webhook is late", async () => {
    api.listPlans.mockResolvedValue(plans());
    api.createCheckout.mockResolvedValue(session);
    api.verifyPayment.mockResolvedValue({ verified: true, ...status("pending_confirmation") });
    api.getCheckoutStatus.mockResolvedValue(status("pending_confirmation"));
    const openCheckout = vi.fn(async (_s: CheckoutSession, handlers: CheckoutHandlers) => {
      handlers.onPaid({
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "sig",
      });
    });
    renderPlans({ openCheckout });
    fireEvent.click(await screen.findByRole("button", { name: /Buy monthly term/ }));
    expect(await screen.findByTestId("checkout-delayed")).toBeInTheDocument();
    expect(screen.queryByTestId("checkout-confirmed")).toBeNull();
  });

  it("a dismissed checkout grants nothing and says so", async () => {
    api.listPlans.mockResolvedValue(plans());
    api.createCheckout.mockResolvedValue(session);
    const openCheckout = vi.fn(async (_s: CheckoutSession, handlers: CheckoutHandlers) => {
      handlers.onDismiss();
    });
    renderPlans({ openCheckout });
    fireEvent.click(await screen.findByRole("button", { name: /Buy monthly term/ }));
    expect((await screen.findByTestId("checkout-error")).textContent).toMatch(
      /closed before payment/,
    );
    expect(api.verifyPayment).not.toHaveBeenCalled();
  });
});
