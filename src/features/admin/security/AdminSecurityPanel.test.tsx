import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const navigate = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({
  me: null as Record<string, unknown> | null,
  refetch: vi.fn(),
}));
const security = vi.hoisted(() => ({
  stepUpAdmin: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  disableAdminMfa: vi.fn(),
  forgotAdminPassword: vi.fn(),
}));
const authApi = vi.hoisted(() => ({ enrollMfa: vi.fn(), verifyMfa: vi.fn() }));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("@/lib/auth/session", () => ({ useAdminSession: () => session }));
vi.mock("@/features/auth/api/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api/adminSecurity")>();
  return { ...actual, ...security };
});
vi.mock("@/features/auth/api", () => authApi);
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { AdminSecurityPanel } from "./AdminSecurityPanel";

function renderPanel(ui: ReactNode = <AdminSecurityPanel />) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const enabledMe = {
  id: "a1",
  email: "root@example.com",
  mfaEnabled: true,
  mfaRequired: true,
  recoveryCodesRemaining: 2,
  recoveryCodesGeneratedAt: "2026-10-01T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  session.me = { ...enabledMe };
  security.stepUpAdmin.mockResolvedValue({ stepUpExpiresAt: new Date().toISOString() });
});

describe("AdminSecurityPanel", () => {
  it("shows MFA status, warns about few recovery codes and regenerates them after a step-up", async () => {
    const user = userEvent.setup();
    const fresh = Array.from(
      { length: 10 },
      (_, i) => `NEWC-ODES-XXXX-YY${String.fromCharCode(65 + i)}2`,
    );
    security.regenerateRecoveryCodes
      .mockRejectedValueOnce(new ApiError("Confirm", 403, "STEP_UP_REQUIRED"))
      .mockResolvedValueOnce({
        recoveryCodes: fresh,
        recoveryCodesRemaining: 10,
        generatedAt: "x",
      });
    renderPanel();

    expect(screen.getByText(/required for your admin role/i)).toBeVisible();
    expect(screen.getByText(/2 unused recovery codes/i)).toBeVisible();
    expect(screen.getByText(/few recovery codes left/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /generate new recovery codes/i }));
    await user.type(await screen.findByLabelText(/^password$/i), "Password123!");
    await user.type(screen.getByLabelText(/authenticator code/i), "123456");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    const list = await screen.findByRole("list", { name: /recovery codes/i });
    expect(list.querySelectorAll("li")).toHaveLength(10);
    expect(security.regenerateRecoveryCodes).toHaveBeenCalledTimes(2);
    await user.click(screen.getByLabelText(/i have saved these recovery codes/i));
    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(session.refetch).toHaveBeenCalled();
  });

  it("turning MFA off needs the password and a code; a privileged admin is sent to MFA setup", async () => {
    const user = userEvent.setup();
    security.disableAdminMfa.mockResolvedValue({ enabled: false, enrollmentRequired: true });
    renderPanel();
    await user.click(screen.getByRole("button", { name: /turn off mfa/i }));
    await user.type(await screen.findByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /use a recovery code instead/i }));
    await user.type(screen.getByLabelText(/recovery code/i), "ABCD-EFGH-JKMN-PQRS");
    await user.click(screen.getAllByRole("button", { name: /^turn off mfa$/i }).at(-1)!);
    expect(security.disableAdminMfa).toHaveBeenCalledWith("Password123!", {
      recoveryCode: "ABCD-EFGH-JKMN-PQRS",
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin/mfa-setup" }));
  });

  it("offers enrolment when MFA is off", () => {
    session.me = { id: "a1", email: "support@example.com", mfaEnabled: false, mfaRequired: false };
    renderPanel();
    expect(screen.getByText(/recommended for every administrator/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /set up authenticator/i })).toBeVisible();
  });

  it("emails the signed-in admin a password reset link", async () => {
    const user = userEvent.setup();
    security.forgotAdminPassword.mockResolvedValue({ ok: true });
    renderPanel();
    await user.click(screen.getByRole("button", { name: /email me a reset link/i }));
    expect(security.forgotAdminPassword).toHaveBeenCalledWith("root@example.com");
  });
});
