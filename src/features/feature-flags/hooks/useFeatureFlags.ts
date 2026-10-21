import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import * as featureFlagsApi from "@/features/feature-flags/api";
import { useTenantSession } from "@/lib/auth/session";
import { hasPermission, perm } from "@/lib/permissions";

const FEATURE_FLAGS_VIEW = perm("feature_flags", "view");
const EMPTY: Record<string, boolean> = {};

/**
 * Workspace feature flags (roadmap 2.4).
 *
 * Fails closed: while loading, on error, or without `feature_flags.view`,
 * every flag reads as OFF. Flags only gate UI; the backend still enforces
 * access to every feature it protects.
 *
 * ```tsx
 * const { isEnabled } = useFeatureFlags();
 * if (isEnabled("analytics.realtime")) { ... }
 * ```
 */
export function useFeatureFlags() {
  const { status, permissions } = useTenantSession();
  const allowed = status === "authenticated" && hasPermission(permissions, FEATURE_FLAGS_VIEW);
  const query = useQuery({
    queryKey: [...featureFlagsApi.workspaceFlagsKey],
    queryFn: () => featureFlagsApi.evaluate(),
    enabled: allowed,
    staleTime: 60_000,
    retry: false,
  });
  const flags = (allowed && query.data?.flags) || EMPTY;
  const isEnabled = useCallback((key: string) => flags[key] === true, [flags]);
  return {
    flags,
    isEnabled,
    isLoading: allowed && query.isLoading,
    isError: allowed && query.isError,
    allowed,
  };
}

/** Whether one flag is on for the workspace (false until known). */
export function useFeatureFlag(key: string) {
  return useFeatureFlags().isEnabled(key);
}
