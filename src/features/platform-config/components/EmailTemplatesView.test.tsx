import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { EmailTemplate } from "@/features/platform-config/types";

const api = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  updateTemplate: vi.fn(),
  resetTemplate: vi.fn(),
  previewTemplate: vi.fn(),
  templateHistory: vi.fn(),
  rollbackTemplate: vi.fn(),
}));
vi.mock("@/features/platform-config/api", () => ({
  ...api,
  configKeys: {
    templates: (locale: string) => ["admin", "config", "templates", locale],
    templateHistory: (key: string, locale: string) => [
      "admin",
      "config",
      "templates",
      locale,
      key,
      "history",
    ],
  },
}));
vi.mock("@/lib/auth/session", () => ({ useAdminSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAdminSession } from "@/lib/auth/session";
import { EmailTemplatesView } from "./EmailTemplatesView";

function asAdmin(permissions: string[]) {
  vi.mocked(useAdminSession).mockReturnValue({
    status: "authenticated",
    permissions,
    hasPermission: (key: string) => permissions.includes(key),
  } as never);
}

const builtIn = {
  subject: "Reset your password",
  text: "Use this link: {{resetUrl}}",
  html: null,
};
const reset: EmailTemplate = {
  key: "auth.password_reset",
  name: "Password reset",
  description: "Sent when a password reset is requested.",
  locale: "en",
  variables: [
    { key: "resetUrl", description: "Reset link", required: true, sample: "https://x" },
    {
      key: "expiresInMinutes",
      description: "Minutes",
      required: false,
      sample: "15",
      default: "15",
    },
  ],
  customized: false,
  version: 0,
  updatedAt: null,
  updatedBy: null,
  builtIn,
  override: null,
  effective: builtIn,
};

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EmailTemplatesView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listTemplates.mockResolvedValue([reset]);
  api.templateHistory.mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 50, total: 0, pages: 1 },
  });
});

describe("EmailTemplatesView", () => {
  it("is gated behind email_templates.view", () => {
    asAdmin(["settings.view"]);
    renderView();
    expect(screen.getByRole("heading", { name: /permission required/i })).toBeInTheDocument();
    expect(api.listTemplates).not.toHaveBeenCalled();
  });

  it("previews the current draft with sample data (nothing is sent)", async () => {
    asAdmin(["email_templates.view"]);
    api.previewTemplate.mockResolvedValue({
      key: "auth.password_reset",
      locale: "en",
      source: "draft",
      subject: "Reset your password",
      text: "Use this link: https://x",
      html: "<p>https://x</p>",
      variables: { resetUrl: "https://x" },
    });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /password reset/i }));
    expect(screen.getByLabelText("Subject")).toBeDisabled();
    expect(screen.getByText(/needs the email_templates\.update permission/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    expect(await screen.findByText("Use this link: https://x")).toBeInTheDocument();
    expect(api.previewTemplate).toHaveBeenCalledWith("auth.password_reset", {
      locale: "en",
      draft: builtIn,
    });
    const frame = screen.getByTitle("HTML preview");
    expect(frame).toHaveAttribute("sandbox", "");
  });

  it("saves an override with its version and shows variable errors from the server", async () => {
    asAdmin(["email_templates.view", "email_templates.update"]);
    api.updateTemplate.mockRejectedValueOnce(
      new ApiError("Invalid email template", 400, "EMAIL_TEMPLATE_INVALID", [
        { field: "text", message: 'must include the required variable "{{resetUrl}}"' },
      ]),
    );
    api.updateTemplate.mockResolvedValueOnce({ ...reset, customized: true, version: 1 });
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: /password reset/i }));
    fireEvent.change(screen.getByLabelText("Plain-text body"), {
      target: { value: "No link here" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save override/i }));
    expect(await screen.findByText(/text: must include the required variable/)).toBeInTheDocument();
    expect(api.updateTemplate).toHaveBeenCalledWith("auth.password_reset", {
      subject: "Reset your password",
      text: "No link here",
      html: null,
      locale: "en",
      version: 0,
      reason: undefined,
    });

    fireEvent.change(screen.getByLabelText("Plain-text body"), {
      target: { value: "Reset: {{resetUrl}}" },
    });
    fireEvent.change(screen.getByLabelText("HTML body (optional)"), {
      target: { value: "<a href='{{resetUrl}}'>Reset</a>" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save override/i }));
    await waitFor(() =>
      expect(api.updateTemplate).toHaveBeenLastCalledWith("auth.password_reset", {
        subject: "Reset your password",
        text: "Reset: {{resetUrl}}",
        html: "<a href='{{resetUrl}}'>Reset</a>",
        locale: "en",
        version: 0,
        reason: undefined,
      }),
    );
  });

  it("switches locale and offers 'Use built-in' for customized templates", async () => {
    asAdmin(["email_templates.view", "email_templates.update"]);
    const custom = {
      ...reset,
      locale: "de" as const,
      customized: true,
      version: 2,
      override: { subject: "Passwort", text: "Link: {{resetUrl}}", html: null },
      effective: { subject: "Passwort", text: "Link: {{resetUrl}}", html: null },
    };
    api.listTemplates.mockImplementation(async (locale: string) =>
      locale === "de" ? [custom] : [reset],
    );
    api.resetTemplate.mockResolvedValue({ ...reset, locale: "de", version: 3 });
    renderView();
    fireEvent.change(await screen.findByLabelText("Locale"), { target: { value: "de" } });
    fireEvent.click(await screen.findByRole("button", { name: /customized · v2/i }));
    expect(screen.getByLabelText("Subject")).toHaveValue("Passwort");
    fireEvent.click(screen.getByRole("button", { name: /use built-in/i }));
    await waitFor(() =>
      expect(api.resetTemplate).toHaveBeenCalledWith("auth.password_reset", {
        locale: "de",
        version: 2,
      }),
    );
  });
});
