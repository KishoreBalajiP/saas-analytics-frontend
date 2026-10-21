import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as embedApi from "@/features/embed/api";
import { ApiError } from "@/lib/api/client";

import { EmbedFrame } from "./EmbedFrame";

vi.mock("@/features/embed/api", () => ({ exchangeSession: vi.fn(), viewEmbed: vi.fn() }));
vi.mock("@/components/common/WidgetView", () => ({
  WidgetView: () => <div data-testid="widget" />,
}));
const exchange = vi.mocked(embedApi.exchangeSession);
const view = vi.mocked(embedApi.viewEmbed);

function fakeWindow() {
  const listeners: Array<(e: MessageEvent) => void> = [];
  const parent = { postMessage: vi.fn() };
  const win = {
    parent,
    addEventListener: (_: string, fn: (e: MessageEvent) => void) => listeners.push(fn),
    removeEventListener: vi.fn(),
    matchMedia: () => ({ matches: false }),
  } as unknown as Window;
  const dispatch = (data: unknown, origin = "https://host.test", source: unknown = parent) =>
    act(async () => {
      for (const fn of listeners) fn({ data, origin, source } as MessageEvent);
      await Promise.resolve();
    });
  return { win, parent, dispatch };
}

beforeEach(() => vi.clearAllMocks());

describe("EmbedFrame handshake", () => {
  it("announces ready, exchanges the token with the parent origin and renders", async () => {
    exchange.mockResolvedValue({
      sessionToken: "sess",
      expiresAt: "",
      theme: "dark",
      widgetId: null,
    });
    view.mockResolvedValue({
      dashboard: { id: "d", name: "Sales" },
      widgets: [{ widgetId: "w1", name: "Orders", type: "kpi", result: { rows: [] } as never }],
    });
    const { win, parent, dispatch } = fakeWindow();
    render(<EmbedFrame win={win} />);
    expect(parent.postMessage).toHaveBeenCalledWith({ type: "analivo:ready" }, "*");

    await dispatch({ type: "analivo:init", token: "signed" });
    await waitFor(() => expect(screen.getByText("Sales")).toBeTruthy());
    expect(exchange).toHaveBeenCalledWith("signed", "https://host.test");
    expect(view).toHaveBeenCalledWith("sess", "https://host.test", undefined);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "analivo:loaded" },
      "https://host.test",
    );

    // A second init from another origin is ignored; filters from it too.
    await dispatch({ type: "analivo:init", token: "other" }, "https://evil.test");
    await dispatch({ type: "analivo:set-filters", filters: { filters: [] } }, "https://evil.test");
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(view).toHaveBeenCalledTimes(1);

    await dispatch({
      type: "analivo:set-filters",
      filters: { filters: [{ field: "r", op: "eq", value: "EU" }] },
    });
    await waitFor(() => expect(view).toHaveBeenCalledTimes(2));
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "analivo:filters", filters: { filters: [{ field: "r", op: "eq", value: "EU" }] } },
      "https://host.test",
    );
  });

  it("ignores messages that do not come from the parent window", async () => {
    const { win, dispatch } = fakeWindow();
    render(<EmbedFrame win={win} />);
    await dispatch({ type: "analivo:init", token: "signed" }, "https://host.test", {});
    expect(exchange).not.toHaveBeenCalled();
  });

  it("shows an error state and reports it to the host", async () => {
    exchange.mockRejectedValue(new ApiError("not allowed", 403, "EMBED_ORIGIN_NOT_ALLOWED"));
    const { win, parent, dispatch } = fakeWindow();
    render(<EmbedFrame win={win} />);
    await dispatch({ type: "analivo:init", token: "signed" });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("EMBED_ORIGIN_NOT_ALLOWED"),
    );
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "analivo:error", code: "EMBED_ORIGIN_NOT_ALLOWED", message: "not allowed" },
      "https://host.test",
    );
  });
});
