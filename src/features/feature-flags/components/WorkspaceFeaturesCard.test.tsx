import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ evaluate: vi.fn() }));
vi.mock("@/features/feature-flags/api", () => ({
  workspaceFlagsKey: ["workspace", "feature-flags"],
  evaluate: (...args: unknown[]) => api.evaluate(...args),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));

import { useTenantSession } from "@/lib/auth/session";
import { WorkspaceFeaturesCard } from "./WorkspaceFeaturesCard";

function renderCard(permissions: string[]) {
  vi.mocked(useTenantSession).mockReturnValue({ status: "authenticated", permissions } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceFeaturesCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.evaluate.mockResolvedValue({
    flags: { "analytics.realtime": true, "connectors.webhooks": false, "beta.custom": true },
  });
});

describe("WorkspaceFeaturesCard", () => {
  it("lists the workspace's features with friendly names", async () => {
    renderCard(["feature_flags.view"]);
    const list = await screen.findByRole("list", { name: /workspace features/i });
    expect(within(list).getByText("Realtime analytics")).toBeInTheDocument();
    expect(within(list).getByText("Webhook connectors")).toBeInTheDocument();
    expect(within(list).getByText("beta.custom")).toBeInTheDocument();
    expect(within(list).getAllByText("On")).toHaveLength(2);
    expect(within(list).getAllByText("Off")).toHaveLength(1);
  });

  it("needs feature_flags.view", () => {
    renderCard(["settings.view"]);
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
    expect(api.evaluate).not.toHaveBeenCalled();
  });

  it("shows an empty state when no rollout applies", async () => {
    api.evaluate.mockResolvedValue({ flags: {} });
    renderCard(["feature_flags.view"]);
    expect(await screen.findByText(/no optional features/i)).toBeInTheDocument();
  });
});
