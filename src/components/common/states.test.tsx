import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { EmptyState, ComingSoon, ErrorState, InlineFieldErrors } from "./states";
import { ApiError } from "@/lib/api/client";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No data" description="Nothing here yet." />);
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(<EmptyState title="Empty" action={<button>Create one</button>} />);
    expect(screen.getByRole("button", { name: "Create one" })).toBeInTheDocument();
  });
});

describe("ComingSoon", () => {
  it("renders the coming soon card", () => {
    render(<ComingSoon title="Feature X" description="Under construction." />);
    expect(screen.getByText("Feature X")).toBeInTheDocument();
    expect(screen.getByText("Coming soon — backend not implemented yet.")).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("renders a generic error for unknown errors", () => {
    render(<ErrorState error={new Error("oops")} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders 401 as session expired", () => {
    render(<ErrorState error={new ApiError("unauth", 401)} />);
    expect(screen.getByText("Session expired")).toBeInTheDocument();
  });

  it("renders 403 as permission required", () => {
    render(<ErrorState error={new ApiError("forbidden", 403)} />);
    expect(screen.getByText("Permission required")).toBeInTheDocument();
  });

  it("renders 404 as not found", () => {
    render(<ErrorState error={new ApiError("not found", 404)} />);
    expect(screen.getByText("Resource not found")).toBeInTheDocument();
  });

  it("renders 422 as validation failed", () => {
    render(<ErrorState error={new ApiError("bad", 422)} />);
    expect(screen.getByText("Validation failed")).toBeInTheDocument();
  });

  it("renders 429 as rate limited", () => {
    render(<ErrorState error={new ApiError("slow down", 429)} />);
    expect(screen.getByText("Rate limited")).toBeInTheDocument();
  });

  it("renders 501 as ComingSoon", () => {
    const { container } = render(<ErrorState error={new ApiError("not implemented", 501)} />);
    expect(container.textContent).toContain("Not implemented");
  });

  it("renders retry button when onRetry is provided", () => {
    render(<ErrorState error={new Error("fail")} onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders field-level errors", () => {
    const err = new ApiError("validation", 422, "VALIDATION_ERROR", [
      { field: "email", message: "is required" },
    ]);
    render(<ErrorState error={err} />);
    expect(screen.getByText(/email/)).toBeInTheDocument();
    expect(screen.getByText(/is required/)).toBeInTheDocument();
  });
});

describe("InlineFieldErrors", () => {
  it("renders nothing for non-ApiError", () => {
    const { container } = render(<InlineFieldErrors error={new Error("oops")} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders field errors for ApiError", () => {
    const err = new ApiError("bad", 422, undefined, [{ field: "name", message: "too short" }]);
    render(<InlineFieldErrors error={err} />);
    expect(screen.getByText(/name/)).toBeInTheDocument();
    expect(screen.getByText(/too short/)).toBeInTheDocument();
  });

  it("renders nothing when errors array is empty", () => {
    const err = new ApiError("bad", 422);
    const { container } = render(<InlineFieldErrors error={err} />);
    expect(container.innerHTML).toBe("");
  });
});
