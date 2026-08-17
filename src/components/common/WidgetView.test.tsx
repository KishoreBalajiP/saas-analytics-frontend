import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { WidgetView } from "./WidgetView";
import type { AnalyticsResult } from "@/lib/api/types";

const tableResult: AnalyticsResult = {
  rows: [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ],
  columns: ["name", "age"],
  total: 2,
};

const chartResult: AnalyticsResult = {
  rows: [
    { category: "A", revenue: 100 },
    { category: "B", revenue: 200 },
    { category: "C", revenue: 150 },
  ],
  columns: ["category", "revenue"],
  total: 3,
};

const singleRowResult: AnalyticsResult = {
  rows: [{ total_revenue: 5000 }],
  columns: ["total_revenue"],
  total: 1,
};

describe("WidgetView", () => {
  describe("empty result", () => {
    it("renders empty state when no rows", () => {
      render(<WidgetView type="table" result={{ rows: [], total: 0 }} />);
      expect(screen.getByText(/No data returned/)).toBeInTheDocument();
    });

    it("renders empty state when result is undefined", () => {
      render(<WidgetView type="table" result={undefined} />);
      expect(screen.getByText(/No data returned/)).toBeInTheDocument();
    });
  });

  describe("table type", () => {
    it("renders table headers from columns", () => {
      render(<WidgetView type="table" result={tableResult} />);
      expect(screen.getByText("name")).toBeInTheDocument();
      expect(screen.getByText("age")).toBeInTheDocument();
    });

    it("renders data rows", () => {
      render(<WidgetView type="table" result={tableResult} />);
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("formats numbers with locale", () => {
      render(<WidgetView type="table" result={tableResult} />);
      expect(screen.getByText("30")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument();
    });

    it("derives columns from first row when columns array is empty", () => {
      const result: AnalyticsResult = {
        rows: [{ x: 1, y: 2 }],
        total: 1,
      };
      render(<WidgetView type="table" result={result} />);
      expect(screen.getByText("x")).toBeInTheDocument();
      expect(screen.getByText("y")).toBeInTheDocument();
    });

    it("limits to 50 rows", () => {
      const manyRows = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        value: i * 10,
      }));
      const result: AnalyticsResult = { rows: manyRows, total: 60 };
      const { container } = render(<WidgetView type="table" result={result} />);
      const bodyRows = container.querySelectorAll("tbody tr");
      expect(bodyRows.length).toBe(50);
    });
  });

  describe("kpi type", () => {
    it("renders the first numeric value prominently", () => {
      render(<WidgetView type="kpi" result={singleRowResult} />);
      expect(screen.getByText("5,000")).toBeInTheDocument();
    });

    it("renders the metric key as label", () => {
      render(<WidgetView type="kpi" result={singleRowResult} />);
      expect(screen.getByText("total_revenue")).toBeInTheDocument();
    });
  });

  describe("chart types", () => {
    it("renders bar chart for bar type", async () => {
      const { container } = render(<WidgetView type="bar" result={chartResult} />);
      await waitFor(() => {
        const svg = container.querySelector("svg");
        expect(svg).toBeTruthy();
      });
    });

    it("renders line chart for line type", async () => {
      const { container } = render(<WidgetView type="line" result={chartResult} />);
      await waitFor(() => {
        const svg = container.querySelector("svg");
        expect(svg).toBeTruthy();
      });
    });

    it("renders area chart for area type", async () => {
      const { container } = render(<WidgetView type="area" result={chartResult} />);
      await waitFor(() => {
        const svg = container.querySelector("svg");
        expect(svg).toBeTruthy();
      });
    });

    it("renders pie chart for pie type", async () => {
      const { container } = render(<WidgetView type="pie" result={chartResult} />);
      await waitFor(() => {
        const svg = container.querySelector("svg");
        expect(svg).toBeTruthy();
      });
    });

    it("shows empty state for charts with no numeric data", () => {
      const result: AnalyticsResult = {
        rows: [{ name: "Alice" }, { name: "Bob" }],
        total: 2,
      };
      render(<WidgetView type="bar" result={result} />);
      expect(screen.getByText(/No numeric metric/)).toBeInTheDocument();
    });
  });

  describe("all widget types are supported", () => {
    const supportedTypes = ["kpi", "table", "bar", "line", "area", "pie"] as const;

    for (const type of supportedTypes) {
      it(`renders ${type} without crashing`, () => {
        const result: AnalyticsResult = {
          rows: [{ label: "A", value: 10 }],
          total: 1,
        };
        const { container } = render(<WidgetView type={type} result={result} />);
        expect(container.innerHTML.length).toBeGreaterThan(0);
      });
    }
  });
});
