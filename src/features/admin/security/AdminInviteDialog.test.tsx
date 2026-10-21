import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const session = vi.hoisted(() => ({
  me: { id: "me1", email: "root@example.com", adminType: "super", mfaEnabled: true } as Record<
    string,
    unknown
  >,
  permissions: ["iam.admins.create"] as string[],
}));
const access = vi.hoisted(() => ({ inviteAdmin: vi.fn() }));
const security = vi.hoisted(() => ({ stepUpAdmin: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ useAdminSession: () => session }));
vi.mock("@/features/admin/api/adminAccess", () => access);
vi.mock("@/features/auth/api/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api/adminSecurity")>();
  return { ...actual, stepUpAdmin: security.stepUpAdmin };
});
vi.mock("sonner", () => ({ toast }));

import { AdminInviteButton } from "./AdminInviteDialog";

function renderButton() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminInviteButton />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session.permissions = ["iam.admins.create"];
  session.me = { id: "me1", email: "root@example.com", adminType: "super", mfaEnabled: true };
  security.stepUpAdmin.mockResolvedValue({ stepUpExpiresAt: new Date().toISOString() });
});

describe("AdminInviteButton", () => {
  it("is hidden without iam.admins.create", () => {
    session.permissions = ["iam.admins.view"];
    renderButton();
    expect(screen.queryByRole("button", { name: /invite admin/i })).not.toBeInTheDocument();
  });

  it("invites by email without any password field", async () => {
    const user = userEvent.setup();
    access.inviteAdmin.mockResolvedValue({ _id: "a2", email: "ops@example.com", delivered: true });
    renderButton();
    await user.click(screen.getByRole("button", { name: /invite admin/i }));
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/email/i), "ops@example.com");
    await user.click(screen.getByRole("radio", { name: /^platform/i }));
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    expect(access.inviteAdmin).toHaveBeenCalledWith({
      email: "ops@example.com",
      adminType: "platform",
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Invitation sent to ops@example.com"),
    );
  });

  it("inviting a super admin steps up first and submits once", async () => {
    const user = userEvent.setup();
    access.inviteAdmin
      .mockRejectedValueOnce(new ApiError("Confirm", 403, "STEP_UP_REQUIRED"))
      .mockResolvedValueOnce({ _id: "a3", email: "boss@example.com", delivered: false });
    renderButton();
    await user.click(screen.getByRole("button", { name: /invite admin/i }));
    await user.type(screen.getByLabelText(/email/i), "boss@example.com");
    await user.click(screen.getByRole("radio", { name: /^super/i }));
    await user.click(screen.getByRole("button", { name: /send invitation/i }));
    await user.type(await screen.findByLabelText(/^password$/i), "Password123!");
    await user.type(screen.getByLabelText(/authenticator code/i), "123456");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(access.inviteAdmin).toHaveBeenCalledTimes(2);
  });

  it("non-super admins are not offered the super type", async () => {
    const user = userEvent.setup();
    session.me = { id: "me1", email: "ops@example.com", adminType: "platform", mfaEnabled: true };
    renderButton();
    await user.click(screen.getByRole("button", { name: /invite admin/i }));
    expect(screen.queryByRole("radio", { name: /^super/i })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^support/i })).toBeChecked();
  });
});
