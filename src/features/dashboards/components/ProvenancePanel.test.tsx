import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProvenancePanel } from "./ProvenancePanel";

describe("ProvenancePanel", () => {
  it("explains window, time zone, dataset version and excluded values", () => {
    render(
      <ProvenancePanel
        provenance={{
          window: {
            field: "order_date",
            preset: "last_month",
            from: "2024-01-01T00:00:00Z",
            to: "2024-02-01T00:00:00Z",
          },
          timezone: "Europe/Berlin",
          dataset: { id: "c1", name: "Orders", type: "csv", dataVersion: 7, lastSyncedAt: null },
          metrics: [{ op: "sum", field: "amount", alias: "total" }],
          groupBy: [{ field: "order_date", bucket: "month" }],
          filterCount: 1,
          excluded: { total: 2 },
          metricDefinitions: [],
          executedAt: null,
          cached: true,
        }}
      />,
    );
    expect(screen.queryByText("Europe/Berlin")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /how this was calculated/i }));
    expect(screen.getByText("Europe/Berlin")).toBeInTheDocument();
    expect(screen.getByText("Orders (version 7)")).toBeInTheDocument();
    expect(screen.getByText(/total = sum\(amount\) by order_date \(month\)/)).toBeInTheDocument();
    expect(screen.getByText("2 non-numeric in total")).toBeInTheDocument();
  });
});
