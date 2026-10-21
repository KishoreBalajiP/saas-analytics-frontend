import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  listAuditLogs: vi.fn(),
  exportAuditLogs: vi.fn(),
  auditExportStatus: vi.fn(),
  listAccessLogs: vi.fn(),
  listLoginAttempts: vi.fn(),
}));
vi.mock("@/features/admin/api", () => api);

const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/lib/auth/session", () => ({ useAdminSession: () => session }));

import {
  EMPTY_AUDIT_FILTERS,
  EMPTY_LOGIN_ATTEMPT_FILTERS,
  toAuditQuery,
  toLoginAttemptQuery,
} from "@/features/admin/auditFilters";
import { AccessLogList, AuditLogList, LoginAttemptList, TenantAuditHistory } from "./AuditViews";

const securityRow = {
  _id: "a1",
  category: "security",
  severity: "warning",
  actorType: "user",
  actorId: "u1",
  actorDisplay: "eve@example.com",
  tenantId: "t1",
  module: "security.access",
  action: "request.denied",
  resourceType: "route",
  resourceId: "GET /api/v1/users",
  result: "failure",
  errorCode: "FORBIDDEN",
  ip: "203.0.113.9",
  userAgent: "curl/8",
  requestId: "req-1",
  reason: "permission_missing",
  metadata: { permission: "users.view", route: "GET /api/v1/users" },
  occurredAt: "2026-10-20T10:00:00.000Z",
  seq: 42,
  hash: "f".repeat(64),
};
const changeRow = {
  _id: "a2",
  actorType: "admin",
  actorId: "adm1",
  tenantId: null,
  module: "iam.roles",
  action: "update",
  resourceType: "role",
  resourceId: "r1",
  before: { description: "" },
  after: { description: "ops" },
  result: "success",
  occurredAt: "2026-10-20T09:00:00.000Z",
};

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  session.permissions = ["audit_logs.view", "audit_logs.export", "access_logs.view"];
  api.listAuditLogs.mockResolvedValue({
    data: [securityRow, changeRow],
    meta: { page: 1, limit: 25, total: 2, pages: 1 },
  });
  api.exportAuditLogs.mockResolvedValue({ exportId: "exp_1" });
  api.auditExportStatus.mockResolvedValue({
    status: "completed",
    downloadUrl: "https://example.test/d",
    recordCount: 2,
  });
  api.listAccessLogs.mockResolvedValue({
    data: [
      {
        _id: "l1",
        actorType: "system",
        actorId: null,
        method: "POST",
        path: "/api/v1/auth/login",
        statusCode: 401,
        event: "auth.login",
        ip: "198.51.100.1",
        occurredAt: "2026-10-20T10:00:00.000Z",
      },
    ],
    meta: { page: 1, limit: 50, total: 1, pages: 1 },
  });
  api.listLoginAttempts.mockResolvedValue({
    data: [
      {
        _id: "la1",
        actorId: "u1",
        actorType: "user",
        email: "eve@example.com",
        tenantId: "t1",
        ip: "198.51.100.7",
        userAgent: "curl/8",
        success: false,
        reason: "invalid_credentials",
        occurredAt: "2026-10-20T10:00:00.000Z",
      },
    ],
    meta: { page: 1, limit: 25, total: 1, pages: 1 },
  });
});

describe("AuditLogList", () => {
  it("renders the backend's flat rows: actor, tenant, result, ip and security severity", async () => {
    wrap(<AuditLogList />);
    expect(await screen.findByText("request.denied")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("user: eve@example.com")).toBeInTheDocument();
    expect(table.getByText("admin: adm1")).toBeInTheDocument();
    expect(table.getByText("203.0.113.9")).toBeInTheDocument();
    expect(table.getByText("warning")).toBeInTheDocument();
    expect(table.getByText("change")).toBeInTheDocument();
    expect(table.getByText("failure")).toBeInTheDocument();
    expect(table.getByText("platform")).toBeInTheDocument();
    expect(api.listAuditLogs).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  it("filters to security events and by severity, action and result", async () => {
    const user = userEvent.setup();
    wrap(<AuditLogList />);
    await screen.findByText("request.denied");

    await user.click(screen.getByRole("button", { name: "Security events" }));
    await waitFor(() =>
      expect(api.listAuditLogs).toHaveBeenLastCalledWith({
        category: "security",
        page: 1,
        limit: 25,
      }),
    );

    await user.selectOptions(screen.getByLabelText("Filter by severity"), "warning");
    await user.type(screen.getByLabelText("Filter by action"), "request.denied");
    await user.selectOptions(screen.getByLabelText("Filter by result"), "failure");
    await user.click(screen.getByRole("button", { name: /Filter/ }));
    await waitFor(() =>
      expect(api.listAuditLogs).toHaveBeenLastCalledWith({
        category: "security",
        severity: "warning",
        action: "request.denied",
        result: "failure",
        page: 1,
        limit: 25,
      }),
    );
    expect(screen.getByRole("button", { name: "Security events" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens an entry's details with metadata, request context and chain position", async () => {
    const user = userEvent.setup();
    wrap(<AuditLogList />);
    await user.click(await screen.findByRole("button", { name: "Details for request.denied" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("permission_missing")).toBeInTheDocument();
    expect(within(dialog).getByText("curl/8")).toBeInTheDocument();
    expect(within(dialog).getByText(/users\.view/)).toBeInTheDocument();
    expect(within(dialog).getByText(new RegExp(`#42 ${"f".repeat(64)}`))).toBeInTheDocument();
  });

  it("exports with the applied filters and links the finished artefact", async () => {
    const user = userEvent.setup();
    wrap(<AuditLogList />);
    await screen.findByText("request.denied");
    await user.click(screen.getByRole("button", { name: "Security events" }));
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() =>
      expect(api.exportAuditLogs).toHaveBeenCalledWith({ category: "security" }, "csv"),
    );
    // retention's ExportStatusCard: record count, expiry and the signed link.
    expect(await screen.findByRole("link", { name: /Download/ })).toHaveAttribute(
      "href",
      "https://example.test/d",
    );
    expect(screen.getByText(/2 records/)).toBeInTheDocument();
  });

  it("hides export without the export permission and refuses without view", async () => {
    session.permissions = ["audit_logs.view"];
    const { unmount } = wrap(<AuditLogList />);
    await screen.findByText("request.denied");
    expect(screen.queryByRole("button", { name: "Export JSON" })).toBeNull();
    unmount();

    session.permissions = [];
    wrap(<AuditLogList />);
    expect(api.listAuditLogs).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("request.denied")).toBeNull();
  });

  it("shows the API error state", async () => {
    api.listAuditLogs.mockRejectedValue(new ApiError("boom", 500, "INTERNAL_ERROR"));
    wrap(<AuditLogList />);
    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("an empty security filter says so", async () => {
    const user = userEvent.setup();
    wrap(<AuditLogList />);
    await screen.findByText("request.denied");
    api.listAuditLogs.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total: 0, pages: 0 },
    });
    await user.click(screen.getByRole("button", { name: "Security events" }));
    expect(await screen.findByText("No security events")).toBeInTheDocument();
  });
});

describe("TenantAuditHistory", () => {
  it("pins the list to the tenant and hides the tenant filter", async () => {
    wrap(<TenantAuditHistory tenantId="t-9" />);
    expect(await screen.findByText("Audit history")).toBeInTheDocument();
    await waitFor(() =>
      expect(api.listAuditLogs).toHaveBeenCalledWith({ tenantId: "t-9", page: 1, limit: 25 }),
    );
    expect(screen.queryByLabelText("Filter by tenant")).toBeNull();
  });

  it("renders nothing without the audit permission", () => {
    session.permissions = [];
    const { container } = wrap(<TenantAuditHistory tenantId="t-9" />);
    expect(container).toBeEmptyDOMElement();
    expect(api.listAuditLogs).not.toHaveBeenCalled();
  });
});

describe("toAuditQuery", () => {
  it("drops empty values, maps whole days and enforces a pinned tenant", () => {
    const query = toAuditQuery(
      {
        ...EMPTY_AUDIT_FILTERS,
        category: "change",
        module: " iam.roles ",
        tenantId: "other",
        dateFrom: "2026-10-01",
        dateTo: "2026-10-02",
      },
      "pinned",
    );
    expect(query["category"]).toBe("change");
    expect(query["module"]).toBe("iam.roles");
    expect(query["tenantId"]).toBe("pinned");
    expect(new Date(query["dateFrom"]!).getTime()).toBeLessThan(
      new Date(query["dateTo"]!).getTime(),
    );
    expect(query["severity"]).toBeUndefined();
  });
});

describe("AccessLogList", () => {
  it("shows status, event, actor and ip and filters by status and event", async () => {
    const user = userEvent.setup();
    wrap(<AccessLogList />);
    expect(await screen.findByText("/api/v1/auth/login")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("401")).toBeInTheDocument();
    expect(table.getByText("auth.login")).toBeInTheDocument();
    expect(table.getByText("198.51.100.1")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Filter by status code"), "4x01");
    await user.type(screen.getByLabelText("Filter by event"), "auth.login");
    await user.click(screen.getByRole("button", { name: /Filter/ }));
    await waitFor(() =>
      expect(api.listAccessLogs).toHaveBeenLastCalledWith({
        statusCode: "401",
        event: "auth.login",
        page: 1,
        limit: 50,
      }),
    );
  });
});

describe("LoginAttemptList", () => {
  it("lists each sign-in attempt and filters by outcome, email and portal", async () => {
    const user = userEvent.setup();
    wrap(<LoginAttemptList />);
    expect(await screen.findByText("eve@example.com")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("invalid_credentials")).toBeInTheDocument();
    expect(table.getByText("failure")).toBeInTheDocument();
    expect(table.getByText("198.51.100.7")).toBeInTheDocument();
    expect(api.listLoginAttempts).toHaveBeenCalledWith({ page: 1, limit: 25 });

    await user.type(screen.getByLabelText("Filter sign-in attempts by email"), "eve@example.com");
    await user.selectOptions(
      screen.getByLabelText("Filter sign-in attempts by outcome"),
      "failure",
    );
    await user.selectOptions(screen.getByLabelText("Filter sign-in attempts by portal"), "user");
    await user.click(screen.getByRole("button", { name: /Filter attempts/ }));
    await waitFor(() =>
      expect(api.listLoginAttempts).toHaveBeenLastCalledWith({
        email: "eve@example.com",
        success: "false",
        actorType: "user",
        page: 1,
        limit: 25,
      }),
    );
  });

  it("renders nothing and fetches nothing without access_logs.view", () => {
    session.permissions = ["audit_logs.view"];
    const { container } = wrap(<LoginAttemptList />);
    expect(container).toBeEmptyDOMElement();
    expect(api.listLoginAttempts).not.toHaveBeenCalled();
  });

  it("maps the outcome filter to the API's success flag", () => {
    expect(toLoginAttemptQuery(EMPTY_LOGIN_ATTEMPT_FILTERS)).toEqual({});
    expect(
      toLoginAttemptQuery({ ...EMPTY_LOGIN_ATTEMPT_FILTERS, outcome: "success", ip: " 10.0.0.1 " }),
    ).toEqual({ success: "true", ip: "10.0.0.1" });
  });
});
