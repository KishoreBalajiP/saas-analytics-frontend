import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children?: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import type { SubscriptionSummary } from "@/features/billing/api";
import { SubscriptionBanner } from "./SubscriptionBanner";

const NOW = new Date("2026-10-22T12:00:00.000Z");

function sub(partial: Partial<SubscriptionSummary> = {}): SubscriptionSummary {
  return {
    id: "s1",
    tenantId: "t1",
    planId: "pro",
    state: "active",
    trialEndsAt: null,
    currentPeriodStart: "2026-10-01T00:00:00.000Z",
    currentPeriodEnd: "2026-11-30T00:00:00.000Z",
    graceEndsAt: null,
    canceledAt: null,
    cancelAtPeriodEnd: false,
    paymentProvider: "razorpay",
    paymentReference: null,
    previousPlanId: null,
    previousState: null,
    stateChangedAt: null,
    lastReconciledAt: null,
    createdAt: null,
    updatedAt: null,
    scheduledChange: null,
    ...partial,
  };
}

function access(
  state: SubscriptionSummary["state"],
  extra: Partial<NonNullable<SubscriptionSummary["access"]>> = {},
) {
  return {
    state,
    planId: "pro",
    writeBlocked: state === "restricted" || state === "expired",
    inGrace: state === "past_due",
    graceEndsAt: null,
    periodEnded: state !== "active",
    reason: null,
    ...extra,
  };
}

describe("SubscriptionBanner", () => {
  it("shows nothing for a healthy term far from its end", () => {
    const { container } = render(
      <SubscriptionBanner subscription={sub({ access: access("active") })} now={NOW} />,
    );
    expect(container.textContent).toBe("");
  });

  it("warns before a prepaid term ends (no automatic renewal)", () => {
    render(
      <SubscriptionBanner
        subscription={sub({
          currentPeriodEnd: "2026-10-25T00:00:00.000Z",
          access: access("active"),
        })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("banner-term-ending").textContent).toMatch(
      /does not renew automatically/,
    );
  });

  it("shows the grace banner from the computed access, even before the job runs", () => {
    render(
      <SubscriptionBanner
        subscription={sub({
          state: "active",
          currentPeriodEnd: "2026-10-20T00:00:00.000Z",
          access: access("past_due", { graceEndsAt: "2026-10-27T00:00:00.000Z" }),
        })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("banner-grace").textContent).toMatch(/grace period/);
  });

  it("shows restricted (unpaid vs admin hold) and expired banners", () => {
    const { rerender } = render(
      <SubscriptionBanner
        subscription={sub({ state: "restricted", access: access("restricted") })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("banner-restricted").textContent).toMatch(/Buy a new term/);
    rerender(
      <SubscriptionBanner
        subscription={sub({ state: "restricted", adminHold: true, access: access("restricted") })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("banner-restricted").textContent).toMatch(/administrator/);
    rerender(
      <SubscriptionBanner
        subscription={sub({ state: "expired", access: access("expired") })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("banner-expired")).toBeInTheDocument();
  });

  it("shows trial, cancellation and scheduled downgrade banners", () => {
    const { rerender } = render(
      <SubscriptionBanner
        subscription={sub({
          state: "trialing",
          trialEndsAt: "2026-11-01T00:00:00.000Z",
          access: access("trialing"),
        })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("banner-trial").textContent).toMatch(/free plan/);
    rerender(
      <SubscriptionBanner
        subscription={sub({
          state: "canceled",
          cancelAtPeriodEnd: true,
          access: access("canceled"),
        })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("banner-canceled")).toBeInTheDocument();
    rerender(
      <SubscriptionBanner
        subscription={sub({
          access: access("active"),
          scheduledChange: {
            planId: "free",
            effectiveAt: "2026-11-30T00:00:00.000Z",
            termEnd: null,
            interval: null,
            source: "workspace",
          },
        })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("banner-scheduled").textContent).toMatch(/free plan/);
  });
});
