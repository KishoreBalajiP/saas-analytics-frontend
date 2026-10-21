import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ list: vi.fn(), dismiss: vi.fn(), feedback: vi.fn() }));
vi.mock("@/features/insights/api", () => api);
const perms = vi.hoisted(() => ({ value: ["analytics.view"] }));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: () => ({ permissions: perms.value }) }));

import { InsightFeed } from "./InsightFeed";
import { describeInsight } from "@/features/insights/describe";

const insight = {
  _id: "i1",
  type: "period_change",
  metricKey: "revenue",
  cells: {},
  status: "open",
  facts: { change: -120, changePct: -0.12 },
  narration: { claims: [{ text: "Revenue fell 12%.", cells: ["current"] }], caveats: [] },
};

function renderFeed() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <InsightFeed dashboardId="d1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  perms.value = ["analytics.view"];
});

describe("InsightFeed", () => {
  it("lists insights for the dashboard and dismisses one", async () => {
    api.list.mockResolvedValue({ data: [insight], meta: {} });
    api.dismiss.mockResolvedValue({});
    renderFeed();
    expect(await screen.findByText(/changed by -120 \(-12\.0%\)/)).toBeInTheDocument();
    expect(screen.getByText("Revenue fell 12%.")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith({ dashboardId: "d1" });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(api.dismiss).toHaveBeenCalledWith("i1"));
  });

  it("renders nothing without analytics.view", () => {
    perms.value = [];
    renderFeed();
    expect(screen.queryByLabelText("Insights")).not.toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
  });

  it("describes top movers deterministically", () => {
    expect(
      describeInsight({
        ...insight,
        type: "top_movers",
        facts: { movers: [{ member: "EU", change: 50 }] },
      } as never),
    ).toBe("Top movers: EU (+50).");
  });
});
