import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUDITOR_PERMISSIONS,
  PLATFORM_ADMIN_PERMISSIONS,
  SUPPORT_OPERATOR_PERMISSIONS,
  adminSessionFor,
} from "@/features/admin/__fixtures__/platformRoles";

const api = vi.hoisted(() => ({
  listAccessRequests: vi.fn(),
  approveAccessRequest: vi.fn(),
  rejectAccessRequest: vi.fn(),
  APPROVABLE_ROLES: ["Viewer", "Manager"],
}));
vi.mock("@/features/admin/api", () => api);
const session = vi.hoisted(() => ({ useAdminSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);

import { AccessRequestList } from "./AccessRequestList";

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AccessRequestList />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listAccessRequests.mockResolvedValue({
    data: [
      {
        id: "ar1",
        reference: "AR-1",
        name: "Grace",
        email: "grace@example.test",
        workspaceName: "Acme",
        reason: "",
        status: "pending",
        createdAt: "2026-10-20T10:00:00.000Z",
      },
    ],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
  api.approveAccessRequest.mockResolvedValue({});
});

describe("AccessRequestList", () => {
  it("lets auditors see the queue but not decide", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(AUDITOR_PERMISSIONS));
    renderList();
    expect(await screen.findByText(/grace@example.test/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
  });

  it("is refused for support operators (no iam.access_requests.view)", () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(SUPPORT_OPERATOR_PERMISSIONS));
    renderList();
    expect(api.listAccessRequests).not.toHaveBeenCalled();
  });

  it("approves with an allowed role for platform admins", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(PLATFORM_ADMIN_PERMISSIONS));
    const user = userEvent.setup();
    renderList();
    await user.type(await screen.findByLabelText("Tenant ID for AR-1"), "ten_A");
    const role = screen.getByLabelText("Role for AR-1");
    expect(Array.from((role as HTMLSelectElement).options).map((o) => o.value)).toEqual([
      "Viewer",
      "Manager",
    ]);
    await user.selectOptions(role, "Manager");
    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() =>
      expect(api.approveAccessRequest).toHaveBeenCalledWith("ar1", "ten_A", "Manager"),
    );
  });
});
