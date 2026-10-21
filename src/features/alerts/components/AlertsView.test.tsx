import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { FieldError } from "@/lib/api/types";

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/features/alerts/api", () => ({
  create: (...args: unknown[]) => api.create(...args),
  update: (...args: unknown[]) => api.update(...args),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AlertForm, LastEvaluation } from "./AlertsView";

beforeEach(() => vi.clearAllMocks());

function renderForm(props: Partial<Parameters<typeof AlertForm>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <AlertForm onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onClose };
}

const GROUPED_QUERY = JSON.stringify({
  groupBy: ["region"],
  metrics: [
    { op: "sum", field: "amount", alias: "revenue" },
    { op: "avg", field: "amount" },
  ],
});

describe("AlertForm", () => {
  it("lists the field errors of a query the API rejected", async () => {
    api.create.mockRejectedValue(
      new ApiError("Invalid analytics query", 400, "INVALID_QUERY", [
        { field: "query.groupBy[0].bucket", message: "must be one of day, week, month" },
      ]),
    );
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AlertForm onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Spike" } });
    fireEvent.change(screen.getByLabelText(/query json/i), {
      target: { value: '{"datasetId":"d1","groupBy":[{"field":"order_date","bucket":"hour"}]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: /save alert/i }));
    expect(
      await screen.findByText(/query\.groupBy\[0\]\.bucket: must be one of day, week, month/),
    ).toBeInTheDocument();
  });

  it("shows a plan-limit refusal as one quota sentence, not as a field error list", async () => {
    api.create.mockRejectedValue(
      new ApiError("Plan limit reached for alerts (max 5)", 409, "QUOTA_EXCEEDED", [
        {
          field: "alerts",
          message: "Plan limit reached for alerts (max 5)",
          metric: "alerts",
          limit: 5,
          current: 5,
        } as FieldError,
      ]),
    );
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AlertForm onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Spike" } });
    fireEvent.change(screen.getByLabelText(/query json/i), {
      target: { value: '{"datasetId":"d1"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: /save alert/i }));
    expect(
      await screen.findByText(/Plan limit reached: your plan allows 5 alerts and 5 are in use/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^alerts: /)).not.toBeInTheDocument();
  });

  it("offers only the query's outputs as metrics and sends the chosen one with the grouping", async () => {
    api.create.mockResolvedValue({ _id: "a1" });
    const { onClose } = renderForm();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Revenue" } });
    fireEvent.change(screen.getByLabelText("Dataset ID"), { target: { value: "d1" } });
    fireEvent.change(screen.getByLabelText(/query json/i), { target: { value: GROUPED_QUERY } });
    const metric = screen.getByLabelText("Metric");
    expect(
      within(metric)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["revenue", "avg_amount"]);
    expect(metric).toHaveValue("revenue");
    fireEvent.change(metric, { target: { value: "avg_amount" } });
    fireEvent.change(screen.getByLabelText("Grouped results"), { target: { value: "any" } });
    fireEvent.change(screen.getByLabelText("Cooldown (minutes)"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: /save alert/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const body = api.create.mock.calls[0]?.[0];
    expect(body.metric).toBe("avg_amount");
    expect(body.groupEvaluation).toBe("any");
    expect(body.cooldownMinutes).toBe(15);
    expect(body.query).toEqual({ ...JSON.parse(GROUPED_QUERY), datasetId: "d1" });
  });

  it("uses count for a query without metrics and hides the grouping choice for ungrouped queries", async () => {
    api.create.mockResolvedValue({ _id: "a1" });
    const { onClose } = renderForm();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Orders" } });
    fireEvent.change(screen.getByLabelText(/query json/i), {
      target: { value: '{"datasetId":"d1"}' },
    });
    expect(within(screen.getByLabelText("Metric")).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByLabelText("Metric")).toHaveValue("count");
    expect(screen.queryByLabelText("Grouped results")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /save alert/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.create.mock.calls[0]?.[0]).toMatchObject({
      metric: "count",
      groupEvaluation: "total",
    });
  });

  it("keeps an edited alert's metric when the query still outputs it, else falls back to the first output", async () => {
    api.update.mockResolvedValue({});
    renderForm({
      alert: {
        _id: "a9",
        name: "Avg",
        source: "query",
        metric: "avg_amount",
        groupEvaluation: "all",
        condition: "lt",
        threshold: 3,
        enabled: true,
        query: { ...JSON.parse(GROUPED_QUERY), datasetId: "d1" },
      },
    });
    expect(screen.getByLabelText("Metric")).toHaveValue("avg_amount");
    expect(screen.getByLabelText("Grouped results")).toHaveValue("all");
    expect(screen.getByLabelText("Dataset ID")).toHaveValue("d1");
    fireEvent.change(screen.getByLabelText(/query json/i), {
      target: { value: '{"datasetId":"d1","metrics":[{"op":"max","field":"amount"}]}' },
    });
    expect(screen.getByLabelText("Metric")).toHaveValue("max_amount");
  });

  it("shows the API's metric error next to the form", async () => {
    api.create.mockRejectedValue(
      new ApiError(
        'Alert metric "n" is not an output of the alert\'s query',
        400,
        "ALERT_METRIC_INVALID",
        [{ field: "metric", message: "must be one of the query's outputs: total" }],
      ),
    );
    renderForm();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "W" } });
    fireEvent.change(screen.getByLabelText(/query json/i), {
      target: { value: '{"datasetId":"d1"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: /save alert/i }));
    expect(
      await screen.findByText(/metric: must be one of the query's outputs: total/),
    ).toBeInTheDocument();
  });

  it("refuses a between condition without a high threshold before calling the API", async () => {
    renderForm({
      alert: {
        _id: "a2",
        name: "Band",
        source: "query",
        metric: "count",
        condition: "between",
        threshold: 10,
        thresholdHigh: null,
        enabled: true,
        query: { datasetId: "d1" } as never,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /save alert/i }));
    expect(await screen.findByText(/high threshold at or above/)).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });
});

describe("LastEvaluation", () => {
  it("describes each outcome", () => {
    const { rerender } = render(<LastEvaluation evaluation={null} />);
    expect(screen.getByText("Not evaluated yet.")).toBeInTheDocument();
    rerender(
      <LastEvaluation
        evaluation={{ outcome: "suppressed", value: 7, groupsEvaluated: 3, groupsMatched: 1 }}
      />,
    );
    expect(screen.getByText("Suppressed (cooldown)")).toBeInTheDocument();
    expect(screen.getByText(/value 7 · 1 of 3 groups/)).toBeInTheDocument();
    rerender(
      <LastEvaluation
        evaluation={{ outcome: "failed", error: 'Alert metric "n" is no longer an output' }}
      />,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/no longer an output/)).toBeInTheDocument();
    rerender(<LastEvaluation evaluation={{ outcome: "no_data", value: null }} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });
});
