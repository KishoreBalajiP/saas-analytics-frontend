import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({
  status: "authenticated" as "loading" | "authenticated" | "anonymous",
  me: null as Record<string, unknown> | null,
  permissions: [] as string[],
  signOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return { ...actual, useNavigate: () => navigate, useRouterState: () => "/admin/dashboard" };
});
vi.mock("@/lib/auth/session", () => ({ useAdminSession: () => session }));
vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { AdminShell } from "./AdminShell";

beforeEach(() => {
  vi.clearAllMocks();
  session.status = "authenticated";
});

describe("AdminShell (adminauth)", () => {
  it("keeps an enrolment-only session out of the portal and sends it to MFA setup", () => {
    session.me = { id: "a1", email: "root@example.com", mfaEnrollmentRequired: true };
    render(
      <AdminShell>
        <p>secret admin page</p>
      </AdminShell>,
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/admin/mfa-setup" });
    expect(screen.queryByText("secret admin page")).not.toBeInTheDocument();
  });

  it("renders the page for a normal session", () => {
    session.me = { id: "a1", email: "root@example.com", mfaEnrollmentRequired: false };
    render(
      <AdminShell>
        <p>admin page</p>
      </AdminShell>,
    );
    expect(screen.getByText("admin page")).toBeVisible();
    expect(navigate).not.toHaveBeenCalled();
  });
});
