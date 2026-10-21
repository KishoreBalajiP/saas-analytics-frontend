import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorState } from "./states";
import { RequestReference } from "./RequestReference";
import { ApiError } from "@/lib/api/client";

// Roadmap 2.8: API errors show a copyable reference id (X-Request-Id).

describe("RequestReference", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing without an id", () => {
    const { container } = render(<RequestReference requestId={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the id and copies it to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<RequestReference requestId="req-abc-123456" />);
    expect(screen.getByText("req-abc-123456")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy reference ID" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("req-abc-123456"));
    expect(await screen.findByRole("button", { name: "Reference ID copied" })).toBeInTheDocument();
  });
});

describe("ErrorState reference id", () => {
  it("shows the request id of a failed API call", () => {
    const err = new ApiError(
      "Internal server error",
      500,
      "INTERNAL_ERROR",
      undefined,
      "srv-req-000123",
    );
    render(<ErrorState error={err} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Reference ID:")).toBeInTheDocument();
    expect(screen.getByText("srv-req-000123")).toBeInTheDocument();
  });

  it("shows it for permission and validation errors too", () => {
    const err = new ApiError("No access", 403, "FORBIDDEN", undefined, "srv-req-000403");
    render(<ErrorState error={err} />);
    expect(screen.getByText("Permission required")).toBeInTheDocument();
    expect(screen.getByText("srv-req-000403")).toBeInTheDocument();
  });

  it("shows no reference for errors that never reached the API", () => {
    render(<ErrorState error={new Error("render bug")} />);
    expect(screen.queryByText("Reference ID:")).not.toBeInTheDocument();
  });
});
