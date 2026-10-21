import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUDITOR_PERMISSIONS, adminSessionFor } from "@/features/admin/__fixtures__/platformRoles";

const api = vi.hoisted(() => ({ listRoles: vi.fn() }));
vi.mock("@/features/admin/api", () => api);
vi.mock("@/features/admin/components/JobsMonitoring", () => ({ JobsMonitoring: () => null }));
const session = vi.hoisted(() => ({ useAdminSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);

import { RoleList } from "./AdminViews";

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RoleList />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("RoleList", () => {
  it("shows the four built-in platform roles with their permission counts, then custom roles", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(AUDITOR_PERMISSIONS));
    api.listRoles.mockResolvedValue({
      data: [
        {
          _id: "r1",
          name: "super_admin",
          scope: "platform",
          builtIn: true,
          label: "Super Admin",
          adminType: "super",
          permissionCount: 455,
        },
        {
          _id: "r2",
          name: "platform_admin",
          scope: "platform",
          builtIn: true,
          label: "Platform Admin",
          adminType: "platform",
          permissionCount: 30,
        },
        {
          _id: "r3",
          name: "support_operator",
          scope: "platform",
          builtIn: true,
          label: "Support Operator",
          adminType: "support",
          permissionCount: 7,
        },
        {
          _id: "r4",
          name: "auditor",
          scope: "platform",
          builtIn: true,
          label: "Auditor",
          adminType: "auditor",
          permissionCount: 19,
        },
        {
          _id: "r5",
          name: "billing_reader",
          scope: "platform",
          builtIn: false,
          permissionCount: 2,
        },
      ],
      meta: { page: 1, limit: 50, total: 5, pages: 1 },
    });
    renderList();
    const auditor = await screen.findByTestId("built-in-role-auditor");
    expect(within(auditor).getByText("Auditor")).toBeInTheDocument();
    expect(auditor).toHaveTextContent("Read-only access");
    expect(auditor).toHaveTextContent("19 permissions");
    for (const name of ["super_admin", "platform_admin", "support_operator", "auditor"]) {
      expect(screen.getByTestId(`built-in-role-${name}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("built-in-role-support_operator")).toHaveTextContent("7 permissions");
    expect(screen.getByText("billing_reader")).toBeInTheDocument();
  });

  it("flags built-in roles that the deployment has not provisioned yet", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(AUDITOR_PERMISSIONS));
    api.listRoles.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, total: 0, pages: 0 } });
    renderList();
    expect(await screen.findByTestId("built-in-role-auditor")).toHaveTextContent(
      "not provisioned yet",
    );
  });

  it("is refused without iam.roles.view", () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(["support.view"]));
    renderList();
    expect(api.listRoles).not.toHaveBeenCalled();
    expect(screen.queryByTestId("built-in-role-auditor")).not.toBeInTheDocument();
  });
});
