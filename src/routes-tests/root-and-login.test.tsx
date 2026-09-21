import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({
  status: "loading" as "loading" | "authenticated" | "anonymous",
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/lib/auth/session", () => ({
  TenantSessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTenantSession: () => session,
}));

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/common/states", () => ({
  InlineFieldErrors: () => null,
}));

vi.mock("@/features/auth/api", () => ({
  loginTenant: vi.fn(),
  tenantMe: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {},
}));

import { RootEntry } from "@/routes/index";
import { TenantLoginPage } from "@/routes/login.index";

function renderLogin() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TenantLoginPage />
    </QueryClientProvider>,
  );
}

describe("root authentication entry", () => {
  beforeEach(() => {
    navigate.mockReset();
    session.status = "loading";
  });

  it("waits for session hydration before navigating", () => {
    render(<RootEntry />);

    expect(screen.getByText("Restoring your sessionâ€¦")).toBeVisible();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("sends anonymous users directly to login", async () => {
    session.status = "anonymous";
    render(<RootEntry />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/login", replace: true }));
  });

  it("sends authenticated users to dashboard", async () => {
    session.status = "authenticated";
    render(<RootEntry />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true }));
  });
});

describe("tenant login entry", () => {
  it("explains the invite-only account flow", () => {
    renderLogin();

    expect(
      screen.getByText(
        "Don't have an account? Contact your workspace administrator for an invitation.",
      ),
    ).toBeVisible();
  });
});
