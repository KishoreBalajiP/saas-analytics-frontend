import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    await waitFor(() => expect(authApi.registerWorkspace).toHaveBeenCalled());
    expect(await screen.findByText(/pending email verification/i)).toBeVisible();
    expect(screen.queryByText(/check your inbox/i)).not.toBeInTheDocument();
  });
});
