import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = vi.hoisted(() => ({ previewNewFile: vi.fn(), importFile: vi.fn() }));
vi.mock("@/features/datasets/api", () => api);

import { ApiError } from "@/lib/api/client";
import { datasetNameFromFile } from "@/features/datasets/lib/fileImport";
import { ImportFileDialog } from "./ImportFileDialog";

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ImportFileDialog open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

const csv = () => new File(["region,amount\nEU,10\n"], "Q3_sales.csv", { type: "text/csv" });

beforeEach(() => {
  vi.clearAllMocks();
  api.previewNewFile.mockResolvedValue({
    type: "csv",
    filename: "Q3_sales.csv",
    fields: ["region", "amount"],
    sample: [{ region: "EU", amount: "10" }],
    meta: { hasHeader: true },
  });
});

describe("ImportFileDialog", () => {
  it("previews the chosen file, names the dataset from it and creates it", async () => {
    const user = userEvent.setup();
    api.importFile.mockResolvedValue({
      connector: { _id: "c9", name: "Q3 sales" },
      sync: { accepted: true },
    });
    renderDialog();
    const file = csv();
    await user.upload(screen.getByLabelText("File"), file);

    await waitFor(() => expect(api.previewNewFile).toHaveBeenCalledWith(file, { hasHeader: true }));
    expect(await screen.findByRole("columnheader", { name: "amount" })).toBeInTheDocument();
    expect(screen.getByLabelText("Dataset name")).toHaveValue("Q3 sales");

    await user.click(screen.getByRole("button", { name: /create dataset/i }));
    await waitFor(() =>
      expect(api.importFile).toHaveBeenCalledWith(file, { name: "Q3 sales", hasHeader: true }),
    );
    expect(navigate).toHaveBeenCalledWith({
      to: "/datasets/$connectorId",
      params: { connectorId: "c9" },
    });
  });

  it("re-previews with the chosen worksheet of a multi-sheet workbook", async () => {
    const user = userEvent.setup();
    api.previewNewFile.mockResolvedValue({
      type: "xlsx",
      filename: "book.xlsx",
      fields: ["note"],
      sample: [{ note: "x" }],
      meta: { sheetName: "Summary", sheets: ["Summary", "Data"] },
    });
    renderDialog();
    const book = new File(["PK"], "book.xlsx");
    await user.upload(screen.getByLabelText("File"), book);
    await user.selectOptions(await screen.findByLabelText("Worksheet"), "Data");
    await waitFor(() =>
      expect(api.previewNewFile).toHaveBeenLastCalledWith(book, { hasHeader: true, sheet: "Data" }),
    );
  });

  it("refuses legacy .xls before uploading and explains a taken name", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderDialog();
    await user.upload(screen.getByLabelText("File"), new File(["x"], "old.xls"));
    expect(
      await screen.findByText(/legacy \.xls workbooks are not supported/i),
    ).toBeInTheDocument();
    expect(api.previewNewFile).not.toHaveBeenCalled();

    api.importFile.mockRejectedValue(
      new ApiError(
        'A dataset named "Q3 sales" already exists. Choose another name.',
        409,
        "DATASET_NAME_TAKEN",
      ),
    );
    await user.upload(screen.getByLabelText("File"), csv());
    await screen.findByRole("columnheader", { name: "amount" });
    await user.click(screen.getByRole("button", { name: /create dataset/i }));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("derives a readable default name", () => {
    expect(datasetNameFromFile("orders_2026-q3.xlsx")).toBe("orders 2026 q3");
  });
});
