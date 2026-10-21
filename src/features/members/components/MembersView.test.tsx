import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listRoles: vi.fn(),
  listInvitations: vi.fn(),
  setMemberRoles: vi.fn(),
  deactivateMember: vi.fn(),
  reactivateMember: vi.fn(),
  removeMember: vi.fn(),
  invite: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));
vi.mock("@/features/members/api", () => ({
  membersKeys: {
    all: ["workspace", "members"],
    members: (p: unknown) => ["workspace", "members", "list", p],
    invitations: (p: unknown) => ["workspace", "members", "invitations", p],
    roles: ["workspace", "members", "roles"],
    catalogue: ["workspace", "members", "permissions"],
    deletion: ["workspace", "members", "deletion"],
  },
  ...Object.fromEntries(
    Object.keys(api).map((name) => [
      name,
      (...args: unknown[]) => api[name as keyof typeof api](...args),
    ]),
  ),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { useTenantSession } from "@/lib/auth/session";
import { MembersView } from "./MembersView";

const mockedSession = vi.mocked(useTenantSession);

function asUser(permissions: string[], id = "owner-1") {
  mockedSession.mockReturnValue({
    status: "authenticated",
    me: { id, email: "owner@example.com", permissions },
    tenantSlug: "acme",
    permissions,
    hasPermission: (key: string) => permissions.includes(key),
    refetch: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  } as never);
}

const ROLES = [
  {
    id: "r-owner",
    name: "Owner",
    description: "Full control",
    isSystem: true,
    isDefault: true,
    editable: false,
    permissions: [],
    memberCount: 1,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "r-manager",
    name: "Manager",
    description: "",
    isSystem: false,
    isDefault: true,
    editable: false,
    permissions: [],
    memberCount: 0,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "r-viewer",
    name: "Viewer",
    description: "Read-only",
    isSystem: false,
    isDefault: true,
    editable: false,
    permissions: [],
    memberCount: 1,
    createdAt: null,
    updatedAt: null,
  },
];

const MEMBERS = [
  {
    id: "owner-1",
    email: "owner@example.com",
    name: "Olive Owner",
    status: "active",
    roles: [{ id: "r-owner", name: "Owner" }],
    isOwner: true,
    isPrimaryOwner: true,
    lastLoginAt: null,
    joinedAt: null,
    createdAt: null,
  },
  {
    id: "viewer-1",
    email: "vera@example.com",
    name: "Vera Viewer",
    status: "active",
    roles: [{ id: "r-viewer", name: "Viewer" }],
    isOwner: false,
    isPrimaryOwner: false,
    lastLoginAt: null,
    joinedAt: null,
    createdAt: null,
  },
  {
    id: "gone-1",
    email: "sam@example.com",
    name: "Sam Suspended",
    status: "suspended",
    roles: [{ id: "r-viewer", name: "Viewer" }],
    isOwner: false,
    isPrimaryOwner: false,
    lastLoginAt: null,
    joinedAt: null,
    createdAt: null,
  },
];

const OWNER_PERMS = [
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "roles.view",
  "roles.assign",
];

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MembersView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listMembers.mockResolvedValue({
    data: MEMBERS,
    meta: { page: 1, limit: 20, total: 3, pages: 1 },
  });
  api.listRoles.mockResolvedValue(ROLES);
  api.listInvitations.mockResolvedValue({
    data: [
      {
        _id: "inv-1",
        tenantId: "t",
        invitedEmail: "new@example.com",
        roleId: "r-viewer",
        roleName: "Viewer",
        invitedBy: "owner-1",
        status: "pending",
        expiresAt: new Date().toISOString(),
      },
    ],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
});

describe("MembersView", () => {
  it("requires users.view", () => {
    asUser(["dashboards.view"]);
    renderView();
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
    expect(api.listMembers).not.toHaveBeenCalled();
  });

  it("lists members with roles and status, without actions on yourself", async () => {
    asUser(OWNER_PERMS);
    renderView();
    const ownerRow = (await screen.findByText("Olive Owner")).closest("tr") as HTMLElement;
    expect(within(ownerRow).getByText("(you)")).toBeInTheDocument();
    expect(within(ownerRow).getByText("Primary owner")).toBeInTheDocument();
    expect(
      within(ownerRow).queryByRole("button", { name: /change roles/i }),
    ).not.toBeInTheDocument();
    const viewerRow = screen.getByText("Vera Viewer").closest("tr") as HTMLElement;
    expect(within(viewerRow).getByRole("button", { name: /change roles/i })).toBeInTheDocument();
    expect(
      within(viewerRow).getByRole("button", { name: /deactivate vera viewer/i }),
    ).toBeInTheDocument();
    const suspendedRow = screen.getByText("Sam Suspended").closest("tr") as HTMLElement;
    expect(within(suspendedRow).getByText("deactivated")).toBeInTheDocument();
    expect(
      within(suspendedRow).getByRole("button", { name: /reactivate sam suspended/i }),
    ).toBeInTheDocument();
  });

  it("hides management actions from viewers", async () => {
    asUser(["users.view"]);
    renderView();
    await screen.findByText("Vera Viewer");
    expect(screen.queryByRole("button", { name: /change roles/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deactivate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
    expect(api.listInvitations).not.toHaveBeenCalled();
  });

  it("changes roles and shows the ceiling error from the server", async () => {
    asUser(OWNER_PERMS);
    api.setMemberRoles.mockRejectedValueOnce(
      new ApiError(
        'You cannot grant the "Manager" role because it is not below your own access',
        403,
        "ROLE_CEILING",
      ),
    );
    api.setMemberRoles.mockResolvedValueOnce({
      ...MEMBERS[1],
      roles: [{ id: "r-manager", name: "Manager" }],
    });
    renderView();
    const viewerRow = (await screen.findByText("Vera Viewer")).closest("tr") as HTMLElement;
    fireEvent.click(within(viewerRow).getByRole("button", { name: /change roles/i }));
    fireEvent.click(screen.getByLabelText(/Analyst \(Manager\)/));
    fireEvent.click(screen.getByLabelText(/^Viewer/));
    fireEvent.click(screen.getByRole("button", { name: /save roles/i }));
    await waitFor(() => expect(api.setMemberRoles).toHaveBeenCalledWith("viewer-1", ["r-manager"]));
    expect(await screen.findByText(/not below your own access/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save roles/i }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Roles updated for Vera Viewer"),
    );
  });

  it("refuses to save an empty role set", async () => {
    asUser(OWNER_PERMS);
    renderView();
    const viewerRow = (await screen.findByText("Vera Viewer")).closest("tr") as HTMLElement;
    fireEvent.click(within(viewerRow).getByRole("button", { name: /change roles/i }));
    fireEvent.click(screen.getByLabelText(/^Viewer/));
    fireEvent.click(screen.getByRole("button", { name: /save roles/i }));
    expect(await screen.findByText("Choose at least one role.")).toBeInTheDocument();
    expect(api.setMemberRoles).not.toHaveBeenCalled();
  });

  it("deactivates after confirmation and surfaces the last-owner refusal", async () => {
    asUser(OWNER_PERMS);
    api.deactivateMember.mockResolvedValueOnce({
      member: { ...MEMBERS[1], status: "suspended" },
      changed: true,
      sessionsRevoked: 2,
    });
    api.removeMember.mockRejectedValueOnce(
      new ApiError(
        "A workspace must keep at least one active Owner. Transfer ownership first.",
        409,
        "LAST_OWNER",
      ),
    );
    renderView();
    const viewerRow = (await screen.findByText("Vera Viewer")).closest("tr") as HTMLElement;
    fireEvent.click(within(viewerRow).getByRole("button", { name: /deactivate vera viewer/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(api.deactivateMember).toHaveBeenCalledWith("viewer-1"));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Vera Viewer was deactivated and signed out"),
    );

    fireEvent.click(within(viewerRow).getByRole("button", { name: /remove vera viewer/i }));
    const removeDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(removeDialog).getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "A workspace must keep at least one active Owner. Transfer ownership first.",
      ),
    );
  });

  it("invites with a role and manages pending invitations", async () => {
    asUser(OWNER_PERMS);
    api.invite.mockResolvedValue({
      invitation: { invitedEmail: "new@example.com" },
      delivered: true,
      alreadyPending: false,
    });
    api.resendInvitation.mockResolvedValue({
      invitation: { invitedEmail: "new@example.com" },
      delivered: true,
    });
    api.revokeInvitation.mockResolvedValue({ _id: "inv-1", status: "revoked" });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /invite member/i }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Manager" } });
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));
    await waitFor(() =>
      expect(api.invite).toHaveBeenCalledWith({ email: "new@example.com", roleName: "Manager" }),
    );

    const inviteRow = (await screen.findByText("new@example.com")).closest("tr") as HTMLElement;
    fireEvent.click(within(inviteRow).getByRole("button", { name: "Resend" }));
    await waitFor(() => expect(api.resendInvitation).toHaveBeenCalledWith("inv-1"));
    fireEvent.click(within(inviteRow).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(api.revokeInvitation).toHaveBeenCalledWith("inv-1"));

    fireEvent.change(screen.getByLabelText("Invitation status"), { target: { value: "expired" } });
    await waitFor(() =>
      expect(api.listInvitations).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        status: "expired",
      }),
    );
  });
});
