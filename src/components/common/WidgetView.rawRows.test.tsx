import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { WidgetView, cellValue } from "./WidgetView";
import type { AnalyticsResult } from "@/lib/api/types";

// Regression: raw (ungrouped) analytics rows keep their fields under `data`
// while `columns` lists those data keys, so every cell rendered as "—".

describe("WidgetView raw rows", () => {
  it("reads raw-row cells from data", () => {
    expect(cellValue({ _id: "1", data: { email: "a@x.io" } }, "email")).toBe("a@x.io");
    expect(cellValue({ count: 3 }, "count")).toBe(3);
  });

  it("renders raw-row values instead of dashes", () => {
    const result = {
      rows: [{ _id: "r1", data: { country: "IN", amount: 42 } }],
      columns: ["amount", "country"],
      groupMode: false,
    } as unknown as AnalyticsResult;
    render(<WidgetView type="table" result={result} />);
    expect(screen.getByText("IN")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });
});
