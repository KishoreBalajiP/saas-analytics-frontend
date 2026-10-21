import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { PlatformAdmin } from "@/lib/api/types";

const session = vi.hoisted(() => ({
  me: { id: "me1", email: "root@example.com", adminType: "super", mfaEnabled: true } as Record<
    string,
    unknown
  >,
  permissions: [] as string[],
}));
const access = vi.hoisted(() => ({
  resendAdminInvitation: vi.fn(),
  revokeAdminInvitation: vi.fn(),
  resetAdminMfaFor: vi.fn(),
  resetAdminPasswordFor: vi.fn(),
}));
const security = vi.hoisted(() => ({ stepUpAdmin: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ useAdminSession: () => session }));
vi.mock("@/features/admin/api/adminAccess", () => access);
vi.mock("@/features/auth/api/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api/adminSecurity")>();
  return { ...actual, stepUpAdmin: security.stepUpAdmin };
});
vi.mock("sonner", () => ({ toast }));

import { AdminAccessActions } from "./AdminAccessActions";

const ALL = ["iam.admins.view", "iam.admins.create", "iam.admins.delete", "iam.admins.configure"];

function renderActions(admin: Partial<PlatformAdmin>, isSelf = false) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminAccessActions
        admin={
          {
            _id: "a2",
            email: "ops@example.com",
            adminType: "platform_admin",
            ...admin,
          } as PlatformAdmin
        }
        isSelf={isSelf}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session.permissions = [...ALL];
  session.me = { id: "me1", email: "root@example.com", adminType: "super", mfaEnabled: true };
  security.stepUpAdmin.mockResolvedValue({ stepUpExpiresAt: new Date().toISOString() });
});

describe("AdminAccessActions", () => {
  it("offers resend and revoke for a pending invitation", async () => {
    const user = userEvent.setup();
    access.resendAdminInvitation.mockResolvedValue({ delivered: true, invitation: {} });
    renderActions({ status: "pending" });
    expect(screen.queryByRole("button", { name: /reset mfa/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /resend invite/i }));
    expect(access.resendAdminInvitation).toHaveBeenCalledWith("a2");
    await user.click(screen.getByRole("button", { name: /revoke invite/i }));
    expect(access.revokeAdminInvitation).toHaveBeenCalledWith("a2");
  });

  it("explains the resend cooldown", async () => {
    const user = userEvent.setup();
    access.resendAdminInvitation.mockRejectedValue(new ApiError("Too soon", 429, "RATE_LIMITED"));
    renderActions({ status: "pending" });
    await user.click(screen.getByRole("button", { name: /resend invite/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/wait a moment/i)),
    );
  });

  it("hides credential resets for oneself and for non-super admins", () => {
    const { unmount } = renderActions({ status: "active" }, true);
    expect(screen.queryByRole("button", { name: /reset mfa/i })).not.toBeInTheDocument();
    unmount();
    session.me = { id: "me1", email: "ops@example.com", adminType: "platform", mfaEnabled: true };
    renderActions({ status: "active" });
    expect(screen.queryByRole("button", { name: /reset mfa/i })).not.toBeInTheDocument();
  });

  it("hides actions the admin lacks permissions for", () => {
    session.permissions = ["iam.admins.view"];
    renderActions({ status: "pending" });
    expect(screen.queryByRole("button", { name: /resend invite/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke invite/i })).not.toBeInTheDocument();
  });

  it("resets another admin's MFA with a reason, stepping up when the server asks", async () => {
    const user = userEvent.setup();
    access.resetAdminMfaFor
      .mockRejectedValueOnce(new ApiError("Confirm", 403, "STEP_UP_REQUIRED"))
      .mockResolvedValueOnce({ admin: {}, sessionsRevoked: 1, mfaEnrollmentRequired: true });
    renderActions({ status: "active" });

    await user.click(screen.getByRole("button", { name: /reset mfa/i }));
    const confirm = await screen.findByRole("button", { name: /^reset mfa$/i, hidden: false });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/reason/i), "lost phone");
    await user.click(screen.getAllByRole("button", { name: /^reset mfa$/i }).at(-1)!);

    // The server asked for a step-up: confirm identity, then the reset is retried.
    await user.type(await screen.findByLabelText(/^password$/i), "Password123!");
    await user.type(screen.getByLabelText(/authenticator code/i), "123456");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(access.resetAdminMfaFor).toHaveBeenCalledTimes(2));
    expect(access.resetAdminMfaFor).toHaveBeenLastCalledWith("a2", "lost phone");
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/must enrol again/i)),
    );
  });
});
