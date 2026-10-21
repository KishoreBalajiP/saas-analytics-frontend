import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { brokenReasonText, isBroken } from "@/features/datasets/lib/brokenDependency";
import { BrokenBadge, BrokenDependencyState } from "./BrokenDependency";

describe("BrokenDependency", () => {
  it("detects broken entities", () => {
    expect(isBroken({ brokenAt: "2026-10-20T00:00:00.000Z" })).toBe(true);
    expect(isBroken({ brokenAt: null })).toBe(false);
    expect(isBroken(undefined)).toBe(false);
  });

  it("explains a deleted dataset", () => {
    expect(brokenReasonText("CONNECTOR_DELETED")).toMatch(/dataset it reads from was deleted/);
    expect(brokenReasonText("SOMETHING_ELSE")).toMatch(/no longer available/);
  });

  it("renders a badge only for broken entities", () => {
    const { rerender } = render(<BrokenBadge entity={{ brokenAt: null }} />);
    expect(screen.queryByText("Broken")).toBeNull();
    rerender(
      <BrokenBadge entity={{ brokenAt: "2026-10-20", brokenReason: "CONNECTOR_DELETED" }} />,
    );
    expect(screen.getByText("Broken")).toBeInTheDocument();
  });

  it("renders the broken state with a fix hint", () => {
    render(
      <BrokenDependencyState
        entity={{ brokenAt: "2026-10-20", brokenReason: "CONNECTOR_DELETED" }}
        resource="report"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("This report is broken");
    expect(screen.getByText(/choose another dataset/)).toBeInTheDocument();
  });
});
