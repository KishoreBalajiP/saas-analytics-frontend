import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  createWidget: vi.fn(),
  updateWidget: vi.fn(),
  removeWidget: vi.fn(),
  datasetSchema: vi.fn(),
  runQuery: vi.fn(),
}));
vi.mock("@/features/dashboards/api", () => ({
  createWidget: (...a: unknown[]) => api.createWidget(...a),
  updateWidget: (...a: unknown[]) => api.updateWidget(...a),
  removeWidget: (...a: unknown[]) => api.removeWidget(...a),
  datasetSchema: (...a: unknown[]) => api.datasetSchema(...a),
}));
vi.mock("@/features/analytics/api", () => ({ runQuery: (...a: unknown[]) => api.runQuery(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { WidgetBuilder } from "./WidgetBuilder";

function renderBuilder() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <WidgetBuilder
        dashboardId="d1"
        widget={null}
        connectors={[{ _id: "c1", name: "Orders" }]}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  );
  return { onSaved };
}

function fillBarWidget() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "By region" } });
  fireEvent.change(screen.getByLabelText("Dataset"), { target: { value: "c1" } });
  fireEvent.click(screen.getByRole("button", { name: /add metric/i }));
  fireEvent.change(screen.getByLabelText("Metric 1 aggregation"), {
    target: { value: "count_distinct" },
  });
  fireEvent.change(screen.getByLabelText("Metric 1 field"), { target: { value: "customer" } });
  fireEvent.click(screen.getByRole("button", { name: /add group/i }));
  fireEvent.change(screen.getByLabelText("Group 1 field"), { target: { value: "region" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.datasetSchema.mockResolvedValue({
    connectorId: "c1",
    version: 1,
    dateField: null,
    fields: [
      { name: "region", type: "string" },
      { name: "customer", type: "string" },
    ],
  });
  api.createWidget.mockResolvedValue({ _id: "w1" });
});

describe("WidgetBuilder", () => {
  it("produces a valid widget from the visual controls", async () => {
    const { onSaved } = renderBuilder();
    fillBarWidget();
    fireEvent.click(screen.getByRole("button", { name: "Add widget" }));
    await waitFor(() => expect(api.createWidget).toHaveBeenCalled());
    expect(api.createWidget.mock.calls[0]?.[0]).toBe("d1");
    expect(api.createWidget.mock.calls[0]?.[1]).toMatchObject({
      name: "By region",
      type: "bar",
      datasetId: "c1",
      query: {
        metrics: [{ op: "count_distinct", field: "customer" }],
        groupBy: [{ field: "region" }],
      },
      visualization: {},
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("blocks saving a chart without group-by and shows the issue", async () => {
    renderBuilder();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Dataset"), { target: { value: "c1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add widget" }));
    expect(await screen.findByText(/needs a group-by field/)).toBeInTheDocument();
    expect(api.createWidget).not.toHaveBeenCalled();
  });

  it("maps server field errors next to the right section", async () => {
    api.createWidget.mockRejectedValue(
      new ApiError("Invalid analytics query", 400, "INVALID_QUERY", [
        { field: "query.groupBy[0].field", message: '"region" is not a field of this dataset' },
      ]),
    );
    renderBuilder();
    fillBarWidget();
    fireEvent.click(screen.getByRole("button", { name: "Add widget" }));
    expect(
      await screen.findByText(/\[0\]\.field: "region" is not a field of this dataset/),
    ).toBeInTheDocument();
  });

  it("previews through the analytics endpoint", async () => {
    api.runQuery.mockResolvedValue({
      result: { rows: [{ region: "EU", count_distinct_customer: 2 }] },
      meta: {},
    });
    renderBuilder();
    fillBarWidget();
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(api.runQuery).toHaveBeenCalled());
    expect(api.runQuery.mock.calls[0]?.[0]).toMatchObject({
      connectorIds: ["c1"],
      groupBy: [{ field: "region" }],
    });
    expect(await screen.findByLabelText("Widget preview")).toBeInTheDocument();
  });
});
