import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  changePassword: vi.fn(),
  listMySessions: vi.fn(),
  revokeMySession: vi.fn(),
  updateTenantProfile: vi.fn(),
}));
vi.mock("@/features/auth/api", () => api);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PasswordForm, ProfileForm, SessionsPanel } from "./ProfilePanels";

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      {ui}
    </QueryClientProvider>,
  );

beforeEach(() => vi.clearAllMocks());

describe("PasswordForm", () => {
  it("sends the current and new password and shows server field errors", async () => {
    api.changePassword.mockRejectedValue(
      new ApiError("Current password is incorrect", 400, "VALIDATION_ERROR", [
        { field: "currentPassword", message: "Current password is incorrect" },
      ]),
    );
    wrap(<PasswordForm />);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-pass" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword1!" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewPassword1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(api.changePassword).toHaveBeenCalledWith({
        currentPassword: "old-pass",
        newPassword: "NewPassword1!",
      }),
    );
    expect(
      await screen.findByText(/currentPassword: Current password is incorrect/),
    ).toBeInTheDocument();
  });

  it("refuses mismatched confirmation locally", () => {
    wrap(<PasswordForm />);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "old-pass" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPassword1!" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "Different1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("The new passwords do not match.")).toBeInTheDocument();
    expect(api.changePassword).not.toHaveBeenCalled();
  });
});

describe("SessionsPanel", () => {
  it("lists sessions and signs out another device", async () => {
    api.listMySessions.mockResolvedValue([
      {
        sessionId: "s1",
        current: true,
        device: "Chrome",
        ip: "1.1.1.1",
        userAgent: null,
        signedInAt: null,
        lastUsedAt: null,
        impersonated: false,
      },
      {
        sessionId: "s2",
        current: false,
        device: "Firefox",
        ip: "2.2.2.2",
        userAgent: null,
        signedInAt: null,
        lastUsedAt: null,
        impersonated: false,
      },
    ]);
    api.revokeMySession.mockResolvedValue(undefined);
    wrap(<SessionsPanel />);
    expect(await screen.findByText("This device")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(api.revokeMySession).toHaveBeenCalledWith("s2"));
  });
});

describe("ProfileForm", () => {
  it("saves name and time zone", async () => {
    const onSaved = vi.fn();
    api.updateTenantProfile.mockResolvedValue({
      id: "u1",
      email: "a@x.io",
      profile: { name: "New" },
    });
    wrap(
      <ProfileForm
        me={{ id: "u1", email: "a@x.io", profile: { name: "Old", timezone: "UTC" } }}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(api.updateTenantProfile).toHaveBeenCalledWith({ name: "New", timezone: "UTC" }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
