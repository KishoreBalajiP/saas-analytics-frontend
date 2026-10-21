import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { PlatformSetting } from "@/features/platform-config/types";

const api = vi.hoisted(() => ({
  listSettings: vi.fn(),
  updateSetting: vi.fn(),
  resetSetting: vi.fn(),
  rollbackSetting: vi.fn(),
  revealSecret: vi.fn(),
  settingHistory: vi.fn(),
}));
vi.mock("@/features/platform-config/api", () => ({
  ...api,
  configKeys: {
    settings: ["admin", "config", "settings"],
    settingHistory: (key: string) => ["admin", "config", "settings", key, "history"],
  },
}));
vi.mock("@/lib/auth/session", () => ({ useAdminSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAdminSession } from "@/lib/auth/session";
import { PlatformSettingsView } from "./PlatformSettingsView";

function asAdmin(permissions: string[]) {
  vi.mocked(useAdminSession).mockReturnValue({
    status: "authenticated",
    permissions,
    hasPermission: (key: string) => permissions.includes(key),
  } as never);
}

const color: PlatformSetting = {
  key: "branding.primary_color",
  group: "branding",
  type: "string",
  description: "Primary brand colour.",
  isSecret: false,
  isReadonly: false,
  defaultValue: "#2563eb",
  value: "#111111",
  version: 2,
  updatedAt: null,
  updatedBy: null,
  source: "platform",
};
const secret: PlatformSetting = {
  key: "email.smtp_password",
  group: "email",
  type: "string",
  description: "SMTP password.",
  isSecret: true,
  isReadonly: false,
  defaultValue: null,
  value: null,
  redacted: true,
  hasValue: true,
  version: 1,
  updatedAt: null,
  updatedBy: null,
  source: "platform",
};
const readOnly: PlatformSetting = {
  ...color,
  key: "security.password_min_length",
  group: "security",
  type: "number",
  isReadonly: true,
  value: 8,
  defaultValue: 8,
  version: 0,
  source: "default",
};

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlatformSettingsView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listSettings.mockResolvedValue({
    data: [color, secret, readOnly],
    groups: ["branding", "email", "security"],
  });
  api.settingHistory.mockResolvedValue({
    data: [
      {
        version: 2,
        action: "update",
        state: { value: "#111111" },
        isSecret: false,
        rolledBackFrom: null,
        reason: "rebrand",
        changedBy: { type: "admin", id: "a1" },
        createdAt: "2026-10-20T10:00:00.000Z",
      },
      {
        version: 0,
        action: "baseline",
        state: { value: "#2563eb" },
        isSecret: false,
        rolledBackFrom: null,
        reason: null,
        changedBy: { type: "system", id: null },
        createdAt: "2026-10-19T10:00:00.000Z",
      },
    ],
    meta: { page: 1, limit: 50, total: 2, pages: 1 },
  });
});

describe("PlatformSettingsView", () => {
  it("is gated behind settings.view", () => {
    asAdmin(["monitoring.view"]);
    renderView();
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
    expect(api.listSettings).not.toHaveBeenCalled();
  });

  it("lists settings with secrets masked and badges for defaults and read-only keys", async () => {
    asAdmin(["settings.view"]);
    renderView();
    expect(await screen.findByText("branding.primary_color")).toBeInTheDocument();
    expect(screen.getByText("#111111")).toBeInTheDocument();
    expect(screen.getByText(/•••••••• \(set\)/)).toBeInTheDocument();
    expect(screen.getByText("read-only")).toBeInTheDocument();
    expect(screen.getByText("default")).toBeInTheDocument();
  });

  it("saves a change with the version it was read at and shows server field errors", async () => {
    asAdmin(["settings.view", "settings.update"]);
    api.updateSetting.mockRejectedValueOnce(
      new ApiError("Invalid value", 400, "BAD_REQUEST", [
        { field: "branding.primary_color", message: 'must be a hex colour such as "#2563eb"' },
      ]),
    );
    api.updateSetting.mockResolvedValueOnce({ ...color, value: "#222222", version: 3 });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Open branding.primary_color" }));
    const input = screen.getByLabelText("Platform value");
    expect(input).toHaveValue("#111111");
    fireEvent.change(input, { target: { value: "blue" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/must be a hex colour/)).toBeInTheDocument();
    expect(api.updateSetting).toHaveBeenCalledWith("branding.primary_color", {
      value: "blue",
      version: 2,
      reason: undefined,
    });

    fireEvent.change(input, { target: { value: "#222222" } });
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "new brand" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(api.updateSetting).toHaveBeenLastCalledWith("branding.primary_color", {
        value: "#222222",
        version: 2,
        reason: "new brand",
      }),
    );
  });

  it("restores an earlier version from the history", async () => {
    asAdmin(["settings.view", "settings.update"]);
    api.rollbackSetting.mockResolvedValue({ ...color, value: "#2563eb", version: 3 });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Open branding.primary_color" }));
    const history = await screen.findByRole("list", { name: /history versions/i });
    expect(within(history).getByText("rebrand", { exact: false })).toBeInTheDocument();
    expect(within(history).queryByRole("button", { name: /restore v2/i })).not.toBeInTheDocument();
    fireEvent.click(within(history).getByRole("button", { name: /restore v0/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^restore$/i }));
    await waitFor(() =>
      expect(api.rollbackSetting).toHaveBeenCalledWith("branding.primary_color", {
        toVersion: 0,
        version: 2,
      }),
    );
  });

  it("read-only settings and viewers cannot edit", async () => {
    asAdmin(["settings.view"]);
    renderView();
    fireEvent.click(
      await screen.findByRole("button", { name: "Open security.password_min_length" }),
    );
    expect(screen.getByLabelText("Platform value")).toBeDisabled();
    expect(screen.getByText(/managed in code/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
  });

  it("secrets: editing needs settings.secrets.update and revealing needs settings.secrets.view", async () => {
    asAdmin(["settings.view", "settings.update"]);
    const { unmount } = renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Open email.smtp_password" }));
    expect(screen.getByLabelText("New secret value")).toBeDisabled();
    expect(screen.getByText(/needs the settings\.secrets\.update permission/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reveal/i })).not.toBeInTheDocument();
    unmount();

    asAdmin([
      "settings.view",
      "settings.update",
      "settings.secrets.view",
      "settings.secrets.update",
    ]);
    api.revealSecret.mockResolvedValue({ ...secret, value: "hunter2" });
    api.updateSetting.mockResolvedValue({ ...secret, version: 2 });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Open email.smtp_password" }));
    const field = screen.getByLabelText("New secret value");
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveValue("");
    expect(screen.getByLabelText("Stored secret")).toHaveValue("••••••••");
    fireEvent.click(screen.getByRole("button", { name: /reveal/i }));
    await waitFor(() => expect(screen.getByLabelText("Stored secret")).toHaveValue("hunter2"));
    fireEvent.click(screen.getByRole("button", { name: /hide/i }));
    expect(screen.getByLabelText("Stored secret")).toHaveValue("••••••••");

    fireEvent.change(field, { target: { value: "n3w-s3cret" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(api.updateSetting).toHaveBeenCalledWith("email.smtp_password", {
        value: "n3w-s3cret",
        version: 1,
        reason: undefined,
      }),
    );
  });
});
