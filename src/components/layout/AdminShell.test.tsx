import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUDITOR_PERMISSIONS,
  PLATFORM_ADMIN_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
  SUPPORT_OPERATOR_PERMISSIONS,
  adminSessionFor,
} from "@/features/admin/__fixtures__/platformRoles";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouterState: () => "/admin/dashboard",
}));
vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ to, children }: { to: string; children?: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
const session = vi.hoisted(() => ({ useAdminSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);

import { AdminShell } from "./AdminShell";

function navLabels() {
  const nav = screen.getByRole("navigation", { name: "Admin navigation" });
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
}

beforeEach(() => vi.clearAllMocks());

describe("AdminShell navigation gating by platform role", () => {
  it("shows a super admin every admin page", () => {
    session.useAdminSession.mockReturnValue(
      adminSessionFor(SUPER_ADMIN_PERMISSIONS, { adminType: "super" }),
    );
    render(<AdminShell>content</AdminShell>);
    expect(navLabels()).toEqual(
      expect.arrayContaining([
        "/admin/dashboard",
        "/admin/tenants",
        "/admin/access-requests",
        "/admin/admins",
        "/admin/roles",
        "/admin/entitlements",
        "/admin/audit-logs",
        "/admin/compliance",
        "/admin/support",
        "/admin/monitoring",
      ]),
    );
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByTestId("admin-scope")).toHaveTextContent("All tenants");
  });

  it("limits a support operator to tenants, logs, compliance and support", () => {
    session.useAdminSession.mockReturnValue(
      adminSessionFor(SUPPORT_OPERATOR_PERMISSIONS, {
        adminType: "support",
        scope: { type: "tenant", tenantId: "ten_A" },
      }),
    );
    render(<AdminShell>content</AdminShell>);
    const links = navLabels();
    expect(links).toEqual([
      "/admin/dashboard",
      "/admin/tenants",
      "/admin/audit-logs",
      "/admin/access-logs",
      "/admin/compliance",
      "/admin/support",
    ]);
    expect(screen.getByText("Support Operator")).toBeInTheDocument();
    expect(screen.getByTestId("admin-scope")).toHaveTextContent("Tenant ten_A");
  });

  it("gives an auditor the read-only views, including support diagnostics", () => {
    session.useAdminSession.mockReturnValue(
      adminSessionFor(AUDITOR_PERMISSIONS, { adminType: "auditor" }),
    );
    render(<AdminShell>content</AdminShell>);
    const links = navLabels();
    expect(links).toContain("/admin/audit-logs");
    expect(links).toContain("/admin/support");
    expect(links).toContain("/admin/access-requests");
    expect(links).toContain("/admin/entitlements");
    expect(links).toContain("/admin/monitoring");
    expect(screen.getByText("Auditor")).toBeInTheDocument();
  });

  it("gates the dashboard on iam.tenants.view and support on support.view (not legacy keys)", () => {
    session.useAdminSession.mockReturnValue(
      adminSessionFor(["monitoring.view", "support.lookup"], { adminType: "platform" }),
    );
    render(<AdminShell>content</AdminShell>);
    const links = navLabels();
    expect(links).not.toContain("/admin/dashboard");
    expect(links).not.toContain("/admin/support");
    expect(links).toContain("/admin/monitoring");
  });

  it("hides platform-wide pages from a tenant-scoped admin even when it holds the keys", () => {
    session.useAdminSession.mockReturnValue(
      adminSessionFor(PLATFORM_ADMIN_PERMISSIONS, {
        adminType: "platform",
        scope: { type: "tenant", tenantId: "ten_A" },
      }),
    );
    render(<AdminShell>content</AdminShell>);
    const links = navLabels();
    for (const platformOnly of [
      "/admin/access-requests",
      "/admin/admins",
      "/admin/roles",
      "/admin/plans",
      "/admin/monitoring",
    ]) {
      expect(links).not.toContain(platformOnly);
    }
    // Tenant data surfaces stay (the backend clamps them to the scope).
    expect(links).toEqual(
      expect.arrayContaining([
        "/admin/dashboard",
        "/admin/tenants",
        "/admin/subscriptions",
        "/admin/entitlements",
        "/admin/audit-logs",
        "/admin/compliance",
        "/admin/support",
      ]),
    );
    expect(screen.getByTestId("admin-scope")).toHaveTextContent("Tenant ten_A");
  });

  it("shows a platform admin plans, access requests and support diagnostics", () => {
    session.useAdminSession.mockReturnValue(
      adminSessionFor(PLATFORM_ADMIN_PERMISSIONS, { adminType: "platform" }),
    );
    render(<AdminShell>content</AdminShell>);
    const links = navLabels();
    expect(links).toContain("/admin/plans");
    expect(links).toContain("/admin/access-requests");
    expect(links).toContain("/admin/support");
  });
});
