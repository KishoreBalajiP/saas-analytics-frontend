import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listTenantExports: vi.fn(),
  requestTenantExport: vi.fn(),
  tenantDownloadUrl: vi.fn(),
  deleteTenantExport: vi.fn(),
}));
vi.mock("@/features/data-export/api", () => ({
  dataExportKeys: { tenant: (id: string) => ["admin", "tenant", id, "data-exports"] },
  ...api,
}));
vi.mock("@/lib/auth/session", () => ({ useAdminSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAdminSession } from "@/lib/auth/session";
import { TenantDataExportPanel } from "./TenantDataExportPanel";

function renderPanel(permissions: string[]) {
  vi.mocked(useAdminSession).mockReturnValue({ permissions } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TenantDataExportPanel tenantId="t1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listTenantExports.mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 20, total: 0, pages: 0 },
  });
});

describe("TenantDataExportPanel", () => {
  it("requests a tenant export with a reason", async () => {
    api.requestTenantExport.mockResolvedValue({});
    renderPanel(["iam.tenants.view", "iam.tenants.export"]);
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Customer asked" } });
    fireEvent.click(screen.getByRole("button", { name: "Export tenant data" }));
    await waitFor(() =>
      expect(api.requestTenantExport).toHaveBeenCalledWith("t1", "Customer asked"),
    );
  });

  it("hides the export action without iam.tenants.export", async () => {
    renderPanel(["iam.tenants.view"]);
    expect(await screen.findByText("No exports yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export tenant data" })).not.toBeInTheDocument();
  });
});
