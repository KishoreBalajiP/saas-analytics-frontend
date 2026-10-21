import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listWorkspaceExports: vi.fn(),
  requestWorkspaceExport: vi.fn(),
  workspaceDownloadUrl: vi.fn(),
  deleteWorkspaceExport: vi.fn(),
}));
vi.mock("@/features/data-export/api", () => ({
  dataExportKeys: { workspace: ["workspace", "data-exports"] },
  ...api,
}));
const startDownload = vi.hoisted(() => vi.fn());
vi.mock("@/features/data-export/lib", async (orig) => ({
  ...(await orig<typeof import("@/features/data-export/lib")>()),
  startDownload,
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useTenantSession } from "@/lib/auth/session";
import { DataExportCard } from "./DataExportCard";

function asUser(permissions: string[]) {
  vi.mocked(useTenantSession).mockReturnValue({ permissions } as never);
}
function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DataExportCard />
    </QueryClientProvider>,
  );
}
const ready = {
  exportId: "tex_1",
  tenantId: "t1",
  status: "completed",
  origin: "tenant",
  requestedBy: { type: "user", id: "u1", email: "o@x.test", display: "o@x.test" },
  createdAt: new Date().toISOString(),
  expiresAt: new Date().toISOString(),
  sizeBytes: 2048,
  downloadable: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listWorkspaceExports.mockResolvedValue({
    data: [ready],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
});

describe("DataExportCard", () => {
  it("is hidden without data_exports.view", () => {
    asUser(["settings.view"]);
    const { container } = renderCard();
    expect(container).toBeEmptyDOMElement();
    expect(api.listWorkspaceExports).not.toHaveBeenCalled();
  });

  it("requests an export and downloads a ready archive", async () => {
    asUser(["data_exports.view", "data_exports.export"]);
    api.requestWorkspaceExport.mockResolvedValue({ ...ready, status: "queued" });
    api.workspaceDownloadUrl.mockResolvedValue({ url: "https://api.test/dl/abc" });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Export workspace data" }));
    await waitFor(() => expect(api.requestWorkspaceExport).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Download" }));
    await waitFor(() => expect(startDownload).toHaveBeenCalledWith("https://api.test/dl/abc"));
    expect(api.workspaceDownloadUrl).toHaveBeenCalledWith("tex_1");
  });

  it("is read-only with data_exports.view only", async () => {
    asUser(["data_exports.view"]);
    renderCard();
    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export workspace data" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
  });
});
