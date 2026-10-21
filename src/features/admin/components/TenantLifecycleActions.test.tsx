import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUDITOR_PERMISSIONS,
  PLATFORM_ADMIN_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
  SUPPORT_OPERATOR_PERMISSIONS,
  adminSessionFor,
} from "@/features/admin/__fixtures__/platformRoles";
import type { Tenant } from "@/lib/api/types";

const api = vi.hoisted(() => ({
  suspendTenant: vi.fn(),
  restoreTenant: vi.fn(),
  disableTenant: vi.fn(),
  archiveTenant: vi.fn(),
}));
vi.mock("@/features/admin/api", () => api);
const session = vi.hoisted(() => ({ useAdminSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);

import { TenantLifecycleActions } from "./TenantLifecycleActions";

function renderActions(status: Tenant["status"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TenantLifecycleActions tenant={{ _id: "ten_A", name: "Acme", status }} />
    </QueryClientProvider>,
  );
}

const buttons = () => screen.queryAllByRole("button").map((b) => b.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(api)) fn.mockResolvedValue({});
});

describe("TenantLifecycleActions", () => {
  it("offers a platform admin suspend and disable on an active tenant, but not archive", () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(PLATFORM_ADMIN_PERMISSIONS));
    renderActions("active");
    expect(buttons()).toEqual(["Suspend", "Disable"]);
  });

  it("offers a super admin archive as well, and restore on a suspended tenant", () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(SUPER_ADMIN_PERMISSIONS));
    const { unmount } = renderActions("active");
    expect(buttons()).toEqual(["Suspend", "Disable", "Archive"]);
    unmount();
    renderActions("suspended");
    expect(buttons()).toEqual(["Disable", "Restore", "Archive"]);
  });

  it("offers nothing to read-only roles or on an archived tenant", () => {
    for (const permissions of [AUDITOR_PERMISSIONS, SUPPORT_OPERATOR_PERMISSIONS]) {
      session.useAdminSession.mockReturnValue(adminSessionFor(permissions));
      const { unmount } = renderActions("active");
      expect(buttons()).toEqual([]);
      unmount();
    }
    session.useAdminSession.mockReturnValue(adminSessionFor(SUPER_ADMIN_PERMISSIONS));
    renderActions("archived");
    expect(buttons()).toEqual([]);
  });

  it("requires confirmation and a reason before calling the API", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(PLATFORM_ADMIN_PERMISSIONS));
    const user = userEvent.setup();
    renderActions("active");
    await user.click(screen.getByRole("button", { name: "Suspend" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "Suspend",
    )!;
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason/), "Unpaid invoices");
    await user.click(confirm);
    await waitFor(() => expect(api.suspendTenant).toHaveBeenCalledWith("ten_A", "Unpaid invoices"));
  });
});
