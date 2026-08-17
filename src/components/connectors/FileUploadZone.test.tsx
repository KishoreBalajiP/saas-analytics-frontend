import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { FileUploadZone, CopyableValue } from "./FileUploadZone";

describe("FileUploadZone", () => {
  it("renders the drop zone label", () => {
    render(<FileUploadZone onFileSelect={vi.fn()} />);
    expect(screen.getByText(/Drag and drop/)).toBeInTheDocument();
  });

  it("renders custom label", () => {
    render(<FileUploadZone onFileSelect={vi.fn()} label="Upload CSV here" />);
    expect(screen.getByText("Upload CSV here")).toBeInTheDocument();
  });

  it("renders accepted file types", () => {
    render(<FileUploadZone onFileSelect={vi.fn()} accept=".csv,.txt" />);
    expect(screen.getByText("Accepted: .csv,.txt")).toBeInTheDocument();
  });

  it("shows the hidden file input", () => {
    const { container } = render(<FileUploadZone onFileSelect={vi.fn()} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    expect(input).toHaveAttribute("accept", ".csv,.txt,.xlsx,.xls");
    expect(input).toHaveAttribute("aria-hidden", "true");
  });

  it("calls onFileSelect when file input changes", () => {
    const onFileSelect = vi.fn();
    const { container } = render(<FileUploadZone onFileSelect={onFileSelect} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(["name,age\nAlice,30"], "data.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it("validates file type against accept pattern", () => {
    const onFileSelect = vi.fn();
    const { container } = render(<FileUploadZone onFileSelect={onFileSelect} accept=".csv" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const badFile = new File(["test"], "image.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(onFileSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/File type not allowed/)).toBeInTheDocument();
  });

  it("accepts valid file type", () => {
    const onFileSelect = vi.fn();
    const { container } = render(<FileUploadZone onFileSelect={onFileSelect} accept=".csv" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const goodFile = new File(["name"], "data.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [goodFile] } });

    expect(onFileSelect).toHaveBeenCalledWith(goodFile);
    expect(screen.queryByText(/File type not allowed/)).not.toBeInTheDocument();
  });

  it("shows selected file name after selection", () => {
    const onFileSelect = vi.fn();
    const { container } = render(<FileUploadZone onFileSelect={onFileSelect} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(["data"], "report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("report.xlsx")).toBeInTheDocument();
  });

  it("is disabled when isProcessing is true", () => {
    const { container } = render(<FileUploadZone onFileSelect={vi.fn()} isProcessing />);
    const dropZone = container.querySelector('[role="button"]');
    expect(dropZone?.className).toContain("pointer-events-none");
  });

  it("is accessible with keyboard", () => {
    const { container } = render(<FileUploadZone onFileSelect={vi.fn()} />);
    const dropZone = container.querySelector('[role="button"]');
    expect(dropZone).toBeTruthy();
    expect(dropZone).toHaveAttribute("tabindex", "0");
  });
});

describe("CopyableValue", () => {
  it("renders the value in a code element", () => {
    render(<CopyableValue value="secret_token_123" />);
    expect(screen.getByText("secret_token_123")).toBeInTheDocument();
  });

  it("renders optional label", () => {
    render(<CopyableValue value="tok" label="Webhook Token" />);
    expect(screen.getByText("Webhook Token")).toBeInTheDocument();
  });

  it("has a copy button", () => {
    render(<CopyableValue value="tok" />);
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("calls clipboard API on copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CopyableValue value="secret_val" />);
    const button = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(button);

    expect(writeText).toHaveBeenCalledWith("secret_val");
  });
});
