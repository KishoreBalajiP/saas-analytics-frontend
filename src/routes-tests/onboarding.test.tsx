import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  connectorsList: vi.fn(),
  connectorGet: vi.fn(),
  dashboardsList: vi.fn(),
  connectorCreate: vi.fn(),
  dashboardCreate: vi.fn(),
  invite: vi.fn(),
}));

vi.mock("@/components/layout/TenantPortal", () => ({
  TenantPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/auth/session", () => ({
  useTenantSession: () => ({ me: { email: "owner@example.test" } }),
}));
vi.mock("@/features/datasets/api", () => ({
  list: (...args: unknown[]) => services.connectorsList(...args),
  create: (...args: unknown[]) => services.connectorCreate(...args),
  get: (...args: unknown[]) => services.connectorGet(...args),
  validate: vi.fn(),
  previewFile: vi.fn(),
  syncFile: vi.fn(),
  listRows: vi.fn(),
}));
vi.mock("@/features/dashboards/api", () => ({
  list: (...args: unknown[]) => services.dashboardsList(...args),
  create: (...args: unknown[]) => services.dashboardCreate(...args),
}));
vi.mock("@/features/auth/api", () => ({
  inviteTenantMember: (...args: unknown[]) => services.invite(...args),
}));

import { OnboardingPage } from "@/routes/onboarding";

function paged<T>(data: T[]) {
  return { data, meta: { page: 1, limit: 100, total: data.length, pages: data.length ? 1 : 0 } };
}

function renderOnboarding() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OnboardingPage />
    </QueryClientProvider>,
  );
}

describe("onboarding route state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.connectorsList.mockResolvedValue(paged([]));
    services.connectorGet.mockResolvedValue(undefined);
    services.dashboardsList.mockResolvedValue(paged([]));
  });

  it("reconstructs completed sync and dashboard steps from server records", async () => {
    services.connectorsList.mockResolvedValue(
      paged([
        {
          _id: "connector-1",
          type: "csv",
          name: "Orders",
          status: "active",
          lastSyncedAt: "2026-10-11T12:00:00.000Z",
          syncStatus: "succeeded",
        },
      ]),
    );
    services.connectorGet.mockResolvedValue({
      _id: "connector-1",
      type: "csv",
      name: "Orders",
      status: "active",
      lastSyncedAt: "2026-10-11T12:00:00.000Z",
      syncStatus: "succeeded",
    });
    services.dashboardsList.mockResolvedValue(
      paged([{ _id: "dashboard-1", name: "Overview", status: "draft" }]),
    );

    renderOnboarding();

    expect(await screen.findByText("Workspace setup complete")).toBeVisible();
    expect(screen.getByText("Orders")).toBeVisible();
    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
  });

  it("resumes polling a queued sync instead of treating it as complete", async () => {
    services.connectorsList.mockResolvedValue(
      paged([
        { _id: "connector-1", type: "csv", name: "Orders", status: "active", syncStatus: "queued" },
      ]),
    );
    services.connectorGet.mockResolvedValue({
      _id: "connector-1",
      type: "csv",
      name: "Orders",
      status: "active",
      syncStatus: "queued",
      syncRequestedAt: "2026-10-11T12:00:00.000Z",
    });

    renderOnboarding();

    expect(await screen.findByText(/sync is queued/i)).toBeVisible();
    expect(screen.queryByText("Workspace setup complete")).not.toBeInTheDocument();
  });

  it("does not claim completion when authoritative status cannot be loaded and permits retry", async () => {
    services.connectorsList.mockRejectedValueOnce(new Error("network unavailable"));

    renderOnboarding();

    expect(await screen.findByText("Setup status is unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(services.connectorsList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("1. Connect and import a file")).toBeVisible());
    expect(screen.queryByText("Workspace setup complete")).not.toBeInTheDocument();
  });
});
