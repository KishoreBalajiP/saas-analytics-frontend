import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listShares: vi.fn(),
  share: vi.fn(),
  revokeShare: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/features/dashboards/api", () => ({
  listShares: (...a: unknown[]) => api.listShares(...a),
  share: (...a: unknown[]) => api.share(...a),
  revokeShare: (...a: unknown[]) => api.revokeShare(...a),
  update: (...a: unknown[]) => api.update(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SharingPanel } from "./SharingPanel";

beforeEach(() => {
  vi.clearAllMocks();
  api.listShares.mockResolvedValue({
    visibility: "restricted",
    shares: [
      {
        _id: "s1",
        principalType: "user",
        principalId: "u1",
        principalName: "a@x.io",
        level: "view",
      },
    ],
    candidates: {
      users: [{ id: "u1", name: "A", email: "a@x.io" }],
      roles: [{ id: "r1", name: "Manager" }],
    },
  });
  api.share.mockResolvedValue({});
  api.update.mockResolvedValue({});
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SharingPanel dashboardId="d1" />
    </QueryClientProvider>,
  );
}

describe("SharingPanel", () => {
  it("lists shares and grants a role edit access", async () => {
    renderPanel();
    expect(await screen.findByText("a@x.io")).toBeInTheDocument();
    expect(screen.getAllByText("Can view").length).toBeGreaterThan(1);
    fireEvent.change(screen.getByLabelText("Share with"), { target: { value: "role:r1" } });
    fireEvent.change(screen.getByLabelText("Access level"), { target: { value: "edit" } });
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() =>
      expect(api.share).toHaveBeenCalledWith("d1", {
        principalType: "role",
        principalId: "r1",
        level: "edit",
      }),
    );
  });

  it("changes visibility", async () => {
    renderPanel();
    fireEvent.change(await screen.findByLabelText(/who can open/i), {
      target: { value: "workspace" },
    });
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("d1", { visibility: "workspace" }));
  });
});
