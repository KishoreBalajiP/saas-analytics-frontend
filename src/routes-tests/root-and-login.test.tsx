import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  status: "loading" as "loading" | "authenticated" | "anonymous",
  restoreError: null as "cookies_blocked" | null,
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
    expect(screen.getByText("MongoDB")).toBeVisible();
    expect(screen.getByRole("heading", { name: /ai-assisted questions/i })).toBeVisible();
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

  it("prefills the workspace slug handed over in the address", async () => {
    window.history.replaceState({}, "", "/login?workspace=owner-workspace");
    renderWithQuery(<TenantLoginPage />);
    expect(await screen.findByDisplayValue("owner-workspace")).toBeVisible();
    window.history.replaceState({}, "", "/login");
  });

  it("explains when the browser blocked the sign-in cookie", () => {
    session.status = "anonymous";
    session.restoreError = "cookies_blocked";
    renderWithQuery(<TenantLoginPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/blocked the sign-in cookie/i);
    session.restoreError = null;
  });

  it("shows no cookie warning for an ordinary visit", () => {
    session.status = "anonymous";
    renderWithQuery(<TenantLoginPage />);
    expect(screen.queryByText(/blocked the sign-in cookie/i)).not.toBeInTheDocument();
  });

  it("keeps the password visibility control inside the field and accessible", () => {
    renderWithQuery(<TenantLoginPage />);
    const password = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(password).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("type", "button");
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeVisible();
  });

  // onboarding: the last workspace is remembered, with a way to switch.
  it("prefills the remembered workspace and can forget it", async () => {
    window.localStorage.setItem("saas.tenantSlug", "remembered-co");
    renderWithQuery(<TenantLoginPage />);
    expect(await screen.findByDisplayValue("remembered-co")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /use a different workspace/i }));
    expect(screen.getByLabelText(/workspace slug/i)).toHaveValue("");
    expect(window.localStorage.getItem("saas.tenantSlug")).toBeNull();
  });

  it("ignores a malformed workspace slug in the address", () => {
    window.history.replaceState({}, "", "/login?workspace=Not%20A%20Slug");
    renderWithQuery(<TenantLoginPage />);
    expect(screen.getByLabelText(/workspace slug/i)).toHaveValue("");
    window.history.replaceState({}, "", "/login");
  });
});
