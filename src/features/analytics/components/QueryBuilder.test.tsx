import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Connector } from "@/lib/api/types";
import { QueryBuilder } from "./QueryBuilder";

const connectors = [{ _id: "c1", name: "Orders", type: "csv" }] as unknown as Connector[];

function runButton() {
  return screen.getByRole("button", { name: /run query/i });
}

describe("QueryBuilder", () => {
  it("sends the chosen date column and relative preset, not frozen dates", () => {
    const onRun = vi.fn();
    render(<QueryBuilder connectors={connectors} onRun={onRun} />);
    fireEvent.click(screen.getByRole("button", { name: /orders/i }));
    fireEvent.change(screen.getByLabelText("Range"), { target: { value: "last_month" } });
    fireEvent.change(screen.getByLabelText("Date field"), { target: { value: "order_date" } });
    fireEvent.click(runButton());

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0]?.[0]).toMatchObject({
      connectorIds: ["c1"],
      dateRange: { field: "order_date", preset: "last_month" },
    });
  });

  it("asks for the date column before running a dated query", () => {
    const onRun = vi.fn();
    render(<QueryBuilder connectors={connectors} onRun={onRun} />);
    fireEvent.click(screen.getByRole("button", { name: /orders/i }));
    fireEvent.change(screen.getByLabelText("Range"), { target: { value: "today" } });
    fireEvent.click(runButton());
    expect(onRun).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/choose the date column/i);
  });

  it("sends custom dates as plain days and date buckets as group objects", () => {
    const onRun = vi.fn();
    render(<QueryBuilder connectors={connectors} onRun={onRun} timezone="Asia/Kolkata" />);
    fireEvent.click(screen.getByRole("button", { name: /orders/i }));
    fireEvent.change(screen.getByLabelText("Range"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Date field"), { target: { value: "order_date" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-31" } });
    expect(screen.getByText(/Asia\/Kolkata/)).toBeInTheDocument();

    const addButtons = screen.getAllByRole("button", { name: /add/i });
    fireEvent.click(addButtons[1]!); // Group By
    fireEvent.change(screen.getByLabelText("Group by field"), { target: { value: "order_date" } });
    fireEvent.change(screen.getByLabelText("Group by date bucket"), { target: { value: "month" } });
    fireEvent.click(runButton());

    expect(onRun.mock.calls[0]?.[0]).toMatchObject({
      dateRange: { field: "order_date", preset: "custom", from: "2026-01-01", to: "2026-01-31" },
      groupBy: [{ field: "order_date", bucket: "month" }],
    });
  });

  it("restores a saved query, including legacy sort direction and list filters", () => {
    const onRun = vi.fn();
    render(
      <QueryBuilder
        connectors={connectors}
        onRun={onRun}
        initialParams={{
          connectorIds: ["c1"],
          groupBy: ["region"],
          filters: [{ field: "region", op: "in", value: ["EU", "US"] }],
          orderBy: [{ field: "region", dir: "desc" } as never],
          dateRange: { field: "order_date", preset: "this_year" },
        }}
      />,
    );
    fireEvent.click(runButton());
    expect(onRun.mock.calls[0]?.[0]).toMatchObject({
      groupBy: ["region"],
      filters: [{ field: "region", op: "in", value: ["EU", "US"] }],
      orderBy: [{ field: "region", direction: "desc" }],
      dateRange: { field: "order_date", preset: "this_year" },
    });
  });

  it("shows the field errors the server returned for the last run", () => {
    render(
      <QueryBuilder
        connectors={connectors}
        onRun={vi.fn()}
        serverErrors={[{ field: "filters[0].op", message: "must be one of eq, neq" }]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("filters[0].op");
    expect(screen.getByRole("alert")).toHaveTextContent("must be one of eq, neq");
  });
});
