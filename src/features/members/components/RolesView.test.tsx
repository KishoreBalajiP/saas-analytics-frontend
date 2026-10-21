import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  listRoles: vi.fn(),
  listPermissionCatalogue: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
}));
vi.mock("@/features/members/api", () => ({
  membersKeys: {
    all: ["workspace", "members"],
    roles: ["workspace", "members", "roles"],
    catalogue: ["workspace", "members", "permissions"],
  },
  listRoles: (...a: unknown[]) => api.listRoles(...a),
  listPermissionCatalogue: (...a: unknown[]) => api.listPermissionCatalogue(...a),
  createRole: (...a: unknown[]) => api.createRole(...a),
  updateRole: (...a: unknown[]) => api.updateRole(...a),
  deleteRole: (...a: unknown[]) => api.deleteRole(...a),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { useTenantSession } from "@/lib/auth/session";
import { RolesView } from "./RolesView";

function asUser(permissions: string[]) {
  vi.mocked(useTenantSession).mockReturnValue({
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

const BUILT_IN = {
  id: "r-viewer",
  name: "Viewer",
  description: "Read-only",
  isSystem: false,
  isDefault: true,
  editable: false,
  permissions: ["dashboards.view"],
  memberCount: 2,
  createdAt: null,
  updatedAt: null,
};
const CUSTOM = {
  id: "r-dev",
  name: "Developer",
  description: "API access",
  isSystem: false,
  isDefault: false,
  editable: true,
  permissions: ["api_keys.view"],
  memberCount: 0,
  createdAt: null,
  updatedAt: null,
};
const CATALOGUE = [
  {
    key: "api_keys.view",
    module: "api_keys",
    action: "view",
    description: "",
    held: true,
    assignable: true,
  },
  {
    key: "dashboards.view",
    module: "dashboards",
    action: "view",
    description: "",
    held: true,
    assignable: true,
  },
  {
    key: "connectors.delete",
    module: "connectors",
    action: "delete",
    description: "",
    held: false,
    assignable: false,
  },
  {
    key: "workspace.delete",
    module: "workspace",
    action: "delete",
    description: "",
    held: true,
    assignable: false,
  },
];
const ALL = ["roles.view", "roles.create", "roles.update", "roles.delete"];

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RolesView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listRoles.mockResolvedValue([BUILT_IN, CUSTOM]);
  api.listPermissionCatalogue.mockResolvedValue(CATALOGUE);
});

describe("RolesView", () => {
  it("requires roles.view", () => {
    asUser(["users.view"]);
    renderView();
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
  });

  it("shows built-in roles read-only and custom roles editable", async () => {
    asUser(ALL);
    renderView();
    expect(await screen.findByText("Built-in")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.getByText(/2 members/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /delete developer/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete viewer/i })).not.toBeInTheDocument();
  });

  it("creates a role from assignable permissions only", async () => {
    asUser(ALL);
    api.createRole.mockResolvedValue({ ...CUSTOM, id: "r-new", name: "Auditor" });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /new role/i }));
    await screen.findByLabelText("dashboards.view");
    expect(screen.getByLabelText("connectors.delete")).toBeDisabled();
    expect(screen.getByLabelText("workspace.delete")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Role name"), { target: { value: "Auditor" } });
    fireEvent.click(screen.getByLabelText("dashboards.view"));
    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    await waitFor(() =>
      expect(api.createRole).toHaveBeenCalledWith({
        name: "Auditor",
        description: "",
        permissions: ["dashboards.view"],
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Role "Auditor" created'));
  });

  it("shows the server's field errors when a role is refused", async () => {
    asUser(ALL);
    api.createRole.mockRejectedValue(
      new ApiError("Validation failed", 422, "VALIDATION_FAILED", [
        { field: "name", message: '"viewer" is a built-in role name' },
      ]),
    );
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /new role/i }));
    await screen.findByLabelText("dashboards.view");
    fireEvent.change(screen.getByLabelText("Role name"), { target: { value: "viewer" } });
    fireEvent.click(screen.getByLabelText("dashboards.view"));
    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    expect(await screen.findByText(/name: "viewer" is a built-in role name/)).toBeInTheDocument();
  });

  it("edits and deletes a custom role", async () => {
    asUser(ALL);
    api.updateRole.mockResolvedValue({
      ...CUSTOM,
      permissions: ["api_keys.view", "dashboards.view"],
    });
    api.deleteRole.mockResolvedValue({ deleted: true });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /edit/i }));
    await screen.findByLabelText("dashboards.view");
    expect(screen.getByLabelText("api_keys.view")).toBeChecked();
    fireEvent.click(screen.getByLabelText("dashboards.view"));
    fireEvent.click(screen.getByRole("button", { name: /save role/i }));
    await waitFor(() =>
      expect(api.updateRole).toHaveBeenCalledWith("r-dev", {
        name: "Developer",
        description: "API access",
        permissions: ["api_keys.view", "dashboards.view"],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /delete developer/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.deleteRole).toHaveBeenCalledWith("r-dev"));
  });
});
