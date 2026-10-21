/**
 * ConnectorDetailView: upload errors (413 / 415) and sync-slot refusals are
 * shown inline with a clear message, and the webhook tab shows the absolute
 * ingest URL with the timestamp signing instructions and the legacy upgrade
 * path. (Sync state, polling and history: ConnectorDetailView.test.tsx.)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@/features/datasets/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/datasets/api")>("@/features/datasets/api");
  return {
    ...actual,
    get: vi.fn(),
    listRows: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    previewFile: vi.fn(),
    syncFile: vi.fn(),
    syncMongoDB: vi.fn(),
    validate: vi.fn(),
  };
});

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTenantSession } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/client";
import type { Connector } from "@/lib/api/types";
import * as connectorsApi from "@/features/datasets/api";
import { ConnectorDetailView } from "./ConnectorDetailView";

type MutationOptions = {
  mutationFn: (...args: unknown[]) => unknown;
  onError?: (error: unknown) => void;
  onMutate?: () => void;
};

const mutations: MutationOptions[] = [];
const mutate = vi.fn();
const PERMISSIONS = [
  "connectors.view",
  "connectors.update",
  "connectors.delete",
  "connectors.sync",
  "connectors.preview",
];

function setup(connector: Partial<Connector>) {
  vi.mocked(useTenantSession).mockReturnValue({
    status: "authenticated",
    me: { id: "u1", email: "t@t.com", permissions: PERMISSIONS },
    tenantSlug: "acme",
    permissions: PERMISSIONS,
    hasPermission: (p: string) => PERMISSIONS.includes(p),
    refetch: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  });
  vi.mocked(useQuery).mockImplementation(
    () =>
      ({
        data: { _id: "c1", name: "Orders", status: "active", configSummary: {}, ...connector },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      }) as unknown as ReturnType<typeof useQuery>,
  );
  vi.mocked(useMutation).mockImplementation((options: unknown) => {
    mutations.push(options as MutationOptions);
    return { mutate, isPending: false } as unknown as ReturnType<typeof useMutation>;
  });
}

/** The latest registered mutation whose function calls `apiFn`. */
async function mutationCalling(apiFn: (...args: never[]) => unknown) {
  for (const options of [...mutations].reverse()) {
    vi.mocked(apiFn).mockClear();
    await Promise.resolve(options.mutationFn(new File(["x"], "x.csv"))).catch(() => undefined);
    if (vi.mocked(apiFn).mock.calls.length > 0) return options;
  }
  throw new Error("mutation not found");
}

beforeEach(() => {
  vi.clearAllMocks();
  mutations.length = 0;
});

describe("ConnectorDetailView uploads", () => {
  it("shows a 413 FILE_TOO_LARGE error inline with the limit", async () => {
    setup({ type: "csv" });
    render(<ConnectorDetailView connectorId="c1" />);
    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));

    const preview = await mutationCalling(connectorsApi.previewFile);
    act(() => {
      preview.onError?.(
        new ApiError(
          "The file is larger than the 10 MB limit for CSV uploads.",
          413,
          "FILE_TOO_LARGE",
        ),
      );
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("File too large");
    expect(alert).toHaveTextContent("10 MB limit");
    expect(toast.error).toHaveBeenCalledWith("File too large", expect.anything());
  });

  it("shows a 415 type error inline on the sync tab with the accepted types", async () => {
    setup({ type: "xlsx" });
    render(<ConnectorDetailView connectorId="c1" />);
    await userEvent.click(screen.getByRole("tab", { name: "Sync" }));

    const sync = await mutationCalling(connectorsApi.syncFile);
    act(() => {
      sync.onError?.(
        new ApiError("This connector accepts .xlsx files only.", 415, "FILE_TYPE_MISMATCH"),
      );
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("File type does not match");
    expect(alert).toHaveTextContent(".xlsx");
    // Legacy .xls is no longer offered by the picker.
    expect(document.querySelector('input[type="file"]')).toHaveAttribute("accept", ".xlsx");
  });
});

describe("ConnectorDetailView file sync conflicts", () => {
  it("explains a 409 SYNC_IN_PROGRESS on a file sync inline, not as a file problem", async () => {
    setup({ type: "csv", syncStatus: "failed" });
    render(<ConnectorDetailView connectorId="c1" />);
    await userEvent.click(screen.getByRole("tab", { name: "Sync" }));

    const sync = await mutationCalling(connectorsApi.syncFile);
    act(() => {
      sync.onError?.(new ApiError("busy", 409, "SYNC_IN_PROGRESS"));
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sync already running");
    expect(toast.error).toHaveBeenCalledWith("Sync already running", expect.anything());
  });

  it("keeps a code-less 503 on a preview an upload failure, not a sync-service outage", async () => {
    setup({ type: "csv" });
    render(<ConnectorDetailView connectorId="c1" />);
    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));

    const preview = await mutationCalling(connectorsApi.previewFile);
    act(() => {
      preview.onError?.(new ApiError("Service Unavailable", 503));
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Upload failed");
    expect(alert).not.toHaveTextContent("Sync service unavailable");
    expect(toast.error).toHaveBeenCalledWith("Upload failed", expect.anything());
  });
});

describe("ConnectorDetailView webhook tab", () => {
  it("shows the absolute ingest URL and timestamp signing instructions", async () => {
    setup({ type: "webhook", webhookToken: "tok_123", webhookSignatureVersion: 2 });
    render(<ConnectorDetailView connectorId="c1" />);
    await userEvent.click(screen.getByRole("tab", { name: "Webhook" }));

    expect(screen.getByText(connectorsApi.webhookIngestUrl("tok_123"))).toBeInTheDocument();
    expect(connectorsApi.webhookIngestUrl("tok_123")).toMatch(/^https?:\/\//);
    expect(screen.getByText(/Timestamped signatures required/)).toBeInTheDocument();
    expect(screen.queryByText("Legacy signatures enabled")).toBeNull();
  });

  it("offers the one-way upgrade for a legacy webhook", async () => {
    setup({ type: "webhook", webhookToken: "tok_legacy" });
    render(<ConnectorDetailView connectorId="c1" />);
    await userEvent.click(screen.getByRole("tab", { name: "Webhook" }));

    expect(screen.getByText("Legacy signatures enabled")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Require timestamped signatures/ }));
    expect(mutate).toHaveBeenCalled();
    const upgrade = mutations.find((m) => {
      vi.mocked(connectorsApi.update).mockClear();
      void m.mutationFn();
      return vi
        .mocked(connectorsApi.update)
        .mock.calls.some(
          ([, body]) =>
            (body as { webhookSignatureVersion?: number })?.webhookSignatureVersion === 2,
        );
    });
    expect(upgrade).toBeDefined();
  });
});
