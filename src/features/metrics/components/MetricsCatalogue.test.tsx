import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  approve: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
}));
vi.mock("@/features/metrics/api", () => api);
const datasets = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/features/datasets/api", () => datasets);
const analytics = vi.hoisted(() => ({ runQuery: vi.fn() }));
vi.mock("@/features/analytics/api", () => analytics);
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
  datasets.list.mockResolvedValue({ data: [{ _id: "c", name: "Orders" }], meta: {} });
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

describe("MetricsCatalogue lifecycle", () => {
  it("archives a metric after confirmation and hides Edit for ratio metrics", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.archive.mockResolvedValue({});
    api.list.mockResolvedValue({
      data: [draft, { ...draft, id: "2", key: "conv", label: "Conversion", aggregation: "ratio" }],
      meta: {},
    });
    renderCatalogue(["metrics.view", "metrics.manage"]);
    expect(await screen.findByText("Conversion")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    fireEvent.click(screen.getAllByRole("button", { name: "Archive" })[0]!);
    await waitFor(() => expect(api.archive).toHaveBeenCalledWith("revenue"));
  });
});

describe("MetricForm preview", () => {
  it("picks a dataset from a dropdown and previews the result via the analytics API", async () => {
    analytics.runQuery.mockResolvedValue({ result: { rows: [{ value: 42 }] } });
    renderCatalogue(["metrics.view", "metrics.manage"]);
    fireEvent.click(await screen.findByRole("button", { name: "New metric" }));
    expect(await screen.findByRole("option", { name: "Orders" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dataset"), { target: { value: "c" } });
    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "amount" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview result" }));
    await waitFor(() => expect(screen.getByTestId("metric-preview")).toHaveTextContent("42"));
    expect(analytics.runQuery.mock.calls[0]?.[0]).toMatchObject({
      connectorIds: ["c"],
      metrics: [{ op: "sum", field: "amount" }],
    });
  });
});

describe("MetricForm saved filters", () => {
  it("keeps filters the guided editor can't show, read-only, when saving", async () => {
    const odd = [
      { field: "amount", op: "eq", value: 5 },
      { field: "tier", op: "in", value: [1, 2] },
    ];
    api.list.mockResolvedValue({ data: [{ ...draft, filters: odd }], meta: {} });
    renderCatalogue(["metrics.view", "metrics.manage"]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByTestId("kept-filters")).toHaveTextContent(/kept unchanged/);
    expect(
      screen.getByRole("button", { name: /Reset and use guided filters/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]?.[1].filters).toEqual(odd);
  });

  it("round-trips guided filters, including 'is one of' values with commas", async () => {
    const filters = [{ field: "company", op: "in", value: ["Acme, Inc", 'Say "hi"', "EU"] }];
    api.list.mockResolvedValue({ data: [{ ...draft, filters }], meta: {} });
    renderCatalogue(["metrics.view", "metrics.manage"]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.queryByTestId("kept-filters")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filter 1 value")).toHaveValue('"Acme, Inc", "Say ""hi""", EU');
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]?.[1].filters).toEqual(filters);
  });
});
