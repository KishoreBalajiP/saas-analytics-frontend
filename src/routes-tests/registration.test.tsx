import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LEGAL_DOCUMENT_VERSION } from "@/content/legal/version";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authApi = vi.hoisted(() => ({ registerWorkspace: vi.fn(), verifyEmail: vi.fn() }));

vi.mock("@/features/auth/api", () => authApi);
vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { RegistrationPage } from "@/routes/register";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RegistrationPage />
    </QueryClientProvider>,
  );
}

describe("self-service registration and email verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/register");
  });

  it("consumes the emailed verification token and shows the workspace slug", async () => {
    authApi.verifyEmail.mockResolvedValue({
      ok: true,
      verified: true,
      email: "owner@example.test",
      tenant: {
        id: "tenant-1",
        name: "Owner Workspace",
        slug: "owner-workspace",
        status: "active",
        onboardingStatus: "ready",
      },
    });
    window.history.replaceState({}, "", "/register?token=single-use-token-value");

    renderPage();

    expect(await screen.findByText("Workspace activated")).toBeVisible();
    expect(authApi.verifyEmail.mock.calls[0]?.[0]).toBe("single-use-token-value");
    expect(screen.getAllByText("owner-workspace").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /continue to sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows an actionable failure state for an expired or replayed token", async () => {
    authApi.verifyEmail.mockRejectedValue(
      new Error("Verification link is invalid, expired, or already used"),
    );
    window.history.replaceState({}, "", "/register?token=expired-token-value");

    renderPage();

    expect(await screen.findByText("Verification could not be completed")).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/login");
  });

  it("only confirms registration when the backend reports email delivery", async () => {
    authApi.registerWorkspace.mockResolvedValue({
      ok: true,
      email: "owner@example.test",
      verificationSent: true,
      tenant: {
        id: "tenant-1",
        name: "Owner Workspace",
        slug: "owner-workspace",
        status: "pending",
        onboardingStatus: "not_started",
      },
      owner: { id: "owner-1", name: "Workspace Owner" },
    });
    const user = userEvent.setup();

    renderPage();
    await user.type(screen.getByLabelText("Full name"), "Workspace Owner");
    await user.type(screen.getByLabelText("Work email"), "owner@example.test");
    await user.type(screen.getByLabelText("Workspace name"), "Owner Workspace");
    await user.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await user.click(screen.getByLabelText(/I accept the/)); // onboarding: consent
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => expect(authApi.registerWorkspace).toHaveBeenCalled());
    expect(authApi.registerWorkspace.mock.calls[0]?.[0]).toMatchObject({
      acceptTerms: true,
      termsVersion: LEGAL_DOCUMENT_VERSION,
    });
    expect(await screen.findByText(/pending email verification/i)).toBeVisible();
    expect(screen.queryByText(/check your inbox/i)).not.toBeInTheDocument();
  });

  it("says plainly when the verification email could not be sent", async () => {
    authApi.registerWorkspace.mockResolvedValue({
      ok: true,
      email: "owner@example.test",
      verificationSent: false,
      tenant: {
        id: "tenant-1",
        name: "Owner Workspace",
        slug: "owner-workspace",
        status: "pending",
        onboardingStatus: "not_started",
      },
      owner: { id: "owner-1", name: "Workspace Owner" },
    });
    const user = userEvent.setup();

    renderPage();
    await user.type(screen.getByLabelText("Full name"), "Workspace Owner");
    await user.type(screen.getByLabelText("Work email"), "owner@example.test");
    await user.type(screen.getByLabelText("Workspace name"), "Owner Workspace");
    await user.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await user.click(screen.getByLabelText(/I accept the/)); // onboarding: consent
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(await screen.findByText(/could not send the confirmation email/i)).toBeVisible();
    expect(screen.queryByText(/we sent a confirmation link/i)).not.toBeInTheDocument();
    expect(screen.getByText("owner-workspace")).toBeVisible();
  });

  // onboarding: consent is required and linked.
  it("does not submit without accepting the terms, and links the legal documents", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Full name"), "Workspace Owner");
    await user.type(screen.getByLabelText("Work email"), "owner@example.test");
    await user.type(screen.getByLabelText("Workspace name"), "Owner Workspace");
    await user.type(screen.getByLabelText("Password"), "StrongPassword123!");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(authApi.registerWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
