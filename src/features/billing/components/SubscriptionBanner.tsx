/**
 * Subscription status banners (billing, roadmap 3.1).
 *
 * Driven by the access the server computes from state + period (`access`
 * on the subscription), so the banner matches what the backend enforces:
 * trial ending, term ending soon, grace period after an unrenewed term,
 * restricted / expired (read-only), cancellation and queued plan changes.
 */

import { AlertTriangle, Clock, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { AppLink } from "@/components/common/AppLink";
import type { SubscriptionSummary } from "@/features/billing/api";

const DAY_MS = 86400000;

function day(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

type Tone = "info" | "warning" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  info: "border-sky-300/70 bg-sky-50 text-sky-950",
  warning: "border-amber-300/70 bg-amber-50 text-amber-950",
  danger: "border-destructive/40 bg-destructive/5 text-destructive",
};

function Banner({
  tone,
  icon,
  title,
  children,
  testId,
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  children: ReactNode;
  testId: string;
}) {
  return (
    <div
      role="status"
      data-testid={testId}
      className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${TONE_CLASS[tone]}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-medium">{title}</p>
        <div className="mt-0.5 opacity-90">{children}</div>
      </div>
    </div>
  );
}

const renewLink = (
  <AppLink to="/pricing" className="font-medium underline">
    Buy a new term
  </AppLink>
);

/** The banners for one subscription (may render several, or none). */
export function SubscriptionBanner({
  subscription,
  now = new Date(),
  reminderDays = 7,
}: {
  subscription: SubscriptionSummary;
  now?: Date;
  reminderDays?: number;
}) {
  const access = subscription.access;
  const state = access?.state ?? subscription.state;
  const banners: ReactNode[] = [];
  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const paid = subscription.planId !== "free";

  if (state === "restricted") {
    banners.push(
      <Banner
        key="restricted"
        testId="banner-restricted"
        tone="danger"
        icon={<XCircle className="h-4 w-4" />}
        title="Workspace is restricted"
      >
        {subscription.adminHold ? (
          "An administrator restricted this workspace. Data stays readable; contact support to lift the restriction."
        ) : (
          <>
            The paid term and its grace period have ended. Data stays readable, but new changes are
            blocked. {renewLink} to restore access.
          </>
        )}
      </Banner>,
    );
  } else if (state === "expired") {
    banners.push(
      <Banner
        key="expired"
        testId="banner-expired"
        tone="danger"
        icon={<XCircle className="h-4 w-4" />}
        title="Subscription has ended"
      >
        <>
          The canceled plan reached the end of its term. Data stays readable, but new changes are
          blocked. {renewLink}, or switch to the free plan.
        </>
      </Banner>,
    );
  } else if (state === "past_due") {
    banners.push(
      <Banner
        key="grace"
        testId="banner-grace"
        tone="warning"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Your paid term has ended"
      >
        <>
          The plan stays available during a grace period until{" "}
          {day(access?.graceEndsAt ?? subscription.graceEndsAt)}. After that the workspace becomes
          read-only. {renewLink}.
        </>
      </Banner>,
    );
  } else if (state === "trialing" && subscription.trialEndsAt) {
    banners.push(
      <Banner
        key="trial"
        testId="banner-trial"
        tone="info"
        icon={<Clock className="h-4 w-4" />}
        title="Trial in progress"
      >
        <>
          The trial ends on {day(subscription.trialEndsAt)}; the workspace then moves to the free
          plan unless you buy a term.{" "}
          <AppLink to="/pricing" className="font-medium underline">
            See plans
          </AppLink>
          .
        </>
      </Banner>,
    );
  } else if (state === "canceled" && end) {
    banners.push(
      <Banner
        key="canceled"
        testId="banner-canceled"
        tone="info"
        icon={<Info className="h-4 w-4" />}
        title="Cancellation scheduled"
      >
        The plan stays active until {day(subscription.currentPeriodEnd)}, then the subscription
        ends.
      </Banner>,
    );
  } else if (
    state === "active" &&
    paid &&
    end &&
    end.getTime() - now.getTime() <= reminderDays * DAY_MS &&
    !subscription.scheduledChange
  ) {
    banners.push(
      <Banner
        key="ending"
        testId="banner-term-ending"
        tone="warning"
        icon={<Clock className="h-4 w-4" />}
        title="Your term ends soon"
      >
        <>
          The prepaid term ends on {day(subscription.currentPeriodEnd)} and does not renew
          automatically. {renewLink}.
        </>
      </Banner>,
    );
  }

  if (subscription.scheduledChange && state !== "restricted" && state !== "expired") {
    banners.push(
      <Banner
        key="scheduled"
        testId="banner-scheduled"
        tone="info"
        icon={<Info className="h-4 w-4" />}
        title="Plan change scheduled"
      >
        The workspace moves to the {subscription.scheduledChange.planId} plan on{" "}
        {day(subscription.scheduledChange.effectiveAt)}.
      </Banner>,
    );
  }

  if (banners.length === 0) return null;
  return <div className="space-y-2">{banners}</div>;
}
