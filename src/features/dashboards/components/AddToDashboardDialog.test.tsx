import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), createWidget: vi.fn() }));
vi.mock("@/features/dashboards/api", () => ({
  list: (...a: unknown[]) => api.list(...a),
  create: (...a: unknown[]) => api.create(...a),
  createWidget: (...a: unknown[]) => api.createWidget(...a),
}));
vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

import { AddToDashboardDialog } from "./AddToDashboardDialog";

const query = {
  connectorIds: ["c1"],
  page: 1,
  metrics: [{ field: "amount", op: "sum" as const }],
  groupBy: ["region"],
};

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AddToDashboardDialog
        open
        onOpenChange={vi.fn()}
        query={query}
        datasetId="c1"
        rows={[
          { region: "EU", sum_amount: 1 },
          { region: "US", sum_amount: 2 },
        ]}
        defaultTitle="Revenue by region"
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue({ data: [{ _id: "d1", name: "Sales" }], meta: {} });
});

describe("AddToDashboardDialog", () => {
  it("adds the exact query to an existing dashboard and links to it", async () => {
    api.createWidget.mockResolvedValue({ _id: "w1" });
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText("Dashboard")).toHaveValue("d1"));
    expect(screen.getByLabelText("Widget type")).toHaveValue("pie");
    fireEvent.change(screen.getByLabelText("Widget type"), { target: { value: "bar" } });
    fireEvent.click(screen.getByRole("button", { name: /add widget/i }));
    await screen.findByText(/widget added to/i);
    expect(api.createWidget).toHaveBeenCalledWith("d1", {
      name: "Revenue by region",
      type: "bar",
      datasetId: "c1",
      query: { metrics: query.metrics, groupBy: ["region"] },
    });
    expect(screen.getByRole("link", { name: /open dashboard/i })).toHaveAttribute(
      "href",
      "/dashboards/d1",
    );
  });

  it("creates a new dashboard first", async () => {
    api.create.mockResolvedValue({ _id: "d2", name: "New one" });
    api.createWidget.mockResolvedValue({ _id: "w1" });
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText("Dashboard")).toHaveValue("d1"));
    fireEvent.change(screen.getByLabelText("Dashboard"), { target: { value: "__new__" } });
    fireEvent.change(screen.getByLabelText("New dashboard name"), {
      target: { value: "New one" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add widget/i }));
    await screen.findByText(/widget added to/i);
    expect(api.create).toHaveBeenCalledWith({ name: "New one" });
    expect(api.createWidget.mock.calls[0]?.[0]).toBe("d2");
  });

  it("shows the API error and no success when the widget is rejected", async () => {
    api.createWidget.mockRejectedValue(
      new ApiError("Invalid visualization", 400, "INVALID_VISUALIZATION", [
        { field: "query.metrics", message: "bad" },
      ]),
    );
    renderDialog();
    await waitFor(() => expect(screen.getByLabelText("Dashboard")).toHaveValue("d1"));
    fireEvent.click(screen.getByRole("button", { name: /add widget/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("query.metrics: bad");
    expect(screen.queryByText(/widget added to/i)).toBeNull();
  });
});
