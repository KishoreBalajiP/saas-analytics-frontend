import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { FieldError } from "@/lib/api/types";

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/features/reports/api", () => ({
  create: (...args: unknown[]) => api.create(...args),
  update: (...args: unknown[]) => api.update(...args),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReportForm } from "./ReportsView";

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ReportForm onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

beforeEach(() => vi.clearAllMocks());

describe("ReportForm", () => {
  it("lists the field errors of a query the API rejected", async () => {
    api.create.mockRejectedValue(
      new ApiError("Invalid analytics query", 400, "INVALID_QUERY", [
        { field: "query.filters[0].op", message: "must be one of eq, neq" },
        { field: "query.dateRange.field", message: "is required" },
      ]),
    );
    const { onClose } = renderForm();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Weekly" } });
    fireEvent.change(screen.getByLabelText(/query json/i), {
      target: { value: '{"datasetId":"d1","dateRange":{"preset":"last_7_days"}}' },
    });
    fireEvent.click(screen.getByRole("button", { name: /save report/i }));
    expect(await screen.findByText("Invalid analytics query")).toBeInTheDocument();
    expect(screen.getByText(/query\.filters\[0\]\.op: must be one of eq, neq/)).toBeInTheDocument();
    expect(screen.getByText(/query\.dateRange\.field: is required/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a plan-limit refusal as one quota sentence, not as a field error list", async () => {
    api.create.mockRejectedValue(
      new ApiError("Plan limit reached for scheduledReports (max 5)", 409, "QUOTA_EXCEEDED", [
        {
          field: "scheduledReports",
          message: "Plan limit reached for scheduledReports (max 5)",
          metric: "scheduledReports",
          limit: 5,
          current: 5,
        } as FieldError,
      ]),
    );
    const { onClose } = renderForm();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Weekly" } });
    fireEvent.change(screen.getByLabelText(/query json/i), {
      target: {
        value: '{"datasetId":"d1","dateRange":{"field":"order_date","preset":"last_7_days"}}',
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /save report/i }));
    expect(
      await screen.findByText(
        /Plan limit reached: your plan allows 5 scheduled reports and 5 are in use/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^scheduledReports: /)).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sends an empty schedule time zone as null (follow the workspace time zone)", async () => {
    api.create.mockResolvedValue({ _id: "r1" });
    const { onClose } = renderForm();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Weekly" } });
    fireEvent.change(screen.getByLabelText(/query json/i), {
      target: {
        value: '{"datasetId":"d1","dateRange":{"field":"order_date","preset":"last_7_days"}}',
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /save report/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const body = api.create.mock.calls[0]?.[0];
    expect(body.schedule.timezone).toBeNull();
    expect(body.query.dateRange).toEqual({ field: "order_date", preset: "last_7_days" });
  });
});
