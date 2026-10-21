import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getTenantDeletion: vi.fn(), cancelTenantDeletion: vi.fn() }));
vi.mock("@/features/members/api", () => ({
  getTenantDeletion: (...a: unknown[]) => api.getTenantDeletion(...a),
  cancelTenantDeletion: (...a: unknown[]) => api.cancelTenantDeletion(...a),
}));
vi.mock("@/lib/auth/session", () => ({ useAdminSession: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { useAdminSession } from "@/lib/auth/session";
import { TenantDeletionCard } from "./TenantDeletionCard";

function asAdmin(permissions: string[]) {
  vi.mocked(useAdminSession).mockReturnValue({ permissions } as never);
}

const SCHEDULED = {
  id: "d1",
  tenantId: "t1",
  tenantSlug: "acme",
  tenantName: "Acme",
  status: "scheduled",
  source: "owner_request",
  requestedBy: { type: "user", id: "u1" },
  requestedAt: "2026-10-01T00:00:00.000Z",
  purgeAfter: "2026-10-31T00:00:00.000Z",
  reason: "closing",
  cancelledAt: null,
  cancelReason: null,
  attempts: 0,
  purgedAt: null,
  lastError: null,
  verification: null,
};

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TenantDeletionCard tenantId="t1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("TenantDeletionCard", () => {
  it("renders nothing without a deletion", async () => {
    asAdmin(["iam.tenants.view"]);
    api.getTenantDeletion.mockResolvedValue(null);
    const { container } = renderCard();
    await waitFor(() => expect(api.getTenantDeletion).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("cancels a scheduled deletion with a reason", async () => {
    asAdmin(["iam.tenants.view", "iam.tenants.restore"]);
    api.getTenantDeletion.mockResolvedValue(SCHEDULED);
    api.cancelTenantDeletion.mockResolvedValue({
      ...SCHEDULED,
      status: "cancelled",
      reopened: true,
    });
    renderCard();
    expect(await screen.findByText("scheduled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel deletion/i }));
    expect(await screen.findByText("Give a reason for the audit trail.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Customer asked to keep it" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cancel deletion/i }));
    await waitFor(() =>
      expect(api.cancelTenantDeletion).toHaveBeenCalledWith("t1", "Customer asked to keep it"),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Deletion cancelled; the workspace is open again"),
    );
  });

  it("shows the verification report of a purge and no cancel without iam.tenants.restore", async () => {
    asAdmin(["iam.tenants.view"]);
    api.getTenantDeletion.mockResolvedValue({
      ...SCHEDULED,
      status: "purged",
      purgedAt: "2026-11-01T00:00:00.000Z",
      verification: {
        ok: true,
        checkedAt: "2026-11-01T00:00:00.000Z",
        collections: [
          { name: "Connector", deleted: 3, remaining: 0 },
          { name: "User", deleted: 2, remaining: 0 },
        ],
        retained: [{ name: "AuditLog", count: 12, policy: "audit_retention" }],
        storage: { deleted: 4, remaining: 0 },
      },
    });
    renderCard();
    expect(await screen.findByText(/Verification passed/)).toBeInTheDocument();
    expect(screen.getByText(/2\/2/)).toBeInTheDocument();
    expect(screen.getByText(/AuditLog \(12\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel deletion/i })).not.toBeInTheDocument();
  });
});
