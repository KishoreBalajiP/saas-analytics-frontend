import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  exportQuery: vi.fn(),
  getExport: vi.fn(),
  downloadExport: vi.fn(),
}));
vi.mock("@/features/analytics/api", () => ({
  exportQuery: (...args: unknown[]) => api.exportQuery(...args),
  getExport: (...args: unknown[]) => api.getExport(...args),
  downloadExport: (...args: unknown[]) => api.downloadExport(...args),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/common/WidgetView", () => ({ WidgetView: () => <div>rows</div> }));

import { QueryResults } from "./QueryResults";

beforeAll(() => {
  // Radix Select needs pointer-capture and scrolling APIs jsdom lacks.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto["hasPointerCapture"] ??= () => false;
  proto["releasePointerCapture"] ??= () => {};
  proto["scrollIntoView"] ??= () => {};
});

beforeEach(() => vi.clearAllMocks());

describe("QueryResults export", () => {
  it("queues an export of the last query and tracks its status", async () => {
    api.exportQuery.mockResolvedValue({
      exportId: "e7",
      status: "pending",
      format: "xlsx",
      accepted: true,
    });
    api.getExport.mockResolvedValue({ exportId: "e7", status: "running", format: "xlsx" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <QueryResults
          result={{ rows: [{ region: "EU", count: 3 }], total: 1, groupMode: "grouped" }}
          meta={{ total: 1 }}
          lastParams={{ connectorIds: ["c1"], page: 2, limit: 50 }}
          canExport
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Export format" }));
    await user.click(await screen.findByRole("option", { name: "XLSX" }));
    expect(api.exportQuery).toHaveBeenCalledWith(
      { connectorIds: ["c1"], page: 2, limit: 50 },
      "xlsx",
    );
    expect(await screen.findByText("Generating…")).toBeInTheDocument();
    expect(api.getExport).toHaveBeenCalledWith("e7");
  });

  it("offers no export without analytics.export", () => {
    render(
      <QueryResults
        result={{ rows: [{ region: "EU" }], total: 1 }}
        meta={{ total: 1 }}
        lastParams={{ connectorIds: ["c1"] }}
      />,
    );
    expect(screen.queryByRole("combobox", { name: "Export format" })).toBeNull();
  });
});
