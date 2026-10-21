import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { webhookIngestUrl } from "@/features/datasets/api";
import { signingExample } from "@/features/datasets/lib/webhookSigning";
import { WebhookSigningInstructions } from "./WebhookSigningInstructions";

describe("WebhookSigningInstructions", () => {
  it("shows the absolute ingest URL built from the API base", () => {
    render(<WebhookSigningInstructions webhookToken="tok_abc" signatureVersion={2} />);
    const url = webhookIngestUrl("tok_abc");
    expect(url).toMatch(/^https?:\/\/.+\/webhooks\/tok_abc$/);
    expect(screen.getByText(url)).toBeInTheDocument();
  });

  it("documents the timestamp-bound signing scheme", () => {
    render(
      <WebhookSigningInstructions
        webhookToken="tok_abc"
        signatureVersion={2}
        toleranceSeconds={120}
      />,
    );
    expect(screen.getAllByText(/X-Saas-Timestamp/).length).toBeGreaterThan(0);
    expect(screen.getByText("<timestamp>.<raw body>")).toBeInTheDocument();
    expect(screen.getByText(/older\s+than 120 seconds/)).toBeInTheDocument();
    expect(screen.getByText(/Timestamped signatures required/)).toBeInTheDocument();
    const example = screen.getByLabelText("Signing example").textContent ?? "";
    expect(example).toContain("${timestamp}.${body}");
    expect(example).toContain("v2=${signature}");
    expect(example).not.toMatch(/secret\s*=\s*["']/);
  });

  it("flags legacy connectors and offers the one-way upgrade", () => {
    const onUpgrade = vi.fn();
    render(<WebhookSigningInstructions webhookToken="tok_abc" onUpgrade={onUpgrade} />);
    expect(screen.getByText("Legacy signatures enabled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Require timestamped signatures/ }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("hides the upgrade button when the user cannot update the connector", () => {
    render(<WebhookSigningInstructions webhookToken="tok_abc" signatureVersion={1} />);
    expect(screen.queryByRole("button", { name: /Require timestamped signatures/ })).toBeNull();
  });

  it("builds the example against the given URL", () => {
    expect(signingExample("https://api.example.com/api/v1/webhooks/t")).toContain(
      'fetch("https://api.example.com/api/v1/webhooks/t"',
    );
  });
});
