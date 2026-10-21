import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({ evaluate: vi.fn() }));
vi.mock("@/features/feature-flags/api", () => ({
  workspaceFlagsKey: ["workspace", "feature-flags"],
  evaluate: (...args: unknown[]) => api.evaluate(...args),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));

import { useTenantSession } from "@/lib/auth/session";
import { useFeatureFlag, useFeatureFlags } from "./useFeatureFlags";

function asUser(permissions: string[], status = "authenticated") {
  vi.mocked(useTenantSession).mockReturnValue({ status, permissions } as never);
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.evaluate.mockResolvedValue({ flags: { "analytics.realtime": true, "beta.x": false } });
});

describe("useFeatureFlags", () => {
  it("reads the workspace flags and answers isEnabled per key", async () => {
    asUser(["feature_flags.view"]);
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    expect(result.current.isEnabled("analytics.realtime")).toBe(false); // off until known
    await waitFor(() => expect(result.current.isEnabled("analytics.realtime")).toBe(true));
    expect(result.current.isEnabled("beta.x")).toBe(false);
    expect(result.current.isEnabled("unknown.flag")).toBe(false);
    expect(api.evaluate).toHaveBeenCalledTimes(1);
  });

  it("fails closed without feature_flags.view or a session (no request)", () => {
    asUser(["analytics.view"]);
    const { result } = renderHook(() => useFeatureFlag("analytics.realtime"), { wrapper });
    expect(result.current).toBe(false);
    asUser(["feature_flags.view"], "anonymous");
    const anonymous = renderHook(() => useFeatureFlags(), { wrapper });
    expect(anonymous.result.current.allowed).toBe(false);
    expect(api.evaluate).not.toHaveBeenCalled();
  });

  it("fails closed when the request errors", async () => {
    asUser(["feature_flags.view"]);
    api.evaluate.mockRejectedValue(new ApiError("Forbidden", 403));
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isEnabled("analytics.realtime")).toBe(false);
    expect(result.current.flags).toEqual({});
  });
});
