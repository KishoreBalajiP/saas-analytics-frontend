import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import { QueryResults } from "./QueryResults";

describe("QueryResults", () => {
  it("lists every field error of a rejected query", () => {
    const error = new ApiError("Invalid analytics query", 400, "INVALID_QUERY", [
      { field: "dateRange.field", message: "is required" },
      { field: "groupBy[0].bucket", message: "must be one of day, week" },
    ]);
    render(<QueryResults result={null} meta={null} error={error} />);
    expect(screen.getByRole("heading", { name: /query rejected/i })).toBeInTheDocument();
    expect(screen.getByText("dateRange.field")).toBeInTheDocument();
    expect(screen.getByText("groupBy[0].bucket")).toBeInTheDocument();
  });

  it("explains the per-workspace concurrency limit", () => {
    const error = new ApiError("Too many", 429, "QUERY_CONCURRENCY_LIMIT");
    render(<QueryResults result={null} meta={null} error={error} />);
    expect(screen.getByRole("heading", { name: /too many queries running/i })).toBeInTheDocument();
  });

  it("shows the resolved window and the workspace time zone", () => {
    render(
      <QueryResults
        result={{
          rows: [{ region: "EU", count: 3 }],
          total: 1,
          groupMode: "grouped",
          timezone: "Asia/Kolkata",
          window: {
            field: "order_date",
            preset: "last_month",
            from: "2026-01-31T18:30:00.000Z",
            to: "2026-02-28T18:29:59.999Z",
          },
        }}
        meta={{ total: 1 }}
      />,
    );
    expect(screen.getByText("2026-02-01 – 2026-02-28 on order_date")).toBeInTheDocument();
    expect(screen.getByText("Time zone Asia/Kolkata")).toBeInTheDocument();
  });
});
