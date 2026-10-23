/**
 * Pricing and checkout (billing, roadmap 3.1 - prepaid terms).
 *
 * Plans, prices, terms and the provider mode all come from the backend
 * catalogue (`GET /tenants/:id/plans`). Choosing a plan opens Razorpay
 * Checkout for ONE prepaid term (monthly or annual). When Checkout returns,
 * the server verifies the signature and the UI then waits for the server
 * to confirm the provider-confirmed capture (`phase: confirmed`) before it
 * says anything about access: closing the window, or the browser callback
 * alone, never grants a plan.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, TableSkeleton } from "@/components/common/states";
import { AppLink } from "@/components/common/AppLink";
import * as billingApi from "@/features/billing/api";
import type {
  BillingInterval,
  CatalogPlan,
  CheckoutSession,
  TransactionStatus,
} from "@/features/billing/api";
import {
  formatMoney,
  loadRazorpayScript,
  providerModeText,
  waitForConfirmation,
} from "@/features/billing/checkout";
import { featurePresentation } from "@/features/billing/featureCatalog";

export type CheckoutUiPhase =
  | "idle"
  | "creating"
  | "open"
  | "verifying"
  | "confirming"
  | "confirmed"
  | "delayed"
  | "failed"
  | "cancelled"
  | "unavailable";

const INTERVAL_LABEL: Record<BillingInterval, string> = { month: "Monthly", year: "Annual" };
const INTERVAL_UNIT: Record<BillingInterval, string> = { month: "month", year: "year" };

function priceFor(plan: CatalogPlan, interval: BillingInterval) {
  return plan.prices.find((p) => p.interval === interval) ?? null;
}

export interface PricingPlansProps {
  tenantId: string;
  currentPlanId?: string | null;
  pendingPlanId?: string | null;
  pendingStatus?: TransactionStatus | null;
  /** Injected in tests; defaults to the real Razorpay Checkout. */
  openCheckout?: (session: CheckoutSession, handlers: CheckoutHandlers) => Promise<void>;
  /** Poll interval for the confirmation wait (ms). */
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

export interface CheckoutHandlers {
  onPaid: (response: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  }) => void;
  onDismiss: () => void;
  onFailed: () => void;
}

async function openRazorpayCheckout(session: CheckoutSession, handlers: CheckoutHandlers) {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable in this browser.");
  const rzp = new window.Razorpay({
    key: session.keyId,
    amount: session.amountMinor,
    currency: session.currency,
    order_id: session.orderId,
    name: "Analivo",
    description: `${session.planId} - ${session.interval === "year" ? "12 months" : "1 month"}`,
    modal: { ondismiss: handlers.onDismiss },
    handler: (response: unknown) =>
      handlers.onPaid(response as Parameters<CheckoutHandlers["onPaid"]>[0]),
  });
  rzp.on("payment.failed", handlers.onFailed);
  rzp.open();
}

export function PricingPlans({
  tenantId,
  currentPlanId = null,
  pendingPlanId = null,
  pendingStatus = null,
  openCheckout = openRazorpayCheckout,
  pollIntervalMs = 2000,
  pollTimeoutMs = 90000,
}: PricingPlansProps) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState<BillingInterval>("month");
  const [phase, setPhase] = useState<CheckoutUiPhase>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const freePlan = useMutation({
    mutationFn: () => billingApi.changePlan(tenantId, { planId: "free" }),
    onSuccess: (result) => {
      toast.success(
        result.scheduledChange
          ? "Free plan scheduled for the end of the paid term"
          : "Free plan selected",
      );
      refreshAll();
    },
    onError: (err: Error) => toast.error(err.message ?? "Unable to select the Free plan"),
  });

  const plans = useQuery({
    queryKey: ["billing", "plans", tenantId],
    queryFn: () => billingApi.listPlans(tenantId),
    enabled: Boolean(tenantId),
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
  };

  async function confirm(
    session: CheckoutSession,
    response: Parameters<CheckoutHandlers["onPaid"]>[0],
  ) {
    setPhase("verifying");
    setDetail("Checking the payment with the server…");
    try {
      const verified = await billingApi.verifyPayment(tenantId, {
        razorpay_order_id: response.razorpay_order_id ?? session.orderId,
        razorpay_payment_id: response.razorpay_payment_id ?? "",
        razorpay_signature: response.razorpay_signature ?? "",
      });
      if (verified.phase === "confirmed") {
        setPhase("confirmed");
        setDetail("Payment confirmed. Your new term is active.");
        refreshAll();
        return;
      }
    } catch (err) {
      setPhase("failed");
      setDetail(err instanceof Error ? err.message : "Payment verification failed");
      return;
    }
    setPhase("confirming");
    setDetail("Waiting for Razorpay to confirm the payment. This usually takes a few seconds.");
    const result = await waitForConfirmation(
      () => billingApi.getCheckoutStatus(tenantId, session.orderId),
      {
        intervalMs: pollIntervalMs,
        timeoutMs: pollTimeoutMs,
      },
    );
    if (result.outcome === "confirmed") {
      setPhase("confirmed");
      setDetail("Payment confirmed. Your new term is active.");
    } else if (result.outcome === "timeout") {
      setPhase("delayed");
      setDetail(
        "We have not received the payment confirmation yet. It is applied automatically as soon as it arrives - you do not need to pay again.",
      );
    } else {
      setPhase("failed");
      setDetail("The payment was not confirmed. No plan change was applied. You can retry safely.");
    }
    refreshAll();
  }

  async function start(planId: string) {
    setPendingPlan(planId);
    setPhase("creating");
    setDetail(null);
    let session: CheckoutSession;
    try {
      session = await billingApi.createCheckout(tenantId, { planId, interval: term });
    } catch (err) {
      setPhase("unavailable");
      setDetail(err instanceof Error ? err.message : "Checkout is not available");
      return;
    }
    setPhase("open");
    try {
      await openCheckout(session, {
        onPaid: (response) => void confirm(session, response),
        onDismiss: () => {
          setPhase("cancelled");
          setDetail(
            "Checkout was closed before payment completed. Nothing was charged by Analivo.",
          );
        },
        onFailed: () => {
          setPhase("failed");
          setDetail("The payment failed. No plan change was applied. You can retry safely.");
        },
      });
    } catch (err) {
      setPhase("failed");
      setDetail(err instanceof Error ? err.message : "Checkout failed to open");
    }
  }

  if (plans.isLoading) return <TableSkeleton rows={2} cols={3} />;
  if (plans.isError) {
    return <ErrorState error={plans.error} onRetry={() => plans.refetch()} resource="Plans" />;
  }
  const catalog = plans.data?.plans ?? [];
  const checkout = plans.data?.checkout ?? {
    enabled: false,
    provider: null,
    environment: null,
    model: "prepaid_terms" as const,
    intervals: ["month", "year"] as BillingInterval[],
  };
  const busy =
    phase === "creating" || phase === "open" || phase === "verifying" || phase === "confirming";
  const offersAnnual = catalog.some((p) => priceFor(p, "year"));

  return (
    <div className="space-y-4">
      {offersAnnual && (
        <div className="flex items-center gap-2" role="group" aria-label="Billing term">
          {(["month", "year"] as BillingInterval[]).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={term === value ? "default" : "outline"}
              aria-pressed={term === value}
              onClick={() => setTerm(value)}
              disabled={busy}
            >
              {INTERVAL_LABEL[value]}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {catalog.map((plan) => {
          const price = priceFor(plan, term);
          const current = plan.code === currentPlanId;
          const pending = plan.code === pendingPlanId;
          const features = Object.entries(plan.features).filter(([, on]) => on);
          return (
            <Card
              key={plan.code}
              data-testid={`plan-${plan.code}`}
              className={`h-full ${current ? "border-primary" : ""}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{plan.displayName}</span>
                  {current ? (
                    <Badge variant="secondary">Current</Badge>
                  ) : pendingPlanId === plan.code ? (
                    <Badge variant="outline">Pending</Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col space-y-3 text-sm">
                <p className="text-muted-foreground">{plan.description}</p>
                <p className="text-xl font-semibold">
                  {plan.code === "free"
                    ? "Free"
                    : price
                      ? `${formatMoney(price.amountMinor, price.currency)} / ${INTERVAL_UNIT[term]}`
                      : "Price on request"}
                </p>
                <ul className="flex-1 space-y-1">
                  {features.map(([key]) => (
                    <li key={key} className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{" "}
                      {featurePresentation(key).label}
                    </li>
                  ))}
                </ul>
                {plan.code !== "free" &&
                  plan.purchasable &&
                  price &&
                  !(pending && pendingStatus === "captured") && (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!checkout.enabled || !plan.purchasable || !price || busy || false}
                      onClick={() => void start(plan.code)}
                    >
                      {busy && pendingPlan === plan.code ? (
                        <>
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Working…
                        </>
                      ) : pending && pendingStatus !== "captured" ? (
                        "Continue payment"
                      ) : current ? (
                        `Renew ${INTERVAL_UNIT[term]}ly term`
                      ) : (
                        `Choose ${plan.displayName}`
                      )}
                    </Button>
                  )}
                {pending && pendingStatus === "captured" && (
                  <p className="text-muted-foreground text-xs">
                    Payment is being applied. Check the payment status above.
                  </p>
                )}
                {plan.code === "free" && !current && (
                  <Button
                    size="sm"
                    className="mt-auto w-full"
                    disabled={busy || freePlan.isPending}
                    onClick={() => freePlan.mutate()}
                  >
                    {freePlan.isPending ? "Updating…" : "Switch to Free"}
                  </Button>
                )}
                {plan.code !== "free" &&
                  (!plan.purchasable || !price) &&
                  (plan.code === "enterprise" ? (
                    <Button asChild size="sm" variant="outline" className="mt-auto w-full">
                      <AppLink to="/request-access">Contact sales</AppLink>
                    </Button>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Self-service checkout is not available for this plan.
                    </p>
                  ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div aria-live="polite">
        {(phase === "verifying" || phase === "confirming") && (
          <p
            data-testid="checkout-confirming"
            className="flex items-center gap-1 text-sm text-amber-700"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {detail}
          </p>
        )}
        {phase === "confirmed" && (
          <p
            data-testid="checkout-confirmed"
            className="flex items-center gap-1 text-sm text-emerald-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {detail}
          </p>
        )}
        {phase === "delayed" && (
          <div
            data-testid="checkout-delayed"
            className="flex flex-wrap items-center gap-2 text-sm text-amber-700"
          >
            <span>{detail}</span>
            <Button size="sm" variant="outline" onClick={refreshAll}>
              Refresh status
            </Button>
          </div>
        )}
        {(phase === "failed" || phase === "cancelled" || phase === "unavailable") && detail && (
          <p
            data-testid="checkout-error"
            className="flex items-center gap-1 text-sm text-destructive"
          >
            <XCircle className="h-3.5 w-3.5" /> {detail}
          </p>
        )}
      </div>

      <p data-testid="provider-mode" className="text-muted-foreground text-xs">
        {providerModeText(checkout)} Terms are prepaid and never renew or charge automatically.
      </p>
    </div>
  );
}
