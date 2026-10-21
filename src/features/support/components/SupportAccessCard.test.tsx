import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { WorkspaceSupportAccess } from "@/features/support/types";

const api = vi.hoisted(() => ({
  getWorkspaceSupportAccess: vi.fn(),
  listSupportActivity: vi.fn(),
  grantSupportAccess: vi.fn(),
  revokeSupportAccess: vi.fn(),
  endSupportSessionAsWorkspace: vi.fn(),
}));
vi.mock("@/features/support/api", () => ({
  supportAccessKeys: {
    all: ["workspace", "support-access"],
    activity: (q: unknown) => ["workspace", "support-access", "activity", q],
    current: ["support-session", "current"],
  },
  ...api,
}));
const supportState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/auth/supportSession", () => ({ useSupportSession: () => supportState.current }));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { useTenantSession } from "@/lib/auth/session";
import { SupportAccessCard } from "./SupportAccessCard";

function asUser(permissions: string[]) {
  vi.mocked(useTenantSession).mockReturnValue({
    status: "authenticated",
    me: { id: "usr_owner", email: "owner@acme.test", permissions },
    tenantSlug: "acme",
    permissions,
    hasPermission: (key: string) => permissions.includes(key),
    refetch: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  } as never);
}

const inOneHour = new Date(Date.now() + 3_600_000).toISOString();

function state(overrides: Partial<WorkspaceSupportAccess> = {}): WorkspaceSupportAccess {
  return { active: null, grants: [], sessions: [], maxHours: 72, ...overrides };
}

const consent = {
  id: "sag_1",
  tenantId: "ten_1",
  kind: "consent" as const,
  breakGlass: false,
  status: "active" as const,
  reason: "Ticket 4711",
  ticket: null,
  grantedBy: { id: "usr_owner", display: "owner@acme.test" },
  requestedBy: null,
  decidedBy: null,
  decidedAt: null,
  decisionReason: null,
  startsAt: new Date().toISOString(),
  expiresAt: inOneHour,
  revokedAt: null,
  revokedByType: null,
  revokedReason: null,
  createdAt: new Date().toISOString(),
};

const session = {
  id: "ses_1",
  tenantId: "ten_1",
  status: "active" as const,
  user: { id: "usr_owner", display: "owner@acme.test" },
  operator: { id: "adm_1", display: "Sam Support" },
  grantId: "sag_1",
  kind: "consent" as const,
  breakGlass: false,
  readOnly: true,
  reason: "Dashboard shows no data",
  ticket: "T-1",
  startedAt: new Date().toISOString(),
  expiresAt: inOneHour,
  endedAt: null,
  endedReason: null,
};

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SupportAccessCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  supportState.current = null;
  api.listSupportActivity.mockResolvedValue({
    data: [
      {
        id: "a1",
        occurredAt: new Date().toISOString(),
        module: "support.impersonation",
        action: "impersonate",
        result: "success",
        actor: { type: "admin", id: "adm_1", display: "Sam Support" },
        impersonatedBy: null,
        resource: { type: "user", id: "usr_owner" },
        reason: "Dashboard shows no data",
      },
    ],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
});

describe("SupportAccessCard", () => {
  it("is hidden behind settings.view", () => {
    asUser(["analytics.view"]);
    renderCard();
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
    expect(api.getWorkspaceSupportAccess).not.toHaveBeenCalled();
  });

  it("lets a settings.configure holder grant time-boxed access with a note", async () => {
    asUser(["settings.view", "settings.configure"]);
    api.getWorkspaceSupportAccess.mockResolvedValue(state());
    api.grantSupportAccess.mockResolvedValue({ ...consent });
    renderCard();

    expect(await screen.findByText("Support access is off")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Allow support for"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText(/note for support/i), {
      target: { value: "Ticket 4711" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Grant support access" }));
    await waitFor(() =>
      expect(api.grantSupportAccess).toHaveBeenCalledWith({
        durationHours: 24,
        note: "Ticket 4711",
      }),
    );
  });

  it("only offers windows up to the server's maximum", async () => {
    asUser(["settings.view", "settings.configure"]);
    api.getWorkspaceSupportAccess.mockResolvedValue(state({ maxHours: 24 }));
    renderCard();
    const select = await screen.findByLabelText("Allow support for");
    const values = within(select)
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(["1", "4", "24"]);
  });

  it("shows the active grant, the support sessions with their operator, and revokes", async () => {
    asUser(["settings.view", "settings.configure"]);
    api.getWorkspaceSupportAccess.mockResolvedValue(
      state({ active: consent, grants: [consent], sessions: [session] }),
    );
    api.revokeSupportAccess.mockResolvedValue({
      ...consent,
      status: "revoked",
      endedSessions: ["ses_1"],
    });
    api.endSupportSessionAsWorkspace.mockResolvedValue({ ...session, status: "ended" });
    renderCard();

    expect(await screen.findByText("Support access is on")).toBeInTheDocument();
    const sessions = screen.getByRole("region", { name: "Support sessions" });
    expect(within(sessions).getByText("Sam Support")).toBeInTheDocument();
    expect(within(sessions).getByText("Read-only")).toBeInTheDocument();
    expect(within(sessions).getByText(/Dashboard shows no data/)).toBeInTheDocument();
    expect(await screen.findByText("Support session started")).toBeInTheDocument();

    fireEvent.click(within(sessions).getByRole("button", { name: "End session" }));
    await waitFor(() => expect(api.endSupportSessionAsWorkspace).toHaveBeenCalledWith("ses_1"));

    fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
    await waitFor(() => expect(api.revokeSupportAccess).toHaveBeenCalledWith("sag_1"));
  });

  it("is read-only for members without settings.configure", async () => {
    asUser(["settings.view"]);
    api.getWorkspaceSupportAccess.mockResolvedValue(
      state({ active: consent, grants: [consent], sessions: [session] }),
    );
    renderCard();
    expect(await screen.findByText("Support access is on")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /grant support access/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke access" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End session" })).not.toBeInTheDocument();
    expect(screen.getByText(/ask a workspace owner or admin/i)).toBeInTheDocument();
  });

  it("cannot be changed from inside a support session", async () => {
    asUser(["settings.view", "settings.configure"]);
    supportState.current = { sessionId: "ses_1" };
    api.getWorkspaceSupportAccess.mockResolvedValue(state({ active: consent, grants: [consent] }));
    renderCard();
    expect(await screen.findByText("Support access is on")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /support access/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke access" })).not.toBeInTheDocument();
    expect(screen.getByText(/support sessions cannot change support access/i)).toBeInTheDocument();
  });

  it("shows the server's field error for an out-of-range window", async () => {
    asUser(["settings.view", "settings.configure"]);
    api.getWorkspaceSupportAccess.mockResolvedValue(state());
    api.grantSupportAccess.mockRejectedValue(
      new ApiError("durationHours must be an integer between 1 and 72", 400, "BAD_REQUEST", [
        { field: "durationHours", message: "must be between 1 and 72" },
      ]),
    );
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Grant support access" }));
    expect(await screen.findByText(/durationHours: must be between 1 and 72/)).toBeInTheDocument();
  });
});
