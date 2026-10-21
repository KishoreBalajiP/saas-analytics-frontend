import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("@/features/workspace-settings/api", () => ({
  workspaceSettingsKey: ["workspace", "settings"],
  get: (...args: unknown[]) => api.get(...args),
  update: (...args: unknown[]) => api.update(...args),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useTenantSession } from "@/lib/auth/session";
import { WorkspaceTimezoneCard } from "./WorkspaceTimezoneCard";

const mockedSession = vi.mocked(useTenantSession);

function asUser(permissions: string[]) {
  mockedSession.mockReturnValue({
    status: "authenticated",
    me: { id: "u1", email: "u@example.com", permissions },
    tenantSlug: "acme",
    permissions,
    hasPermission: (key: string) => permissions.includes(key),
    refetch: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  } as never);
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceTimezoneCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ timezone: "UTC" });
});

describe("WorkspaceTimezoneCard", () => {
  it("is hidden behind settings.view", () => {
    asUser(["analytics.view"]);
    renderCard();
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("shows the current zone and saves a new one", async () => {
    asUser(["settings.view", "settings.update"]);
    api.update.mockResolvedValue({ timezone: "Asia/Kolkata" });
    renderCard();
    const input = await screen.findByLabelText("Workspace time zone");
    expect(input).toHaveValue("UTC");
    fireEvent.change(input, { target: { value: "Asia/Kolkata" } });
    fireEvent.click(screen.getByRole("button", { name: /save time zone/i }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ timezone: "Asia/Kolkata" }));
  });

  it("shows the server's field error for an unknown zone", async () => {
    asUser(["settings.view", "settings.update"]);
    api.update.mockRejectedValue(
      new ApiError("Invalid workspace settings", 400, "BAD_REQUEST", [
        { field: "timezone", message: "must be an IANA time zone name" },
      ]),
    );
    renderCard();
    const input = await screen.findByLabelText("Workspace time zone");
    fireEvent.change(input, { target: { value: "Mars/Base" } });
    fireEvent.click(screen.getByRole("button", { name: /save time zone/i }));
    expect(await screen.findByText(/timezone: must be an IANA time zone name/)).toBeInTheDocument();
  });

  it("is read-only without settings.update", async () => {
    asUser(["settings.view"]);
    renderCard();
    const input = await screen.findByLabelText("Workspace time zone");
    expect(input).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save time zone/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ask a workspace admin/i)).toBeInTheDocument();
  });
});
