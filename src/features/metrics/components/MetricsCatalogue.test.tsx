import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  approve: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/features/metrics/api", () => api);
const session = vi.hoisted(() => ({ useTenantSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MetricsCatalogue } from "./MetricsCatalogue";
import { MetricPicker } from "./MetricPicker";

const draft = {
  id: "1",
  key: "revenue",
  version: 2,
  label: "Revenue",
  connectorId: "c",
  aggregation: "sum",
  field: "amount",
  format: "number",
  direction: "higher_is_better",
  status: "draft",
  approvedVersion: 1,
};

function renderCatalogue(permissions: string[]) {
  session.useTenantSession.mockReturnValue({ permissions });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MetricsCatalogue />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue({ data: [draft], meta: {} });
  api.approve.mockResolvedValue(draft);
  api.update.mockResolvedValue(draft);
});

describe("MetricsCatalogue", () => {
  it("lists metrics and approves a draft version", async () => {
    renderCatalogue(["metrics.view", "metrics.manage", "metrics.approve"]);
    expect(await screen.findByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText(/v1 in use/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve v2" }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith("revenue", 2));
  });

  it("hides approval without metrics.approve and denies without metrics.view", async () => {
    renderCatalogue(["metrics.view", "metrics.manage"]);
    expect(await screen.findByText("Revenue")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("editing saves a new version", async () => {
    renderCatalogue(["metrics.view", "metrics.manage"]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByText(/creates version 3 as a draft/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]?.[0]).toBe("revenue");
  });
});

describe("MetricPicker", () => {
  it("adds a metric reference", () => {
    const onPick = vi.fn();
    render(<MetricPicker metrics={[draft] as never} onPick={onPick} />);
    fireEvent.change(screen.getByLabelText("Approved metric"), { target: { value: "revenue" } });
    fireEvent.click(screen.getByRole("button", { name: "Add metric" }));
    expect(onPick).toHaveBeenCalledWith("metric:revenue");
  });
});
