import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  status: vi.fn(),
  ask: vi.fn(),
  feedback: vi.fn(),
  setConsent: vi.fn(),
}));
vi.mock("@/features/ai/api", () => api);
vi.mock("@/lib/auth/session", () => ({
  useTenantSession: () => ({ permissions: ["analytics.view"] }),
}));

import { AskView } from "./AskView";

const on = {
  available: true,
  killSwitch: false,
  enabled: true,
  consent: true,
  providerConfigured: true,
};

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AskView />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("AskView", () => {
  it("is hidden behind the builder fallback when unavailable", async () => {
    api.status.mockResolvedValue({ ...on, available: false });
    renderView();
    expect(await screen.findByText("Ask is not available")).toBeInTheDocument();
  });

  it("asks for consent first", async () => {
    api.status.mockResolvedValue({ ...on, consent: false });
    renderView();
    expect(await screen.findByText("Consent required")).toBeInTheDocument();
  });

  it("shows the result, assumptions, provenance and records feedback", async () => {
    api.status.mockResolvedValue(on);
    api.ask.mockResolvedValue({
      id: "q1",
      outcome: "answered",
      assumptions: ["revenue = sum(amount)"],
      plan: { metrics: [] },
      result: { rows: [{ region: "EU", revenue: 10 }], columns: ["region", "revenue"] },
      provenance: { datasetId: "d", datasetName: "Orders", rowCount: 1, total: 1, timezone: "UTC" },
    });
    api.feedback.mockResolvedValue({});
    renderView();
    fireEvent.change(await screen.findByLabelText("Question"), {
      target: { value: "Revenue by region" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("EU")).toBeInTheDocument();
    expect(screen.getByText("revenue = sum(amount)")).toBeInTheDocument();
    expect(screen.getByText(/Dataset Orders/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    await waitFor(() => expect(api.feedback).toHaveBeenCalledWith("q1", "up"));
  });

  it("offers clarify options and shows abstention", async () => {
    api.status.mockResolvedValue(on);
    api.ask
      .mockResolvedValueOnce({
        id: "q1",
        outcome: "clarify",
        clarify: { question: "Which date?", options: ["order_date"] },
      })
      .mockResolvedValueOnce({ id: "q2", outcome: "unanswerable", reason: "missing_field" });
    renderView();
    fireEvent.change(await screen.findByLabelText("Question"), { target: { value: "Sales" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(await screen.findByRole("button", { name: "order_date" }));
    expect(await screen.findByText(/could not be answered \(missing_field\)/)).toBeInTheDocument();
  });
});
