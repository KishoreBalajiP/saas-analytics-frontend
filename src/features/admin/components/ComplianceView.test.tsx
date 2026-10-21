import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUDITOR_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
  adminSessionFor,
} from "@/features/admin/__fixtures__/platformRoles";

const api = vi.hoisted(() => ({
  listComplianceRequests: vi.fn(),
  createComplianceRequest: vi.fn(),
  cancelComplianceRequest: vi.fn(),
}));
vi.mock("@/features/admin/api", () => api);
const session = vi.hoisted(() => ({ useAdminSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => session);

import { ComplianceView } from "./ComplianceView";

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ComplianceView />
    </QueryClientProvider>,
  );
}

const ROWS = [
  {
    requestId: "crq_received",
    type: "export",
    status: "received",
    subjectId: "usr_1",
    subjectType: "user",
    subjectEmail: "subject@example.test",
    createdAt: "2026-10-20T10:00:00.000Z",
  },
  {
    requestId: "crq_done",
    type: "delete",
    status: "completed",
    subjectId: "usr_2",
    subjectType: "user",
    createdAt: "2026-10-19T10:00:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.listComplianceRequests.mockResolvedValue({
    data: ROWS,
    meta: { page: 1, limit: 20, total: 2, pages: 1 },
  });
  api.createComplianceRequest.mockResolvedValue({ requestId: "crq_new", status: "received" });
  api.cancelComplianceRequest.mockResolvedValue({ requestId: "crq_received", status: "cancelled" });
});

describe("ComplianceView", () => {
  it("lists live requests (no 'coming soon') and is read-only for auditors", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(AUDITOR_PERMISSIONS));
    renderView();
    expect(await screen.findByText("crq_received")).toBeInTheDocument();
    expect(screen.getByText("crq_done")).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /file request/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("refuses without compliance.view and never calls the API", () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(["support.view"]));
    renderView();
    expect(api.listComplianceRequests).not.toHaveBeenCalled();
    expect(screen.queryByText("crq_received")).not.toBeInTheDocument();
  });

  it("lets a super admin file a request with the backend contract", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(SUPER_ADMIN_PERMISSIONS));
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole("button", { name: /file request/i }));
    await user.type(screen.getByLabelText("Subject ID"), "usr_9");
    await user.selectOptions(screen.getByLabelText("Request type"), "delete");
    await user.type(screen.getByLabelText(/Reason/), "Subject asked for erasure");
    const submit = screen
      .getAllByRole("button", { name: /file request/i })
      .find((button) => button.getAttribute("type") === "submit");
    await user.click(submit!);
    await waitFor(() =>
      expect(api.createComplianceRequest).toHaveBeenCalledWith({
        subjectId: "usr_9",
        subjectType: "user",
        type: "delete",
        reason: "Subject asked for erasure",
      }),
    );
  });

  it("files inside the admin's tenant scope", async () => {
    session.useAdminSession.mockReturnValue(
      adminSessionFor(SUPER_ADMIN_PERMISSIONS, { scope: { type: "tenant", tenantId: "ten_A" } }),
    );
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole("button", { name: /file request/i }));
    await user.type(screen.getByLabelText("Subject ID"), "usr_9");
    await user.type(screen.getByLabelText(/Reason/), "Scoped request");
    const submit = screen
      .getAllByRole("button", { name: /file request/i })
      .find((button) => button.getAttribute("type") === "submit");
    await user.click(submit!);
    await waitFor(() =>
      expect(api.createComplianceRequest).toHaveBeenCalledWith(
        expect.objectContaining({ tenantScope: ["ten_A"] }),
      ),
    );
  });

  it("offers cancel only for not-yet-started requests and confirms first", async () => {
    session.useAdminSession.mockReturnValue(adminSessionFor(SUPER_ADMIN_PERMISSIONS));
    const user = userEvent.setup();
    renderView();
    const cancelButtons = await screen.findAllByRole("button", { name: "Cancel" });
    expect(cancelButtons).toHaveLength(1);
    await user.click(cancelButtons[0]!);
    expect(api.cancelComplianceRequest).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Cancel request" }));
    await waitFor(() =>
      expect(api.cancelComplianceRequest).toHaveBeenCalledWith("crq_received", undefined),
    );
  });
});
