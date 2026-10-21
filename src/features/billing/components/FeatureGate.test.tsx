import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children?: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
vi.mock("@/features/billing/api", () => ({ getEntitlements: vi.fn() }));

import * as billingApi from "@/features/billing/api";
import type { EntitlementResolved } from "@/features/billing/api";
import { useTenantSession } from "@/lib/auth/session";
import { FeatureGate } from "./FeatureGate";

const getEntitlements = vi.mocked(billingApi.getEntitlements);

function entitlements(
  features: Record<string, boolean>,
  writeBlocked = false,
): EntitlementResolved {
  return {
    tenantId: "t1",
    plan: { id: "p", code: "free", name: "Free", displayName: "Free", tier: 0, status: "active" },
    subscription: null,
    state: "active",
    features,
    limits: {},
    overrides: [],
    writeBlocked,
    source: "catalog",
    resolvedAt: "2026-10-22T00:00:00.000Z",
  };
}

function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeatureGate feature="embedding">
        <p>embed page</p>
      </FeatureGate>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTenantSession).mockReturnValue({ me: { tenantId: "t1" } } as never);
});

describe("FeatureGate", () => {
  it("shows the locked state when the plan lacks the feature, keeping the page usable", async () => {
    getEntitlements.mockResolvedValue(entitlements({ embedding: false }));
    renderGate();
    expect(await screen.findByTestId("feature-locked-embedding")).toBeInTheDocument();
    expect(screen.getByText("View plans")).toHaveAttribute("href", "/pricing");
    expect(screen.getByText("embed page")).toBeInTheDocument();
  });

  it("shows nothing extra when the plan includes the feature", async () => {
    getEntitlements.mockResolvedValue(entitlements({ embedding: true }));
    renderGate();
    expect(await screen.findByText("embed page")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("feature-locked-embedding")).toBeNull();
  });

  it("locks when the subscription blocks writes, and stays quiet when entitlements cannot be read", async () => {
    getEntitlements.mockResolvedValue(entitlements({ embedding: true }, true));
    const { unmount } = renderGate();
    expect(await screen.findByTestId("feature-locked-embedding")).toBeInTheDocument();
    unmount();
    getEntitlements.mockRejectedValue(new Error("forbidden"));
    renderGate();
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByTestId("feature-locked-embedding")).toBeNull();
  });
});
