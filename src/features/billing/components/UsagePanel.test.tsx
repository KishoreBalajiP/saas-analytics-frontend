import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children?: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/lib/auth/session", () => ({
  useTenantSession: vi.fn(),
}));

vi.mock("@/features/billing/api", () => ({
  getUsage: vi.fn(),
}));

import * as billingApi from "@/features/billing/api";
import type { UsageMetric, UsageSummary } from "@/features/billing/api";
import { useTenantSession } from "@/lib/auth/session";
import { UsagePanel, UsageSummaryView } from "./UsagePanel";

const mockedSession = vi.mocked(useTenantSession);
const mockedGetUsage = vi.mocked(billingApi.getUsage);

function metric(partial: Partial<UsageMetric>): UsageMetric {
  return {
    current: 0,
    limit: 10,
    hard: true,
    period: "current",
    periodKey: "current",
    resetsAt: null,
    remaining: 10,
    percent: 0,
    included: true,
    warning: false,
    atLimit: false,
    overLimit: false,
    blocked: false,
    status: "ok",
    ...partial,
  };
}

function summary(
  usage: Record<string, UsageMetric>,
  extra: Partial<UsageSummary> = {},
): UsageSummary {
  return {
    tenantId: "t1",
    plan: {
      id: "p",
      code: "starter",
      name: "Starter",
      displayName: "Starter",
      tier: 1,
      status: "active",
    },
    state: "active",
    writeBlocked: false,
    warningThreshold: 0.8,
    warnings: [],
    usage,
    resolvedAt: "2026-03-10T00:00:00.000Z",
    ...extra,
  };
}

function setPermissions(permissions: string[]) {
  mockedSession.mockReturnValue({
    status: "authenticated",
    me: { id: "u1", email: "o@example.com", permissions },
    tenantSlug: "acme",
    permissions,
    hasPermission: (p: string) => permissions.includes(p),
    refetch: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useTenantSession>);
}

beforeEach(() => vi.clearAllMocks());

describe("UsageSummaryView", () => {
  it("shows usage against limits with ok, warning and blocked states", () => {
    render(
      <UsageSummaryView
        usage={summary({
          members: metric({ current: 2, limit: 10, remaining: 8, percent: 20 }),
          dashboards: metric({
            current: 4,
            limit: 5,
            remaining: 1,
            percent: 80,
            warning: true,
            status: "warning",
          }),
          connectors: metric({
            current: 1,
            limit: 1,
            remaining: 0,
            percent: 100,
            warning: true,
            atLimit: true,
            blocked: true,
            status: "at_limit",
          }),
        })}
      />,
    );
    const members = screen.getByTestId("usage-members");
    expect(members).toHaveAttribute("data-status", "ok");
    expect(within(members).getByText("8 left")).toBeInTheDocument();

    const dashboards = screen.getByTestId("usage-dashboards");
    expect(dashboards).toHaveAttribute("data-status", "warning");
    expect(within(dashboards).getByText("Near limit")).toBeInTheDocument();
    expect(within(dashboards).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");

    const connectors = screen.getByTestId("usage-connectors");
    expect(connectors).toHaveAttribute("data-status", "at_limit");
    expect(within(connectors).getByText("At limit")).toBeInTheDocument();
    expect(within(connectors).getByText(/new ones are blocked/)).toBeInTheDocument();

    expect(screen.getByTestId("usage-attention")).toHaveTextContent(
      "Limit reached for connectors. Free up capacity or upgrade your plan to create more.",
    );
  });

  it("names metrics above the warning threshold when nothing is blocked", () => {
    render(
      <UsageSummaryView
        usage={summary({
          reports: metric({
            current: 9,
            limit: 10,
            remaining: 1,
            warning: true,
            status: "warning",
          }),
        })}
      />,
    );
    expect(screen.getByTestId("usage-attention")).toHaveTextContent(
      "Reports is at or above 80% of the plan limit.",
    );
    expect(screen.getByText(/Warnings start at 80% of a limit/)).toBeInTheDocument();
  });

  it("explains a spent daily API allowance as a wait for the reset, not a capacity problem", () => {
    render(
      <UsageSummaryView
        usage={summary({
          apiCallsPerDay: metric({
            current: 1000,
            limit: 1000,
            remaining: 0,
            percent: 100,
            period: "day",
            periodKey: "2026-03-10",
            resetsAt: "2026-03-11T00:00:00.000Z",
            warning: true,
            atLimit: true,
            blocked: true,
            status: "at_limit",
          }),
        })}
      />,
    );
    const tile = screen.getByTestId("usage-apiCallsPerDay");
    expect(tile).toHaveAttribute("data-status", "at_limit");
    expect(within(tile).getByText(/calls are refused until the reset/)).toBeInTheDocument();
    const banner = screen.getByTestId("usage-attention");
    expect(banner).toHaveTextContent("Daily limit reached for api calls / day.");
    expect(banner).not.toHaveTextContent("Free up capacity");
  });

  it("treats a passed soft limit as a warning, shows unlimited, not-included and daily reset", () => {
    render(
      <UsageSummaryView
        usage={summary({
          dashboards: metric({
            current: 52,
            limit: 50,
            hard: false,
            remaining: 0,
            atLimit: true,
            overLimit: true,
            warning: true,
            status: "over_limit",
          }),
          alerts: metric({
            current: 0,
            limit: 0,
            included: false,
            remaining: 0,
            atLimit: true,
            blocked: true,
            status: "not_included",
          }),
          storedRows: metric({ current: 1234, limit: null, remaining: null, status: "unlimited" }),
          apiCallsPerDay: metric({
            current: 12,
            limit: 1000,
            remaining: 988,
            period: "day",
            periodKey: "2026-03-10",
            resetsAt: "2026-03-11T00:00:00.000Z",
          }),
        })}
      />,
    );
    const soft = screen.getByTestId("usage-dashboards");
    expect(soft).toHaveAttribute("data-status", "warning");
    expect(within(soft).getByText(/Soft limit passed/)).toBeInTheDocument();
    expect(within(soft).getByText(/\(soft\)/)).toBeInTheDocument();
    expect(
      within(screen.getByTestId("usage-alerts")).getByText("Not included in your plan"),
    ).toBeInTheDocument();
    const unlimited = screen.getByTestId("usage-storedRows");
    expect(unlimited).toHaveAttribute("data-status", "unlimited");
    expect(unlimited).toHaveTextContent("1,234/ Unlimited");
    const api = screen.getByTestId("usage-apiCallsPerDay");
    expect(within(api).getByText("Resets daily at 00:00 UTC")).toBeInTheDocument();
    expect(within(api).getByText("988 left")).toBeInTheDocument();
  });

  it("does not raise an alert for metrics the plan simply does not include", () => {
    render(
      <UsageSummaryView
        usage={summary({
          alerts: metric({
            current: 0,
            limit: 0,
            included: false,
            remaining: 0,
            atLimit: true,
            blocked: true,
            status: "not_included",
          }),
        })}
      />,
    );
    expect(screen.queryByTestId("usage-attention")).not.toBeInTheDocument();
    expect(screen.getByTestId("usage-alerts")).toHaveAttribute("data-status", "not_included");
  });

  it("warns when the subscription blocks writes", () => {
    render(<UsageSummaryView usage={summary({}, { writeBlocked: true, state: "restricted" })} />);
    expect(screen.getByText(/new resources cannot be created/)).toBeInTheDocument();
  });
});

describe("UsagePanel", () => {
  function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <UsagePanel tenantId="t1" />
      </QueryClientProvider>,
    );
  }

  it("does not request usage without iam.entitlements.view", () => {
    setPermissions(["dashboards.view"]);
    renderPanel();
    expect(screen.getByRole("heading", { name: /Permission required/i })).toBeInTheDocument();
    expect(mockedGetUsage).not.toHaveBeenCalled();
  });

  it("loads usage for the tenant and renders the metrics", async () => {
    setPermissions(["iam.entitlements.view"]);
    mockedGetUsage.mockResolvedValue(
      summary({ dashboards: metric({ current: 3, limit: 5, remaining: 2 }) }),
    );
    renderPanel();
    await waitFor(() => expect(screen.getByTestId("usage-dashboards")).toBeInTheDocument());
    expect(mockedGetUsage).toHaveBeenCalledWith("t1");
    expect(screen.getByText("2 left")).toBeInTheDocument();
  });
});
