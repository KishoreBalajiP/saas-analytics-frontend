import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { formatCountdown } from "@/features/support/lib/countdown";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const support = vi.hoisted(() => ({
  current: null as unknown,
  endSupportSession: vi.fn(async () => undefined),
  consumeSupportExit: vi.fn(() => true),
}));
vi.mock("@/lib/auth/supportSession", () => ({
  useSupportSession: () => support.current,
  endSupportSession: support.endSupportSession,
  consumeSupportExit: support.consumeSupportExit,
}));

const api = vi.hoisted(() => ({ getCurrentSupportSession: vi.fn() }));
vi.mock("@/features/support/api", () => ({
  supportAccessKeys: { current: ["support-session", "current"] },
  getCurrentSupportSession: api.getCurrentSupportSession,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { SupportSessionBanner } from "./SupportSessionBanner";

function local(expiresInSeconds: number, overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "ses_1",
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    breakGlass: false,
    user: { id: "usr_1", email: "user@acme.test", tenantId: "ten_1" },
    operator: { email: "operator@platform.test" },
    ...overrides,
  };
}

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SupportSessionBanner />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  support.current = null;
});

describe("formatCountdown", () => {
  it("formats minutes and hours and never goes negative", () => {
    expect(formatCountdown(65)).toBe("01:05");
    expect(formatCountdown(3725)).toBe("1:02:05");
    expect(formatCountdown(-4)).toBe("00:00");
  });
});

describe("SupportSessionBanner", () => {
  it("renders nothing outside a support session", () => {
    renderBanner();
    expect(screen.queryByRole("status", { name: "Support session" })).not.toBeInTheDocument();
    expect(api.getCurrentSupportSession).not.toHaveBeenCalled();
  });

  it("shows the operator, the impersonated user, read-only and a countdown", async () => {
    const at = new Date(Date.now() + 10 * 60_000).toISOString();
    support.current = local(600);
    api.getCurrentSupportSession.mockResolvedValue({
      active: true,
      sessionId: "ses_1",
      readOnly: true,
      breakGlass: true,
      operator: { id: "adm_1", display: "Sam Support" },
      user: { id: "usr_1", display: "user@acme.test" },
      expiresAt: at,
    });
    renderBanner();
    const banner = screen.getByRole("status", { name: "Support session" });
    expect(banner).toHaveTextContent("Read-only");
    expect(banner).toHaveTextContent("user@acme.test");
    expect(await screen.findByText(/Sam Support is viewing this workspace/)).toBeInTheDocument();
    expect(screen.getByText("Break-glass")).toBeInTheDocument();
    expect(screen.getByLabelText("Time remaining")).toHaveTextContent(/Ends in (10:00|09:5\d)/);
  });

  it("ends the session from the banner and returns to the admin console", async () => {
    support.current = local(600);
    api.getCurrentSupportSession.mockResolvedValue({ active: true, sessionId: "ses_1" });
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: /end support session/i }));
    await waitFor(() => expect(support.endSupportSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin/support" }));
  });

  it("ends by itself when the countdown reaches zero", async () => {
    support.current = local(-1);
    api.getCurrentSupportSession.mockResolvedValue({ active: true, sessionId: "ses_1" });
    renderBanner();
    await waitFor(() => expect(support.endSupportSession).toHaveBeenCalled());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/admin/support" }));
  });

  it("ends when the workspace revoked the session on the server", async () => {
    support.current = local(600);
    api.getCurrentSupportSession.mockRejectedValue(
      new ApiError("Session is no longer active", 401),
    );
    renderBanner();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await waitFor(() => expect(support.endSupportSession).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith({ to: "/admin/support" });
  });
});
