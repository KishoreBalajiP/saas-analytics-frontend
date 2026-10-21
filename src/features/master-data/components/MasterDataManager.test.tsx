import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { adminSessionFor } from "@/features/admin/__fixtures__/platformRoles";

const client = vi.hoisted(() => ({ requestPaged: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  ...client,
}));
const session = vi.hoisted(() => ({ useAdminSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);

import { MasterDataManager } from "./MasterDataManager";

const WRITER = ["master_data.view", "master_data.create", "master_data.delete"];

function renderManager() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MasterDataManager />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  client.requestPaged.mockResolvedValue({
    data: [{ id: "m1", code: "FR", name: "France", isSystem: false }],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
  client.request.mockResolvedValue({});
});

describe("MasterDataManager", () => {
  it("lists a catalogue read-only for viewers", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(["master_data.view"]));
    renderManager();
    expect(await screen.findByText("France")).toBeInTheDocument();
    expect(client.requestPaged).toHaveBeenCalledWith(
      "/master-data/countries",
      expect.objectContaining({ audience: "admin" }),
    );
    expect(screen.queryByRole("button", { name: /add item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete fr/i })).not.toBeInTheDocument();
  });

  it("is refused without master_data.view", () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(["audit_logs.view"]));
    renderManager();
    expect(client.requestPaged).not.toHaveBeenCalled();
  });

  it("creates and deletes items for writers", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(WRITER));
    const user = userEvent.setup();
    renderManager();
    await screen.findByText("France");
    await user.type(screen.getByLabelText("Code"), "DE");
    await user.type(screen.getByLabelText("Name"), "Germany");
    await user.click(screen.getByRole("button", { name: /add item/i }));
    await waitFor(() =>
      expect(client.request).toHaveBeenCalledWith("/master-data/countries", {
        method: "POST",
        audience: "admin",
        body: { code: "DE", name: "Germany" },
      }),
    );
    await user.click(screen.getByRole("button", { name: /delete fr/i }));
    await waitFor(() =>
      expect(client.request).toHaveBeenCalledWith(
        "/master-data/countries/m1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});
