import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";

import { ErrorState } from "./states";

describe("ErrorState (retention: expired exports)", () => {
  it("renders 410 EXPORT_EXPIRED as expired with the API's guidance", () => {
    render(
      <ErrorState
        error={
          new ApiError(
            "This report artefact expired. Request a new report artefact.",
            410,
            "EXPORT_EXPIRED",
          )
        }
        resource="Report download"
      />,
    );
    expect(screen.getByText("Report download expired")).toBeInTheDocument();
    expect(screen.getByText(/Request a new report artefact/)).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("falls back to a generic expiry message", () => {
    render(<ErrorState error={{ statusCode: 410 }} />);
    expect(screen.getByText("Resource expired")).toBeInTheDocument();
    expect(screen.getByText(/no longer available/)).toBeInTheDocument();
  });
});
