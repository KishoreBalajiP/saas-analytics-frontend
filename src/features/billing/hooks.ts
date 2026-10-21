/**
 * Entitlement hooks (billing, roadmap 3.1).
 *
 * The backend enforces plan features (`403 FEATURE_NOT_AVAILABLE`); these
 * hooks only let the UI show a locked state up front. While the
 * entitlements are loading, or when the user may not read them, features
 * are reported as unknown and the UI does not lock anything (the server
 * still refuses what the plan does not include).
 */

import { useQuery } from "@tanstack/react-query";

import * as billingApi from "@/features/billing/api";
import { useTenantSession } from "@/lib/auth/session";

export function entitlementsQueryKey(tenantId: string | null | undefined) {
  return ["billing", "entitlements", tenantId ?? null] as const;
}

/** The tenant's effective entitlements (plan computed by the server). */
export function useEntitlements() {
  const { me } = useTenantSession();
  const tenantId = me?.tenantId ?? null;
  return useQuery({
    queryKey: entitlementsQueryKey(tenantId),
    queryFn: () => billingApi.getEntitlements(tenantId as string),
    enabled: Boolean(tenantId),
    retry: false,
    staleTime: 60_000,
  });
}

/**
 * Whether a plan feature is available. `known` is false until the
 * entitlements are loaded (then `enabled` is not meaningful).
 */
export function useFeature(feature: string): {
  enabled: boolean;
  known: boolean;
  planName: string | null;
} {
  const entitlements = useEntitlements();
  const data = entitlements.data;
  if (!data) return { enabled: false, known: false, planName: null };
  return {
    enabled: data.writeBlocked ? false : data.features[feature] === true,
    known: true,
    planName: data.plan.displayName,
  };
}
