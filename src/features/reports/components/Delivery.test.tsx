import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listDeliveries: vi.fn(),
  retryDelivery: vi.fn(),
  listDestinations: vi.fn(),
  createDestination: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@/features/reports/api/delivery", () => api);
vi.mock("../api/delivery", () => api);
vi.mock("@/components/common/Brand", () => ({ Brand: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { DeliveryHistory } from "./DeliveryHistory";
import { DeliveryFields } from "./DeliveryFields";
import { parseEmails } from "../lib/recipients";
import { UnsubscribeCard } from "@/routes/unsubscribe";

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("delivery UI", () => {
  it("lists deliveries with statuses and retries a dead one", async () => {
    api.listDeliveries.mockResolvedValue({
      data: [
        {
          _id: "d1",
          kind: "report",
          destinationType: "email",
          recipient: "a@x.com",
          status: "sent",
          attempts: 1,
        },
        {
          _id: "d2",
          kind: "report",
          destinationType: "slack",
          recipient: "Ops",
          status: "dead",
          attempts: 5,
          lastError: "HTTP_404: no",
        },
      ],
      meta: { page: 1, limit: 50, total: 2, pages: 1 },
    });
    api.retryDelivery.mockResolvedValue({ _id: "d2", status: "sent" });
    wrap(<DeliveryHistory reportId="r1" canRetry />);
    expect(await screen.findByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByText("dead")).toBeInTheDocument();
    expect(screen.getByText("HTTP_404: no")).toBeInTheDocument();
    expect(api.listDeliveries).toHaveBeenCalledWith({ sourceId: "r1", limit: 50 });
    fireEvent.click(screen.getByRole("button", { name: "Retry delivery to Ops" }));
    await waitFor(() => expect(api.retryDelivery).toHaveBeenCalledWith("d2"));
    expect(screen.queryByRole("button", { name: "Retry delivery to a@x.com" })).toBeNull();
  });

  it("hides retry without export permission", async () => {
    api.listDeliveries.mockResolvedValue({
      data: [
        {
          _id: "d2",
          kind: "report",
          destinationType: "slack",
          recipient: "Ops",
          status: "dead",
          attempts: 5,
        },
      ],
      meta: { page: 1, limit: 50, total: 1, pages: 1 },
    });
    wrap(<DeliveryHistory reportId="r1" canRetry={false} />);
    expect(await screen.findByText("Ops")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
  });

  it("adds a destination, selects it and shows the signing secret once", async () => {
    api.listDestinations.mockResolvedValue([
      { _id: "x1", type: "slack", name: "Ops", urlHint: "hooks.slack.com" },
    ]);
    api.createDestination.mockResolvedValue({
      _id: "x2",
      type: "webhook",
      name: "Hook",
      urlHint: "h.example.com",
      signingSecret: "s3cr3t",
    });
    function Harness() {
      const [ids, setIds] = useState<string[]>([]);
      const [emails, setEmails] = useState("");
      return (
        <>
          <DeliveryFields
            externalEmails={emails}
            onExternalEmails={setEmails}
            destinationIds={ids}
            onDestinationIds={setIds}
          />
          <output data-testid="ids">{ids.join(",")}</output>
        </>
      );
    }
    wrap(<Harness />);
    expect(await screen.findByText(/hooks.slack.com/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Destination type"), { target: { value: "webhook" } });
    fireEvent.change(screen.getByLabelText("Destination name"), { target: { value: "Hook" } });
    fireEvent.change(screen.getByLabelText("Destination URL"), {
      target: { value: "https://h.example.com/x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add destination" }));
    await waitFor(() =>
      expect(api.createDestination).toHaveBeenCalledWith({
        type: "webhook",
        name: "Hook",
        url: "https://h.example.com/x",
      }),
    );
    expect(await screen.findByText("s3cr3t")).toBeInTheDocument();
    expect(screen.getByTestId("ids").textContent).toBe("x2");
  });

  it("parses external recipient emails", () => {
    expect(parseEmails("a@x.com, b@y.org;c@z.io\n")).toEqual(["a@x.com", "b@y.org", "c@z.io"]);
  });

  it("unsubscribes with the token", async () => {
    api.unsubscribe.mockResolvedValue({ unsubscribed: true });
    wrap(<UnsubscribeCard token="tok" />);
    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe" }));
    expect(await screen.findByText("You have been unsubscribed.")).toBeInTheDocument();
    expect(api.unsubscribe).toHaveBeenCalledWith("tok");
  });
});
