import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { FeatureFlag } from "@/features/platform-config/types";

const api = vi.hoisted(() => ({
  listFlags: vi.fn(),
  createFlag: vi.fn(),
  updateFlag: vi.fn(),
  deleteFlag: vi.fn(),
  flagHistory: vi.fn(),
  rollbackFlag: vi.fn(),
  previewFlags: vi.fn(),
}));
vi.mock("@/features/platform-config/api", () => ({
  ...api,
  configKeys: {
    flags: ["admin", "config", "flags"],
    flagHistory: (key: string) => ["admin", "config", "flags", key, "history"],
  },
}));
vi.mock("@/lib/auth/session", () => ({ useAdminSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAdminSession } from "@/lib/auth/session";
import { FeatureFlagsView } from "./FeatureFlagsView";

const ALL = [
  "feature_flags.view",
  "feature_flags.create",
  "feature_flags.update",
  "feature_flags.delete",
];

function asAdmin(permissions: string[]) {
  vi.mocked(useAdminSession).mockReturnValue({
    status: "authenticated",
    permissions,
    hasPermission: (key: string) => permissions.includes(key),
  } as never);
}

const base: FeatureFlag = {
  id: "f1",
  key: "beta.reports",
  name: "Beta reports",
  description: "",
  type: "boolean",
  enabled: true,
  rollout: { strategy: "tenantId", tenantIds: ["0123456789abcdef01234567"], percentage: 100 },
  isReadonly: false,
  isSystem: false,
  version: 3,
  updatedBy: null,
  createdAt: null,
  updatedAt: null,
};
const system: FeatureFlag = {
  ...base,
  id: "f2",
  key: "analytics.realtime",
  name: "Realtime analytics",
  rollout: { strategy: "all", tenantIds: [], percentage: 100 },
  isSystem: true,
  version: 0,
};

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeatureFlagsView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listFlags.mockResolvedValue({
    data: [base, system],
    meta: { page: 1, limit: 100, total: 2, pages: 1 },
  });
  api.flagHistory.mockResolvedValue({
    data: [
      {
        version: 3,
        action: "update",
        state: { enabled: true, rollout: base.rollout, deleted: false },
        isSecret: false,
        rolledBackFrom: null,
        reason: null,
        changedBy: { type: "admin", id: "a1" },
        createdAt: null,
      },
      {
        version: 1,
        action: "create",
        state: {
          enabled: false,
          rollout: { strategy: "all", tenantIds: [], percentage: 100 },
          deleted: false,
        },
        isSecret: false,
        rolledBackFrom: null,
        reason: null,
        changedBy: { type: "admin", id: "a1" },
        createdAt: null,
      },
    ],
    meta: { page: 1, limit: 50, total: 2, pages: 1 },
  });
});

describe("FeatureFlagsView", () => {
  it("is gated behind feature_flags.view", () => {
    asAdmin(["settings.view"]);
    renderView();
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
    expect(api.listFlags).not.toHaveBeenCalled();
  });

  it("lists flags with their rollout and hides create without feature_flags.create", async () => {
    asAdmin(["feature_flags.view"]);
    renderView();
    expect(await screen.findByText("beta.reports")).toBeInTheDocument();
    expect(screen.getByText("1 workspace")).toBeInTheDocument();
    expect(screen.getByText("Every workspace")).toBeInTheDocument();
    expect(screen.getByText("system")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new flag/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open beta.reports" }));
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("switches a flag to a percentage rollout with the version it was read at", async () => {
    asAdmin(ALL);
    api.updateFlag.mockResolvedValue({
      ...base,
      rollout: { ...base.rollout, strategy: "percentage", percentage: 25 },
      version: 4,
    });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Open beta.reports" }));
    expect(screen.getByLabelText(/workspace ids/i)).toHaveValue("0123456789abcdef01234567");
    fireEvent.change(screen.getByLabelText("Rollout"), { target: { value: "percentage" } });
    fireEvent.change(screen.getByLabelText(/percentage of workspaces/i), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(api.updateFlag).toHaveBeenCalledWith("beta.reports", {
        name: "Beta reports",
        description: "",
        enabled: true,
        rollout: { strategy: "percentage", percentage: 25 },
        version: 3,
        reason: undefined,
      }),
    );
  });

  it("shows server field errors (e.g. an unknown allow-listed workspace)", async () => {
    asAdmin(ALL);
    api.updateFlag.mockRejectedValue(
      new ApiError("Invalid feature flag", 400, "BAD_REQUEST", [
        { field: "rollout.tenantIds[1]", message: "tenant abc does not exist" },
      ]),
    );
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Open beta.reports" }));
    fireEvent.change(screen.getByLabelText(/workspace ids/i), {
      target: { value: "0123456789abcdef01234567\nabc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(
      await screen.findByText(/rollout\.tenantIds\[1\]: tenant abc does not exist/),
    ).toBeInTheDocument();
    expect(api.updateFlag).toHaveBeenCalledWith(
      "beta.reports",
      expect.objectContaining({
        rollout: { strategy: "tenantId", tenantIds: ["0123456789abcdef01234567", "abc"] },
      }),
    );
  });

  it("creates a flag (disabled by default)", async () => {
    asAdmin(ALL);
    api.createFlag.mockResolvedValue({ ...base, key: "beta.new", enabled: false, version: 1 });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /new flag/i }));
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "beta.new" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New beta" } });
    fireEvent.click(screen.getByRole("button", { name: /create flag/i }));
    await waitFor(() =>
      expect(api.createFlag).toHaveBeenCalledWith({
        key: "beta.new",
        name: "New beta",
        description: "",
      }),
    );
  });

  it("system flags cannot be deleted; custom flags can, after confirmation", async () => {
    asAdmin(ALL);
    api.deleteFlag.mockResolvedValue({ key: "beta.reports", deleted: true, version: 4 });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Open analytics.realtime" }));
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open beta.reports" }));
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() =>
      expect(api.deleteFlag).toHaveBeenCalledWith("beta.reports", { version: 3 }),
    );
  });

  it("restores an earlier version from the history", async () => {
    asAdmin(ALL);
    api.rollbackFlag.mockResolvedValue({ ...base, version: 4 });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Open beta.reports" }));
    const history = await screen.findByRole("list", { name: /history versions/i });
    expect(within(history).getByText("Off everywhere")).toBeInTheDocument();
    fireEvent.click(within(history).getByRole("button", { name: /restore v1/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^restore$/i }));
    await waitFor(() =>
      expect(api.rollbackFlag).toHaveBeenCalledWith("beta.reports", { toVersion: 1, version: 3 }),
    );
  });

  it("previews the flags a workspace gets", async () => {
    asAdmin(ALL);
    api.previewFlags.mockResolvedValue([
      { key: "beta.reports", name: "Beta reports", value: false, reason: "not_in_allow_list" },
    ]);
    renderView();
    fireEvent.change(await screen.findByLabelText("Workspace id"), {
      target: { value: "fedcba9876543210fedcba98" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    const outcomes = await screen.findByRole("list", { name: /flag outcomes/i });
    expect(within(outcomes).getByText("not in allow list")).toBeInTheDocument();
    expect(api.previewFlags).toHaveBeenCalledWith("fedcba9876543210fedcba98");
  });
});
