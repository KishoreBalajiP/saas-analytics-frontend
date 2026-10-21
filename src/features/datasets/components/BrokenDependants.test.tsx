/**
 * Reports and alerts that read from a deleted dataset come back from the
 * API with `brokenAt` / `brokenReason: "CONNECTOR_DELETED"`. The list rows
 * show a "Broken" badge and the detail views explain what happened and how
 * to fix it; healthy items show neither.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

import { useQuery } from "@tanstack/react-query";
import { useTenantSession } from "@/lib/auth/session";
import { AlertDetail, AlertsView } from "@/features/alerts/components/AlertsView";
import { ReportDetail, ReportsView } from "@/features/reports/components/ReportsView";

const PERMISSIONS = ["reports.view", "alerts.view"];
const BROKEN = { brokenAt: "2026-10-20T00:00:00.000Z", brokenReason: "CONNECTOR_DELETED" };

const report = (overrides: Record<string, unknown>) => ({
  _id: "r1",
  name: "Weekly revenue",
  format: "csv",
  source: "query",
  status: "active",
  schedule: { enabled: false },
  ...overrides,
});
const alertRule = (overrides: Record<string, unknown>) => ({
  _id: "a1",
  name: "Low stock",
  metric: "count",
  condition: "lt",
  threshold: 5,
  enabled: false,
  ...overrides,
});

function mockQueries(byKey: (key: readonly unknown[]) => unknown) {
  vi.mocked(useQuery).mockImplementation(
    (options) =>
      ({
        data: byKey((options.queryKey ?? []) as readonly unknown[]),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      }) as unknown as ReturnType<typeof useQuery>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTenantSession).mockReturnValue({
    status: "authenticated",
    me: { id: "u1", email: "t@t.com", permissions: PERMISSIONS },
    tenantSlug: "acme",
    permissions: PERMISSIONS,
    hasPermission: (p: string) => PERMISSIONS.includes(p),
    refetch: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  });
});

const page = (rows: unknown[]) => ({
  data: rows,
  meta: { page: 1, limit: 20, total: rows.length, pages: 1 },
});

describe("reports broken by a deleted dataset", () => {
  it("marks only the broken report in the list", () => {
    mockQueries(() =>
      page([
        report({ _id: "r1", name: "Broken one", ...BROKEN }),
        report({ _id: "r2", name: "Healthy one", brokenAt: null }),
      ]),
    );
    render(<ReportsView />);
    const brokenRow = screen.getByText("Broken one").closest("tr");
    const healthyRow = screen.getByText("Healthy one").closest("tr");
    expect(brokenRow).not.toBeNull();
    expect(within(brokenRow as HTMLElement).getByText("Broken")).toBeInTheDocument();
    expect(within(healthyRow as HTMLElement).queryByText("Broken")).toBeNull();
  });

  it("explains the broken state on the detail view", () => {
    mockQueries(() => report(BROKEN));
    render(<ReportDetail reportId="r1" />);
    expect(screen.getByRole("status")).toHaveTextContent("This report is broken");
    expect(screen.getByText(/dataset it reads from was deleted/)).toBeInTheDocument();
    expect(screen.getByText(/schedule was paused/)).toBeInTheDocument();
  });

  it("shows no broken state for a healthy report", () => {
    mockQueries(() => report({ brokenAt: null }));
    render(<ReportDetail reportId="r1" />);
    expect(screen.queryByText(/is broken/)).toBeNull();
  });
});

describe("alerts broken by a deleted dataset", () => {
  it("marks the broken alert in the list", () => {
    mockQueries(() => page([alertRule({ name: "Broken alert", ...BROKEN })]));
    render(<AlertsView />);
    const row = screen.getByText("Broken alert").closest("tr");
    expect(within(row as HTMLElement).getByText("Broken")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("Disabled")).toBeInTheDocument();
  });

  it("does not offer to enable a broken alert until it is re-pointed", () => {
    mockQueries(() =>
      page([
        alertRule({ _id: "a1", name: "Broken alert", ...BROKEN }),
        alertRule({ _id: "a2", name: "Healthy alert", brokenAt: null }),
      ]),
    );
    render(<AlertsView />);
    const brokenRow = screen.getByText("Broken alert").closest("tr") as HTMLElement;
    const healthyRow = screen.getByText("Healthy alert").closest("tr") as HTMLElement;
    const blocked = within(brokenRow).getByRole("button", { name: "Enable" });
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveAttribute("title", expect.stringMatching(/another dataset/));
    expect(within(healthyRow).getByRole("button", { name: "Enable" })).toBeEnabled();
  });

  it("explains the broken state on the detail view", () => {
    mockQueries((key) => (key.includes("events") ? page([]) : alertRule(BROKEN)));
    render(<AlertDetail alertId="a1" />);
    expect(screen.getByRole("status")).toHaveTextContent("This alert is broken");
    expect(screen.getByText(/enable it again/)).toBeInTheDocument();
  });
});
