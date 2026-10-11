import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  status: "loading" as "loading" | "authenticated" | "anonymous",
}));
const navigate = vi.hoisted(() => vi.fn());

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
  AppLink: ({ children, ...props }: { children: React.ReactNode; to?: string }) => (
    <a href={props.to}>{children}</a>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button {...props}>{children}</button>,
}));

import { HomePage } from "@/routes/index";
import { TenantLoginPage } from "@/routes/login.index";

function renderWithQuery(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

describe("public homepage", () => {
  beforeEach(() => {
    session.status = "loading";
  });

  it("renders immediately without a session restoration screen", () => {
    renderWithQuery(<HomePage />);
    expect(screen.getByRole("heading", { name: /turn your data into decisions/i })).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: /get started/i })
        .every((link) => link.getAttribute("href") === "/register"),
    ).toBe(true);
    expect(screen.queryByText(/restoring your session/i)).not.toBeInTheDocument();
  });

  it("keeps the homepage available to authenticated visitors", () => {
    session.status = "authenticated";
    renderWithQuery(<HomePage />);
    expect(screen.getAllByRole("link", { name: /open dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /turn your data into decisions/i })).toBeVisible();
  });
});

describe("tenant login entry", () => {
  it("keeps existing sign-in available and points new visitors to registration", () => {
    renderWithQuery(<TenantLoginPage />);
    expect(screen.getByRole("link", { name: /create a workspace/i })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.queryByText(/admin sign in/i)).not.toBeInTheDocument();
  });
});
