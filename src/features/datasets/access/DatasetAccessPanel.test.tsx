import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ permissions: [] as string[] }));
const api = vi.hoisted(() => ({
  getDatasetAccess: vi.fn(),
  setDatasetAccess: vi.fn(),
  addRowPolicy: vi.fn(),
  removeRowPolicy: vi.fn(),
  setUserAttributes: vi.fn(),
  previewAsUser: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: () => session }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./api", async (importOriginal) => ({ ...(await importOriginal<object>()), ...api }));

import { parseAttributes } from "./api";
import { DatasetAccessPanel } from "./DatasetAccessPanel";

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DatasetAccessPanel connectorId="c1" />
    </QueryClientProvider>,
  );
}

const access = {
  connectorId: "c1",
  restricted: false,
  grants: [],
  policies: [
    { id: "p1", connectorId: "c1", field: "region", op: "eq", attribute: "region", enabled: true },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getDatasetAccess.mockResolvedValue(access);
});

describe("DatasetAccessPanel", () => {
  it("renders nothing without data_access.view", () => {
    session.permissions = [];
    const { container } = renderPanel();
    expect(container).toBeEmptyDOMElement();
    expect(api.getDatasetAccess).not.toHaveBeenCalled();
  });

  it("is read-only with data_access.view", async () => {
    session.permissions = ["data_access.view"];
    renderPanel();
    expect(await screen.findByText("region = user.region")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add rule/i })).toBeNull();
  });

  it("adds a rule, sets attributes and previews as a member", async () => {
    const user = userEvent.setup();
    session.permissions = ["data_access.view", "data_access.configure"];
    api.addRowPolicy.mockResolvedValue({});
    api.setUserAttributes.mockResolvedValue({});
    api.previewAsUser.mockResolvedValue({
      rows: [],
      total: 1,
      scope: { bypass: false, deniedDatasets: [], rowRules: 1 },
    });
    renderPanel();
    await user.type(await screen.findByLabelText("Field"), "team");
    await user.type(screen.getByLabelText("User attribute"), "teams");
    await user.click(screen.getByRole("button", { name: /add rule/i }));
    await waitFor(() =>
      expect(api.addRowPolicy).toHaveBeenCalledWith("c1", {
        field: "team",
        op: "eq",
        attribute: "teams",
      }),
    );

    await user.type(screen.getByLabelText("Member id"), "u1");
    await user.type(screen.getByLabelText(/Attributes/), "region=EU");
    await user.click(screen.getByRole("button", { name: /save attributes/i }));
    await waitFor(() => expect(api.setUserAttributes).toHaveBeenCalledWith("u1", { region: "EU" }));
    await user.click(screen.getByRole("button", { name: /preview as member/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("This member sees 1 row");
  });
});

describe("parseAttributes", () => {
  it("parses key=value lines with lists", () => {
    expect(parseAttributes("region=EU\nteams=a, b\nbad\n=x")).toEqual({
      region: "EU",
      teams: ["a", "b"],
    });
  });
});
