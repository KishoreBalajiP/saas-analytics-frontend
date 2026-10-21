import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  transferOwnership: vi.fn(),
  getDeletionContext: vi.fn(),
  requestDeletion: vi.fn(),
}));
vi.mock("@/features/members/api", () => ({
  membersKeys: {
    all: ["workspace", "members"],
    members: (p: unknown) => ["workspace", "members", "list", p],
    deletion: ["workspace", "members", "deletion"],
  },
  listMembers: (...a: unknown[]) => api.listMembers(...a),
  transferOwnership: (...a: unknown[]) => api.transferOwnership(...a),
  getDeletionContext: (...a: unknown[]) => api.getDeletionContext(...a),
  requestDeletion: (...a: unknown[]) => api.requestDeletion(...a),
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { useTenantSession } from "@/lib/auth/session";
import { DangerZone } from "./DangerZone";

const signOut = vi.fn();
const refetch = vi.fn();

function asUser(permissions: string[]) {
  vi.mocked(useTenantSession).mockReturnValue({
    status: "authenticated",
    me: { id: "owner-1", email: "owner@example.com", permissions },
    tenantSlug: "acme",
    permissions,
    hasPermission: (key: string) => permissions.includes(key),
    refetch,
    setSession: vi.fn(),
    signOut,
  } as never);
}

function renderZone() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DangerZone />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue(undefined);
  refetch.mockResolvedValue(undefined);
  api.listMembers.mockResolvedValue({
    data: [
      {
        id: "owner-1",
        email: "owner@example.com",
        name: "Olive Owner",
        status: "active",
        roles: [],
        isOwner: true,
        isPrimaryOwner: true,
      },
      {
        id: "admin-1",
        email: "adam@example.com",
        name: "Adam Admin",
        status: "active",
        roles: [],
        isOwner: false,
        isPrimaryOwner: false,
      },
    ],
    meta: { page: 1, limit: 100, total: 2, pages: 1 },
  });
  api.getDeletionContext.mockResolvedValue({
    workspace: { id: "t1", name: "Acme", slug: "acme-co", status: "active" },
    graceDays: 30,
    pending: null,
  });
});

describe("DangerZone", () => {
  it("is for Owners only", () => {
    asUser(["users.view", "roles.assign"]);
    renderZone();
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
    expect(api.getDeletionContext).not.toHaveBeenCalled();
  });

  it("transfers ownership to another active member with the password", async () => {
    asUser(["workspace.transfer"]);
    api.transferOwnership.mockRejectedValueOnce(
      new ApiError("Password confirmation failed", 403, "STEP_UP_FAILED", [
        { field: "password", message: "The password is not correct" },
      ]),
    );
    api.transferOwnership.mockResolvedValueOnce({ ownerId: "admin-1", previousOwnerId: "owner-1" });
    renderZone();
    const select = await screen.findByLabelText("New owner");
    expect(screen.queryByRole("option", { name: /olive owner/i })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "admin-1" } });
    fireEvent.change(screen.getByLabelText("Your password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /transfer ownership/i }));
    expect(await screen.findByText("password: The password is not correct")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your password"), { target: { value: "right" } });
    fireEvent.click(screen.getByRole("button", { name: /transfer ownership/i }));
    await waitFor(() => expect(api.transferOwnership).toHaveBeenLastCalledWith("admin-1", "right"));
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("only enables deletion once the slug is typed, then signs out", async () => {
    asUser(["workspace.delete"]);
    api.requestDeletion.mockResolvedValue({
      id: "d1",
      status: "scheduled",
      purgeAfter: "2026-11-20T00:00:00.000Z",
    });
    renderZone();
    expect(await screen.findByText("acme-co")).toBeInTheDocument();
    expect(screen.getByText(/After 30\s+days/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /delete this workspace/i });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Workspace slug confirmation"), {
      target: { value: "acme" },
    });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Workspace slug confirmation"), {
      target: { value: "acme-co" },
    });
    fireEvent.change(screen.getByLabelText("Your password"), { target: { value: "secret" } });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    await waitFor(() =>
      expect(api.requestDeletion).toHaveBeenCalledWith({ confirm: "acme-co", password: "secret" }),
    );
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
  });

  it("keeps the user signed in when the server refuses the deletion", async () => {
    asUser(["workspace.delete"]);
    api.requestDeletion.mockRejectedValue(
      new ApiError("Password confirmation failed", 403, "STEP_UP_FAILED"),
    );
    renderZone();
    await screen.findByText("acme-co");
    fireEvent.change(screen.getByLabelText("Workspace slug confirmation"), {
      target: { value: "acme-co" },
    });
    fireEvent.change(screen.getByLabelText("Your password"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /delete this workspace/i }));
    expect(await screen.findByText("Password confirmation failed")).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });
});
