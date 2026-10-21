import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  rotate: vi.fn(),
  usage: vi.fn(),
  scopes: vi.fn(),
  revoke: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/features/api-keys/api", () => api);
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));

import { useTenantSession } from "@/lib/auth/session";
import { ApiKeysView } from "./ApiKeysView";

const KEY = {
  id: "k1",
  prefix: "sak_abc",
  name: "CI",
  scopes: ["datasets:read"],
  status: "active",
  lastUsedAt: "2026-10-20T10:00:00.000Z",
  lastUsedIp: "203.0.113.7",
};

function renderView(permissions: string[]) {
  vi.mocked(useTenantSession).mockReturnValue({ status: "authenticated", permissions } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ApiKeysView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue({ data: [KEY], meta: { page: 1, limit: 20, total: 1, pages: 1 } });
  api.scopes.mockResolvedValue({ scopes: [], maxTtlDays: 30, rotationOverlapMinutes: 60 });
});

describe("ApiKeysView", () => {
  it("shows the key prefix as the start of the credential and last use", async () => {
    renderView(["api_keys.view"]);
    expect(await screen.findByText("sak_abc.••••")).toBeInTheDocument();
    expect(screen.getByText(/203\.0\.113\.7/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Rotate CI")).toBeNull();
  });

  it("rotates a key and shows the new secret with the overlap end", async () => {
    api.rotate.mockResolvedValue({
      newKey: { id: "k2", prefix: "sak_new", name: "CI", scopes: [] },
      oldKeyRevoked: false,
      overlapEndsAt: "2026-10-22T12:00:00.000Z",
      secret: "sak_new.test-only-secret",
    });
    renderView(["api_keys.view", "api_keys.update"]);
    fireEvent.click(await screen.findByLabelText("Rotate CI"));
    fireEvent.click(await screen.findByRole("button", { name: "Rotate" }));
    await waitFor(() => expect(api.rotate).toHaveBeenCalledWith("k1"));
    const secret = await screen.findByLabelText("Rotated API key secret");
    expect((secret as HTMLInputElement).value).toBe("sak_new.test-only-secret");
    expect(screen.getByText(/old key stops working/i)).toBeInTheDocument();
  });

  it("opens per-key usage", async () => {
    api.usage.mockResolvedValue({
      total: 5,
      days: [
        { day: "2026-10-21", total: 2, errors: 0 },
        { day: "2026-10-22", total: 3, errors: 1 },
      ],
      byEndpoint: [{ endpoint: "GET /datasets", status: 200, count: 4 }],
    });
    renderView(["api_keys.view"]);
    fireEvent.click(await screen.findByLabelText("Usage of CI"));
    expect(await screen.findByText("GET /datasets")).toBeInTheDocument();
    expect(screen.getAllByTestId("usage-bar")).toHaveLength(2);
    expect(api.usage).toHaveBeenCalledWith("k1", 7);
  });

  it("refuses an expiry beyond the cap before calling the API", async () => {
    renderView(["api_keys.view", "api_keys.create"]);
    fireEvent.click(await screen.findByRole("button", { name: /create api key/i }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x" } });
    fireEvent.click(screen.getByLabelText("datasets:read"));
    fireEvent.change(screen.getByLabelText("Expiration"), { target: { value: "2099-01-01" } });
    await screen.findByText(/at most 30 days/);
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("within 30 days");
    expect(api.create).not.toHaveBeenCalled();
  });
});
