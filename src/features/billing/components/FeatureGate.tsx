/**
 * Feature-locked state (billing, roadmap 3.1).
 *
 * Shows a notice above a page when the workspace plan does not include a
 * feature. The page itself stays usable for what the plan still allows
 * (e.g. revoking existing embed tokens); the backend refuses the rest with
 * `403 FEATURE_NOT_AVAILABLE`. Renders nothing while entitlements load or
 * when they cannot be read.
 */

import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { AppLink } from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/features/billing/hooks";
import { FEATURE_LABELS, PRICING_PAGE } from "@/lib/api/quota";

export function FeatureLockedNotice({
  feature,
  description,
}: {
  feature: string;
  description?: string;
}) {
  const { enabled, known, planName } = useFeature(feature);
  if (!known || enabled) return null;
  const label = FEATURE_LABELS[feature] ?? feature;
  return (
    <div
      role="status"
      data-testid={`feature-locked-${feature}`}
      className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{label} is not included in your plan</p>
          <p className="mt-1 text-amber-900/80">
            {description ??
              `Your ${planName ?? "current"} plan does not include ${label.toLowerCase()}. Upgrade to use it.`}
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <AppLink to={PRICING_PAGE}>View plans</AppLink>
      </Button>
    </div>
  );
}

/** Wrap a page section: the notice, then the children. */
export function FeatureGate({
  feature,
  description,
  children,
}: {
  feature: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <>
      <FeatureLockedNotice feature={feature} {...(description ? { description } : {})} />
      {children}
    </>
  );
}
