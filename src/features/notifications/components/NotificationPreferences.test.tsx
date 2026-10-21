// onboarding: preferences come from `data.preferences` (typed channel keys) and are saved.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getPreferences: vi.fn(), updatePreferences: vi.fn() }));
vi.mock("@/features/notifications/api", () => api);
vi.mock("@/lib/auth/session", () => ({
  useTenantSession: () => ({ permissions: ["notifications.view", "notifications.update"] }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { NotificationPreferences } from "./NotificationsView";

describe("NotificationPreferences", () => {
  it("reads the persisted preferences key and saves a toggle", async () => {
    api.getPreferences.mockResolvedValue({ preferences: { in_app: true, email: false } });
    api.updatePreferences.mockResolvedValue({ preferences: { in_app: false, email: false } });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NotificationPreferences />
      </QueryClientProvider>,
    );
    const switches = await screen.findAllByRole("switch");
    expect(switches[0]).toHaveAttribute("aria-checked", "false"); // email
    expect(switches[1]).toHaveAttribute("aria-checked", "true"); // in_app
    fireEvent.click(switches[1]!);
    await waitFor(() =>
      expect(api.updatePreferences).toHaveBeenCalledWith(
        { in_app: false, email: false },
        expect.anything(),
      ),
    );
  });
});
