import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children?: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
const ai = vi.hoisted(() => ({
  status: vi.fn(),
  ask: vi.fn(),
  setConsent: vi.fn(),
  feedback: vi.fn(),
}));
vi.mock("@/features/ai/api", () => ai);

import { AskWidgetPanel } from "./AskWidgetPanel";

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AskWidgetPanel dashboardId="d1" onAdded={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("AskWidgetPanel", () => {
  it("explains the real reason Ask is unavailable and points back to the visual builder", async () => {
    ai.status.mockResolvedValue({
      available: false,
      reason: "AI_MODEL_INVALID",
      action:
        "AI_MODEL is not a Gemini model id. A platform operator must set AI_MODEL to a Gemini model (for example gemini-2.5-flash).",
      providerConfigured: false,
      consent: true,
      enabled: true,
      killSwitch: false,
    });
    renderPanel();
    expect(await screen.findByText(/AI_MODEL is not a Gemini model id/)).toBeInTheDocument();
    expect(screen.getByText(/build the widget visually/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^ask$/i })).not.toBeInTheDocument();
  });

  it("asks when available", async () => {
    ai.status.mockResolvedValue({ available: true, consent: true, providerConfigured: true });
    renderPanel();
    expect(await screen.findByRole("button", { name: /^ask$/i })).toBeDisabled();
  });
});
