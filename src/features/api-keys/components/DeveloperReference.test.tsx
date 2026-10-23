import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ openApi: vi.fn() }));
vi.mock("@/features/api-keys/api", () => api);

import { DeveloperReference } from "./DeveloperReference";

beforeEach(() => vi.clearAllMocks());

describe("DeveloperReference", () => {
  it("renders operations from the OpenAPI spec with copyable examples", async () => {
    api.openApi.mockResolvedValue({
      openapi: "3.1.0",
      info: { title: "Analivo External API", version: "1.0.0", description: "desc" },
      servers: [{ url: "/api/v1/external/v1" }],
      paths: {
        "/datasets": {
          get: {
            summary: "List datasets",
            "x-scope": "datasets:read",
            responses: {
              "200": {
                description: "Datasets",
                content: { "application/json": { example: { ok: 1 } } },
              },
            },
            "x-codeSamples": [{ lang: "curl", source: "curl -H X-Api-Key https://x/datasets" }],
          },
        },
      },
      "x-errorCodes": { INVALID_API_KEY: { status: 401, description: "bad key" } },
    });
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DeveloperReference />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("List datasets")).toBeInTheDocument();
    expect(screen.getByText("datasets:read")).toBeInTheDocument();
    expect(screen.getByText("INVALID_API_KEY")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Copy curl example for GET /datasets"));
    expect(writeText).toHaveBeenCalledWith("curl -H X-Api-Key https://x/datasets");
  });

  it("shows an error state when the spec cannot load", async () => {
    api.openApi.mockRejectedValue(new Error("down"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DeveloperReference />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("withRealBaseUrl", () => {
  it("replaces the spec placeholder host with the deployment origin", async () => {
    const { withRealBaseUrl } = await import("./DeveloperReference");
    expect(
      withRealBaseUrl(
        'curl "https://api.analivo.example/api/v1/external/v1/datasets"',
        "https://app.test",
      ),
    ).toBe('curl "https://app.test/api/v1/external/v1/datasets"');
  });
});
