import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const adminApi = vi.hoisted(() => ({
  impersonate: vi.fn(),
  stopImpersonation: vi.fn(),
  recoverAccount: vi.fn(),
  revokeUserSessions: vi.fn(),
  broadcast: vi.fn(),
  tenantDiagnostics: vi.fn(),
  listSupportGrants: vi.fn(),
  requestBreakGlass: vi.fn(),
  approveBreakGlass: vi.fn(),
  denyBreakGlass: vi.fn(),
  revokeSupportGrant: vi.fn(),
  listSupportSessions: vi.fn(),
}));
vi.mock("@/features/admin/api", () => adminApi);

const beginSupportSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supportSession", () => ({ beginSupportSession }));
vi.mock("@/lib/auth/session", () => ({ useAdminSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { useAdminSession } from "@/lib/auth/session";
import { SupportConsole } from "./SupportConsole";

const empty = { data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } };

function asAdmin(permissions: string[], id = "adm_me") {
  vi.mocked(useAdminSession).mockReturnValue({
    status: "authenticated",
    me: { id, email: "operator@platform.test", permissions },
    tenantSlug: null,
    permissions,
    hasPermission: (key: string) => permissions.includes(key),
    refetch: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  } as never);
}

function renderConsole() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SupportConsole />
    </QueryClientProvider>,
  );
}

const started = {
  token: "support-token",
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  expiresIn: 900,
  sessionId: "ses_9",
  impersonation: true as const,
  readOnly: true as const,
  breakGlass: false,
  grantId: "sag_1",
  user: { id: "usr_1", email: "user@acme.test", name: null, tenantId: "ten_1" },
  startedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  adminApi.listSupportGrants.mockResolvedValue(empty);
  adminApi.listSupportSessions.mockResolvedValue(empty);
});

describe("SupportConsole", () => {
  it("needs support.view or support.configure (support.lookup is not a real key)", () => {
    asAdmin(["support.lookup", "monitoring.view"]);
    renderConsole();
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
  });

  it("starts a support session with the exact contract and opens the workspace", async () => {
    asAdmin(["support.configure", "support.view"]);
    adminApi.impersonate.mockResolvedValue(started);
    renderConsole();

    fireEvent.change(screen.getByLabelText("User ID", { selector: "#support-target-user" }), {
      target: { value: "usr_1" },
    });
    fireEvent.change(screen.getByLabelText("Ticket (optional)", { selector: "#support-ticket" }), {
      target: { value: "T-9" },
    });
    fireEvent.change(screen.getByLabelText("Reason", { selector: "#support-session-reason" }), {
      target: { value: "Customer cannot see dashboards" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start support session" }));
    await waitFor(() =>
      expect(adminApi.impersonate).toHaveBeenCalledWith(
        "usr_1",
        "Customer cannot see dashboards",
        "T-9",
      ),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /open workspace as user@acme.test/i }),
    );
    expect(beginSupportSession).toHaveBeenCalledWith(started, "operator@platform.test");
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });

  it("explains a refusal for missing consent", async () => {
    asAdmin(["support.configure", "support.view"]);
    adminApi.impersonate.mockRejectedValue(
      new ApiError("no consent", 403, "SUPPORT_CONSENT_REQUIRED"),
    );
    renderConsole();
    fireEvent.change(screen.getByLabelText("User ID", { selector: "#support-target-user" }), {
      target: { value: "usr_1" },
    });
    fireEvent.change(screen.getByLabelText("Reason", { selector: "#support-session-reason" }), {
      target: { value: "Investigate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start support session" }));
    expect(await screen.findByText(/has not granted support access/i)).toBeInTheDocument();
    expect(beginSupportSession).not.toHaveBeenCalled();
  });

  it("stops a started session with a reason", async () => {
    asAdmin(["support.configure", "support.view"]);
    adminApi.impersonate.mockResolvedValue(started);
    adminApi.stopImpersonation.mockResolvedValue({ sessionId: "ses_9", status: "revoked" });
    renderConsole();
    fireEvent.change(screen.getByLabelText("User ID", { selector: "#support-target-user" }), {
      target: { value: "usr_1" },
    });
    fireEvent.change(screen.getByLabelText("Reason", { selector: "#support-session-reason" }), {
      target: { value: "Investigate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start support session" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop session" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Resolved" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Stop session" }));
    await waitFor(() =>
      expect(adminApi.stopImpersonation).toHaveBeenCalledWith("ses_9", "Resolved"),
    );
  });

  it("opens sanitised diagnostics for a workspace", async () => {
    asAdmin(["support.view"]);
    adminApi.tenantDiagnostics.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      window: { hours: 24, since: new Date().toISOString() },
      tenant: {
        id: "ten_1",
        name: "Acme",
        slug: "acme",
        status: "active",
        planId: "free",
        onboardingStatus: null,
        defaultTimezone: "UTC",
        createdAt: null,
        trialEndsAt: null,
        suspendedAt: null,
        disabledAt: null,
        archivedAt: null,
      },
      subscription: {
        plan: { code: "free" },
        state: "active",
        writeBlocked: false,
        warnings: [],
        error: null,
      },
      usage: {},
      users: { total: 3, byStatus: { active: 3 }, activeSessions: 2 },
      connectors: {
        total: 1,
        byStatus: { error: 1 },
        withErrors: 1,
        items: [
          {
            id: "c1",
            type: "mongodb",
            name: "Orders",
            status: "error",
            syncStatus: "failed",
            lastSyncedAt: null,
            errorCount: 2,
            lastError: "connect failed for mongodb://***@db",
          },
        ],
      },
      syncRuns: { failedInWindow: 1, recent: [] },
      requests: {
        total: 10,
        clientErrors: 1,
        serverErrors: 0,
        errorRate: 0.1,
        byStatus: [],
        topErrors: [],
      },
      broken: { widgets: 0, reports: 0, alerts: 0 },
      supportAccess: { active: null, pendingBreakGlass: 0, openSessions: 0 },
    });
    renderConsole();
    // View-only: no session or account tools.
    expect(screen.queryByRole("button", { name: "Start support session" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Workspace ID"), { target: { value: "ten_1" } });
    fireEvent.click(screen.getByRole("button", { name: /open workspace diagnostics/i }));
    await waitFor(() => expect(adminApi.tenantDiagnostics).toHaveBeenCalledWith("ten_1"));
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(/mongodb:\/\/\*\*\*@db/)).toBeInTheDocument();
    expect(screen.getByText(/No support access granted/)).toBeInTheDocument();
  });

  it("shows break-glass approvals only with support.approve and blocks approving one's own", async () => {
    asAdmin(["support.view"]);
    const { unmount } = renderConsole();
    expect(screen.queryByText("Break-glass approvals")).not.toBeInTheDocument();
    unmount();

    asAdmin(["support.view", "support.approve"], "adm_me");
    const pending = (id: string, requester: string) => ({
      id,
      tenantId: "ten_1",
      kind: "break_glass",
      breakGlass: true,
      status: "pending",
      reason: "INC-42 dashboards empty",
      ticket: "INC-42",
      grantedBy: null,
      requestedBy: { id: requester, display: requester },
      decidedBy: null,
      createdAt: new Date().toISOString(),
    });
    adminApi.listSupportGrants.mockResolvedValue({
      data: [pending("sag_own", "adm_me"), pending("sag_other", "adm_other")],
      meta: { page: 1, limit: 50, total: 2, pages: 1 },
    });
    adminApi.approveBreakGlass.mockResolvedValue({});
    renderConsole();
    expect(await screen.findByText("Break-glass approvals")).toBeInTheDocument();
    const approveButtons = await screen.findAllByRole("button", { name: "Approve" });
    expect(approveButtons[0]).toBeDisabled();
    expect(approveButtons[1]).toBeEnabled();
    fireEvent.click(approveButtons[1]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Confirmed with on-call" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(adminApi.approveBreakGlass).toHaveBeenCalledWith(
        "sag_other",
        "Confirmed with on-call",
      ),
    );
  });

  it("sends account tools with a reason", async () => {
    asAdmin(["support.configure"]);
    adminApi.recoverAccount.mockResolvedValue({ ok: true });
    renderConsole();
    fireEvent.change(screen.getByLabelText("User ID", { selector: "#support-account-user" }), {
      target: { value: "usr_2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send password reset" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "User locked out" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(adminApi.recoverAccount).toHaveBeenCalledWith("usr_2", "User locked out"),
    );
  });
});
