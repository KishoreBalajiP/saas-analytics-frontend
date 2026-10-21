import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUDITOR_PERMISSIONS,
  PLATFORM_ADMIN_PERMISSIONS,
  adminSessionFor,
} from "@/features/admin/__fixtures__/platformRoles";

const client = vi.hoisted(() => ({ requestPaged: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  ...client,
}));
const session = vi.hoisted(() => ({ useAdminSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);

import { TenantDeletionList } from "./TenantDeletionList";

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TenantDeletionList />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  client.requestPaged.mockResolvedValue({
    data: [
      {
        id: "d1",
        tenantId: "t1",
        tenantSlug: "acme",
        tenantName: "Acme",
        status: "scheduled",
        source: "owner_request",
        requestedAt: "2026-10-20T10:00:00.000Z",
        purgeAfter: "2026-11-20T10:00:00.000Z",
        lastError: null,
      },
    ],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
  client.request.mockResolvedValue({});
});

describe("TenantDeletionList", () => {
  it("lists deletions from /admin/tenant-deletions, read-only for auditors", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(AUDITOR_PERMISSIONS));
    renderList();
    expect(await screen.findByText(/Acme · acme/)).toBeInTheDocument();
    expect(client.requestPaged).toHaveBeenCalledWith(
      "/admin/tenant-deletions",
      expect.objectContaining({ audience: "admin" }),
    );
    expect(screen.queryByRole("button", { name: /cancel deletion/i })).not.toBeInTheDocument();
  });

  it("is refused without iam.tenants.view", () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(["audit_logs.view"]));
    renderList();
    expect(client.requestPaged).not.toHaveBeenCalled();
  });

  it("cancels a scheduled deletion for platform admins", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(PLATFORM_ADMIN_PERMISSIONS));
    const user = userEvent.setup();
    renderList();
    await user.click(await screen.findByRole("button", { name: /cancel deletion/i }));
    await waitFor(() =>
      expect(client.request).toHaveBeenCalledWith(
        "/tenants/t1/deletion/cancel",
        expect.objectContaining({ method: "POST", audience: "admin" }),
      ),
    );
  });
});
