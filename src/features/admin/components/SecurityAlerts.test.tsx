import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { SecurityAlert, SecurityAlertDetail } from "@/features/admin/api/securityAlerts";

const api = vi.hoisted(() => ({
  listSecurityAlerts: vi.fn(),
  getSecurityAlert: vi.fn(),
  listDetectionRules: vi.fn(),
  triageSecurityAlert: vi.fn(),
}));
vi.mock("@/features/admin/api/securityAlerts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/admin/api/securityAlerts")>()),
  ...api,
}));
const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/lib/auth/session", () => ({
  useAdminSession: () => ({ permissions: session.permissions }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { SecurityAlertsView } from "./SecurityAlerts";

const VIEW = "security.alerts.view";
const UPDATE = "security.alerts.update";

const alert: SecurityAlert = {
  id: "64b000000000000000000001",
  ruleId: "auth.credential_stuffing",
  ruleVersion: 1,
  title: "Credential stuffing from 203.0.113.9",
  summary: "25 failed sign-ins for 12 accounts from 203.0.113.9 within 15 minutes.",
  severity: "high",
  status: "open",
  subject: { type: "ip", id: "203.0.113.9", display: "203.0.113.9" },
  tenantId: null,
  firstSeenAt: "2026-10-20T11:30:00.000Z",
  lastSeenAt: "2026-10-20T11:57:00.000Z",
  windowStart: "2026-10-20T11:30:00.000Z",
  windowEnd: "2026-10-20T11:57:00.000Z",
  occurrences: 2,
  counts: { failures: 25, accounts: 12 },
  owner: null,
  acknowledgedAt: null,
  acknowledgedBy: null,
  closedAt: null,
  closedBy: null,
  resolutionNote: null,
  notifiedAt: "2026-10-20T11:58:00.000Z",
  createdAt: "2026-10-20T11:58:00.000Z",
  updatedAt: "2026-10-20T11:58:00.000Z",
};

const detail: SecurityAlertDetail = {
  ...alert,
  evidence: {
    counts: { failures: 25, accounts: 12 },
    details: { ipRange: "203.0.113.0/24" },
    refs: [
      {
        source: "login_attempt",
        id: "la-1",
        at: "2026-10-20T11:57:00.000Z",
        label: "user a@example.com: invalid_credentials",
      },
    ],
  },
  history: [
    {
      at: "2026-10-20T11:58:00.000Z",
      action: "raised",
      by: null,
      from: null,
      to: null,
      note: null,
    },
  ],
  notifications: [
    {
      at: "2026-10-20T11:58:00.000Z",
      channel: "email",
      target: "oncall@example.com",
      status: "sent",
      code: null,
    },
  ],
};

function renderView(props: { initialAlertId?: string } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SecurityAlertsView {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session.permissions = [VIEW, UPDATE];
  api.listSecurityAlerts.mockResolvedValue({
    data: [alert],
    meta: {
      page: 1,
      limit: 20,
      total: 1,
      pages: 1,
      statusCounts: { open: 1, acknowledged: 2, false_positive: 0, resolved: 4 },
    },
  });
  api.getSecurityAlert.mockResolvedValue(detail);
  api.listDetectionRules.mockResolvedValue([
    {
      id: "auth.credential_stuffing",
      version: 1,
      title: "Credential stuffing from one IP",
      description: "",
      source: "login_attempt",
      severity: "high",
      enabled: true,
      config: { enabled: true, windowMinutes: 15, minFailures: 20, minAccounts: 10 },
      defaults: {},
      ignoredOverrides: [],
      watermark: "2026-10-20T11:59:00.000Z",
      lastRunAt: "2026-10-20T12:00:00.000Z",
      lastDetections: 1,
      lastError: null,
    },
    {
      id: "api_key.revoked_use",
      version: 1,
      title: "Revoked API key still in use",
      description: "",
      source: "security_signal",
      severity: "medium",
      enabled: false,
      config: { enabled: false, minAttempts: 1 },
      defaults: {},
      ignoredOverrides: [],
      watermark: null,
      lastRunAt: null,
      lastDetections: 0,
      lastError: "source unavailable",
    },
  ]);
});

describe("SecurityAlertsView", () => {
  it("lists the active triage queue with severity, subject, rule and status counts", async () => {
    renderView();
    expect(await screen.findByText("Credential stuffing from 203.0.113.9")).toBeInTheDocument();
    expect(api.listSecurityAlerts).toHaveBeenCalledWith({
      status: "open,acknowledged",
      severity: undefined,
      search: undefined,
      page: 1,
      limit: 20,
    });
    const table = screen.getByRole("table");
    expect(within(table).getByText("high")).toBeInTheDocument();
    expect(within(table).getByText("ip 203.0.113.9")).toBeInTheDocument();
    expect(within(table).getByText("auth.credential_stuffing v1")).toBeInTheDocument();
    expect(within(table).getByText("2×")).toBeInTheDocument();
    expect(within(table).getByText("Platform")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Active/ })).toHaveTextContent("(3)");
    expect(screen.getByRole("button", { name: /Resolved/ })).toHaveTextContent("(4)");
  });

  it("filters by status, severity and search", async () => {
    renderView();
    await screen.findByText("Credential stuffing from 203.0.113.9");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Resolved/ }));
    await waitFor(() =>
      expect(api.listSecurityAlerts).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "resolved", page: 1 }),
      ),
    );
    await user.selectOptions(screen.getByLabelText("Severity"), "critical");
    await waitFor(() =>
      expect(api.listSecurityAlerts).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: "critical" }),
      ),
    );
    await user.type(screen.getByLabelText("Search"), "203.0.113");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(api.listSecurityAlerts).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "203.0.113", status: "resolved", severity: "critical" }),
      ),
    );
  });

  it("shows an empty state when nothing matches", async () => {
    api.listSecurityAlerts.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, pages: 0 },
    });
    renderView();
    expect(await screen.findByText("No security alerts")).toBeInTheDocument();
  });

  it("opens an alert with its evidence, history and notifications", async () => {
    renderView();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /View alert/ }));
    const panel = await screen.findByLabelText("Security alert detail");
    expect(api.getSecurityAlert).toHaveBeenCalledWith(alert.id);
    expect(within(panel).getByText(/Counts: failures: 25, accounts: 12/)).toBeInTheDocument();
    expect(within(panel).getByText(/203\.0\.113\.0\/24/)).toBeInTheDocument();
    expect(within(panel).getByText("user a@example.com: invalid_credentials")).toBeInTheDocument();
    expect(within(panel).getByText("login_attempt")).toBeInTheDocument();
    expect(within(panel).getByText(/Notifications: email sent/)).toBeInTheDocument();
    expect(within(panel).getByText("raised")).toBeInTheDocument();
  });

  it("acknowledges an open alert", async () => {
    api.triageSecurityAlert.mockResolvedValue({
      ...detail,
      status: "acknowledged",
      owner: { id: "adm1", display: "sec@platform.test" },
    });
    renderView({ initialAlertId: alert.id });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Acknowledge" }));
    await waitFor(() =>
      expect(api.triageSecurityAlert).toHaveBeenCalledWith(alert.id, "acknowledge", ""),
    );
    expect(toast.success).toHaveBeenCalledWith("Alert acknowledged");
    const panel = await screen.findByLabelText("Security alert detail");
    await waitFor(() => expect(within(panel).getByText("sec@platform.test")).toBeInTheDocument());
    expect(within(panel).getByText("Acknowledged")).toBeInTheDocument();
    // Acknowledged alerts can still be closed, not acknowledged again.
    expect(within(panel).queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Resolve" })).toBeInTheDocument();
  });

  it("closing needs a note: resolve and false positive stay disabled until one is written", async () => {
    api.triageSecurityAlert.mockResolvedValue({
      ...detail,
      status: "resolved",
      resolutionNote: "blocked at the edge",
    });
    renderView({ initialAlertId: alert.id });
    const user = userEvent.setup();
    const resolve = await screen.findByRole("button", { name: "Resolve" });
    const falsePositive = screen.getByRole("button", { name: "Mark false positive" });
    expect(resolve).toBeDisabled();
    expect(falsePositive).toBeDisabled();
    await user.type(screen.getByLabelText("Note"), "ok");
    expect(resolve).toBeDisabled();
    await user.type(screen.getByLabelText("Note"), " blocked at the edge");
    expect(resolve).toBeEnabled();
    await user.click(resolve);
    await waitFor(() =>
      expect(api.triageSecurityAlert).toHaveBeenCalledWith(
        alert.id,
        "resolve",
        "ok blocked at the edge",
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Alert resolved");
    // A closed alert offers no more triage.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument(),
    );
  });

  it("reports a triage conflict", async () => {
    api.triageSecurityAlert.mockRejectedValue(
      new ApiError(
        "This alert is acknowledged; it cannot be acknowledged again",
        409,
        "SECURITY_ALERT_STATE_CONFLICT",
      ),
    );
    renderView({ initialAlertId: alert.id });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Acknowledge" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This alert is acknowledged; it cannot be acknowledged again",
      ),
    );
  });

  it("view-only admins see alerts but no triage actions", async () => {
    session.permissions = [VIEW];
    renderView({ initialAlertId: alert.id });
    expect(await screen.findByLabelText("Security alert detail")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Triage needs the security\.alerts\.update permission/),
    ).toBeInTheDocument();
  });

  it("refuses without the view permission and shows API permission errors", async () => {
    session.permissions = ["monitoring.view"];
    const { unmount } = renderView();
    expect(screen.getByText("Permission required")).toBeInTheDocument();
    expect(api.listSecurityAlerts).not.toHaveBeenCalled();
    unmount();

    session.permissions = [VIEW];
    api.listSecurityAlerts.mockRejectedValue(new ApiError("Forbidden", 403, "FORBIDDEN"));
    renderView();
    expect(await screen.findByText("Permission required")).toBeInTheDocument();
  });

  it("shows the detection rule catalogue with thresholds, state and errors", async () => {
    renderView();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Detection rules" }));
    expect(await screen.findByText("Credential stuffing from one IP")).toBeInTheDocument();
    expect(
      screen.getByText("windowMinutes=15, minFailures=20, minAccounts=10"),
    ).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("source unavailable")).toBeInTheDocument();
  });
});
