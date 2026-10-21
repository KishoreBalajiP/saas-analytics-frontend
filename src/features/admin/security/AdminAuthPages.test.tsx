import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const navigate = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({
  status: "anonymous" as "loading" | "authenticated" | "anonymous",
  me: null as Record<string, unknown> | null,
  restoreError: null,
  setSession: vi.fn(),
  refetch: vi.fn(),
  signOut: vi.fn(),
}));
const security = vi.hoisted(() => ({
  previewAdminInvitation: vi.fn(),
  acceptAdminInvitation: vi.fn(),
  resetAdminPassword: vi.fn(),
  forgotAdminPassword: vi.fn(),
}));
const authApi = vi.hoisted(() => ({
  loginAdmin: vi.fn(),
  adminMe: vi.fn(),
  enrollMfa: vi.fn(),
  verifyMfa: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({
    children,
    to,
    className,
  }: {
    children: ReactNode;
    to?: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/auth/session", () => ({ useAdminSession: () => session }));
vi.mock("@/features/auth/api/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api/adminSecurity")>();
  return { ...actual, ...security };
});
vi.mock("@/features/auth/api", () => authApi);
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { AdminAcceptInvitePage } from "./AdminAcceptInvitePage";
import { AdminForgotPasswordPage } from "./AdminForgotPasswordPage";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminMfaSetupPage } from "./AdminMfaSetupPage";
import { AdminResetPasswordPage } from "./AdminResetPasswordPage";

function renderPage(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const TOKEN = "t".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  session.status = "anonymous";
  session.me = null;
});

describe("admin invitation acceptance page", () => {
  beforeEach(() => {
    security.previewAdminInvitation.mockResolvedValue({
      email: "ops@example.com",
      name: "Ops Person",
      adminType: "platform",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      mfaRequired: true,
    });
  });

  it("shows the invitation, sets the password and continues to MFA setup for a privileged role", async () => {
    const user = userEvent.setup();
    security.acceptAdminInvitation.mockResolvedValue({
      accessToken: "tok",
      expiresIn: 900,
      mfaEnrollmentRequired: true,
    });
    renderPage(<AdminAcceptInvitePage token={TOKEN} />);

    expect(await screen.findByText(/ops@example.com · platform administrator/i)).toBeVisible();
    expect(screen.getByText(/requires multi-factor authentication/i)).toBeVisible();
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Ops Person");
    expect(security.previewAdminInvitation).toHaveBeenCalledWith(TOKEN);

    const submit = screen.getByRole("button", { name: /accept and continue/i });
    await user.type(screen.getByLabelText(/^new password$/i), "BrandNew9!");
    await user.type(screen.getByLabelText(/confirm password/i), "BrandNew8!");
    expect(screen.getByText(/passwords do not match/i)).toBeVisible();
    expect(submit).toBeDisabled();
    await user.clear(screen.getByLabelText(/confirm password/i));
    await user.type(screen.getByLabelText(/confirm password/i), "BrandNew9!");
    await user.click(submit);

    expect(security.acceptAdminInvitation).toHaveBeenCalledWith({
      token: TOKEN,
      password: "BrandNew9!",
      name: "Ops Person",
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin/mfa-setup" }));
  });

  it("goes straight to the dashboard when no MFA enrolment is required", async () => {
    const user = userEvent.setup();
    security.acceptAdminInvitation.mockResolvedValue({ accessToken: "tok", expiresIn: 900 });
    renderPage(<AdminAcceptInvitePage token={TOKEN} />);
    await user.type(await screen.findByLabelText(/^new password$/i), "BrandNew9!");
    await user.type(screen.getByLabelText(/confirm password/i), "BrandNew9!");
    await user.click(screen.getByRole("button", { name: /accept and continue/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin/dashboard" }));
  });

  it("explains an invalid or expired invitation", async () => {
    security.previewAdminInvitation.mockRejectedValueOnce(
      new ApiError("Invitation link is invalid or has expired", 400),
    );
    renderPage(<AdminAcceptInvitePage token={TOKEN} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid, expired or already used/i);
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
  });

  it("refuses a link without a token without calling the API", () => {
    renderPage(<AdminAcceptInvitePage token="" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid, expired or already used/i);
    expect(security.previewAdminInvitation).not.toHaveBeenCalled();
  });
});

describe("admin password reset page", () => {
  it("posts the token and new password, then returns to the admin sign-in", async () => {
    const user = userEvent.setup();
    security.resetAdminPassword.mockResolvedValue({ ok: true });
    renderPage(<AdminResetPasswordPage token={TOKEN} />);
    const submit = screen.getByRole("button", { name: /update password/i });
    await user.type(screen.getByLabelText(/^new password$/i), "short");
    expect(submit).toBeDisabled();
    await user.clear(screen.getByLabelText(/^new password$/i));
    await user.type(screen.getByLabelText(/^new password$/i), "BrandNew9!");
    await user.type(screen.getByLabelText(/confirm password/i), "BrandNew9!");
    await user.click(submit);
    expect(security.resetAdminPassword).toHaveBeenCalledWith(TOKEN, "BrandNew9!");
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin/login" }));
  });

  it("shows the server error for a used or expired link", async () => {
    const user = userEvent.setup();
    security.resetAdminPassword.mockRejectedValueOnce(
      new ApiError("Password reset link is invalid or has expired", 400),
    );
    renderPage(<AdminResetPasswordPage token={TOKEN} />);
    await user.type(screen.getByLabelText(/^new password$/i), "BrandNew9!");
    await user.type(screen.getByLabelText(/confirm password/i), "BrandNew9!");
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers a new link when the token is missing", () => {
    renderPage(<AdminResetPasswordPage token="" />);
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute(
      "href",
      "/admin/forgot-password",
    );
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });
});

describe("admin forgot-password page", () => {
  it("requests a link and answers generically", async () => {
    const user = userEvent.setup();
    security.forgotAdminPassword.mockResolvedValue({ ok: true });
    renderPage(<AdminForgotPasswordPage />);
    await user.type(screen.getByLabelText(/email/i), "ops@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(security.forgotAdminPassword).toHaveBeenCalledWith("ops@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent(/if an admin account exists/i);
  });
});

describe("admin sign-in page", () => {
  it("links to the admin forgot-password page", () => {
    renderPage(<AdminLoginPage />);
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute(
      "href",
      "/admin/forgot-password",
    );
  });

  it("asks for a second factor and accepts a recovery code instead", async () => {
    const user = userEvent.setup();
    authApi.loginAdmin
      .mockRejectedValueOnce(new ApiError("MFA verification code is required", 401, "MFA_REQUIRED"))
      .mockResolvedValueOnce({ accessToken: "tok", expiresIn: 900, recoveryCodesRemaining: 4 });
    authApi.adminMe.mockResolvedValue({ id: "a1", email: "ops@example.com" });
    renderPage(<AdminLoginPage />);
    await user.type(screen.getByLabelText(/email/i), "ops@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByLabelText(/authenticator code/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /use a recovery code instead/i }));
    await user.type(screen.getByLabelText(/recovery code/i), "abcd-efgh-jkmn-pqrs");
    await user.click(screen.getByRole("button", { name: /verify and sign in/i }));
    expect(authApi.loginAdmin).toHaveBeenLastCalledWith({
      email: "ops@example.com",
      password: "Password123!",
      recoveryCode: "abcd-efgh-jkmn-pqrs",
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin/dashboard" }));
  });

  it("sends a privileged admin without MFA to MFA setup", async () => {
    const user = userEvent.setup();
    authApi.loginAdmin.mockResolvedValue({
      accessToken: "tok",
      expiresIn: 900,
      mfaEnrollmentRequired: true,
    });
    authApi.adminMe.mockResolvedValue({
      id: "a1",
      email: "ops@example.com",
      mfaEnrollmentRequired: true,
    });
    renderPage(<AdminLoginPage />);
    await user.type(screen.getByLabelText(/email/i), "ops@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin/mfa-setup" }));
    expect(navigate).not.toHaveBeenCalledWith({ to: "/admin/dashboard" });
  });

  it("an already restricted session is routed to MFA setup on load", () => {
    session.status = "authenticated";
    session.me = { id: "a1", email: "ops@example.com", mfaEnrollmentRequired: true };
    renderPage(<AdminLoginPage />);
    expect(navigate).toHaveBeenCalledWith({ to: "/admin/mfa-setup" });
  });
});

describe("admin MFA setup page", () => {
  it("sends anonymous visitors to the admin sign-in", () => {
    renderPage(<AdminMfaSetupPage />);
    expect(navigate).toHaveBeenCalledWith({ to: "/admin/login" });
  });

  it("explains that the role requires MFA and starts enrolment", async () => {
    session.status = "authenticated";
    session.me = {
      id: "a1",
      email: "ops@example.com",
      mfaEnabled: false,
      mfaEnrollmentRequired: true,
    };
    renderPage(<AdminMfaSetupPage />);
    expect(screen.getByText(/your admin role requires multi-factor authentication/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /set up authenticator/i })).toBeVisible();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("leaves for the dashboard once MFA is on", () => {
    session.status = "authenticated";
    session.me = {
      id: "a1",
      email: "ops@example.com",
      mfaEnabled: true,
      mfaEnrollmentRequired: false,
    };
    renderPage(<AdminMfaSetupPage />);
    expect(navigate).toHaveBeenCalledWith({ to: "/admin/dashboard" });
  });
});
