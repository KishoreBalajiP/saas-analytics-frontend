/**
 * Checkout helpers for the prepaid-term flow (billing, roadmap 3.1).
 *
 * The browser never decides that a payment succeeded. After Razorpay
 * Checkout returns, the UI asks the server to verify the signature and then
 * WAITS for the server to report `phase: "confirmed"` - which only happens
 * once the verified webhook (or reconciliation) confirmed the capture with
 * the provider and the paid term was applied.
 */

import type { CheckoutPhase, CheckoutStatus } from "@/features/billing/api";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

/** Phases after which polling stops. */
export const FINAL_PHASES: ReadonlySet<CheckoutPhase> = new Set([
  "confirmed",
  "failed",
  "expired",
  "refunded",
]);

export type ConfirmationResult =
  | { outcome: "confirmed" | "failed" | "expired" | "refunded"; status: CheckoutStatus }
  | { outcome: "timeout"; status: CheckoutStatus | null };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Poll `fetchStatus` until the checkout reaches a final phase or
 * `timeoutMs` passes. Transient fetch errors are retried.
 */
export async function waitForConfirmation(
  fetchStatus: () => Promise<CheckoutStatus>,
  {
    intervalMs = 2000,
    timeoutMs = 90000,
    sleep = defaultSleep,
    onProgress,
  }: {
    intervalMs?: number;
    timeoutMs?: number;
    sleep?: (ms: number) => Promise<void>;
    onProgress?: (status: CheckoutStatus) => void;
  } = {},
): Promise<ConfirmationResult> {
  let last: CheckoutStatus | null = null;
  let waited = 0;
  for (;;) {
    try {
      last = await fetchStatus();
      onProgress?.(last);
      if (FINAL_PHASES.has(last.phase)) {
        return {
          outcome: last.phase as "confirmed" | "failed" | "expired" | "refunded",
          status: last,
        };
      }
    } catch {
      // A transient error while polling: keep waiting.
    }
    if (waited >= timeoutMs) return { outcome: "timeout", status: last };
    await sleep(intervalMs);
    waited += intervalMs;
  }
}

/** Load Razorpay Checkout once (the only third-party script on the page). */
export function loadRazorpayScript(): Promise<void> {
  if (typeof window.Razorpay !== "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      "script[data-razorpay-checkout]",
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay Checkout")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset["razorpayCheckout"] = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Razorpay Checkout. Check your connection and retry."));
    document.body.appendChild(script);
  });
}

/** Money in major units, e.g. 99900 INR -> "₹999.00". */
export function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
      amountMinor / 100,
    );
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

/** The provider sentence shown under checkout, from the backend config. */
export function providerModeText(checkout: {
  enabled: boolean;
  provider: string | null;
  environment: string | null;
}): string {
  if (!checkout.enabled) {
    return "Online payments are not available for this workspace yet. Contact your platform administrator to change plans.";
  }
  const name =
    checkout.provider === "razorpay" ? "Razorpay" : (checkout.provider ?? "the payment provider");
  if (checkout.environment === "live") {
    return `Payments are processed securely by ${name}. Paid access starts once ${name} confirms the payment.`;
  }
  if (checkout.environment === "test") {
    return `Payments are processed by ${name} in test mode: no real money is charged. Paid access starts once ${name} confirms the payment.`;
  }
  return `Payments are processed by ${name}. Paid access starts once ${name} confirms the payment.`;
}
