/**
 * ConnectorList permission-gating tests.
 *
 * These tests verify that ConnectorList correctly gates on permissions
 * and handles API states. We mock React Query, AppLink, CreateConnectorDialog
 * and session to test the business logic in isolation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock AppLink to avoid requiring TanStack Router context
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

// Mock CreateConnectorDialog to avoid its internal useQuery
vi.mock("@/components/connectors/CreateConnectorDialog", () => ({
  CreateConnectorDialog: () => <div data-testid="create-connector-dialog" />,
}));

// Mock the session hook
vi.mock("@/lib/auth/session", () => ({
  useTenantSession: vi.fn(),
}));

// Mock React Query
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

// Mock the connector API
vi.mock("@/lib/api/connectors", () => ({
  list: vi.fn(),
  remove: vi.fn(),
  listTypes: vi.fn(),
}));

import { useTenantSession } from "@/lib/auth/session";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConnectorList } from "./ConnectorList";

const mockedUseTenantSession = vi.mocked(useTenantSession);
const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

beforeEach(() => {
  vi.clearAllMocks();
});

function setupSession(permissions: string[]) {
  mockedUseTenantSession.mockReturnValue({
    status: "authenticated",
    me: { id: "u1", email: "t@t.com", permissions },
    tenantSlug: "acme",
    permissions,
    hasPermission: (p: string) => (permissions.length === 0 ? true : permissions.includes(p)),
    refetch: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  });
}

describe("ConnectorList", () => {
  describe("permission gating", () => {
    it("renders 403 error when user lacks connectors.view permission", () => {
      mockedUseTenantSession.mockReturnValue({
        status: "authenticated",
        me: { id: "u1", email: "t@t.com", permissions: [] },
        tenantSlug: "acme",
        permissions: [],
        hasPermission: () => false,
        refetch: vi.fn(),
        setSession: vi.fn(),
        signOut: vi.fn(),
      });

      render(<ConnectorList />);
      expect(screen.getByRole("heading", { name: /Permission required/ })).toBeInTheDocument();
    });

    it("renders table when user has connectors.view permission", () => {
      setupSession(["connectors.view"]);
      mockedUseQuery.mockReturnValue({
        data: {
          data: [{ _id: "c1", name: "Test CSV", type: "csv", status: "active" }],
          meta: { page: 1, limit: 25, total: 1, pages: 1 },
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useQuery>);

      mockedUseMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useMutation>);

      render(<ConnectorList />);
      expect(screen.getByText("Test CSV")).toBeInTheDocument();
    });

    it("shows loading skeleton while fetching", () => {
      setupSession(["connectors.view"]);
      mockedUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useQuery>);

      render(<ConnectorList />);
      const busyElements = document.querySelectorAll('[aria-busy="true"]');
      expect(busyElements.length).toBeGreaterThan(0);
    });

    it("shows error state on API failure", () => {
      setupSession(["connectors.view"]);
      mockedUseQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error("Network error"),
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useQuery>);

      render(<ConnectorList />);
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });

    it("shows empty state when no connectors exist", () => {
      setupSession(["connectors.view"]);
      mockedUseQuery.mockReturnValue({
        data: { data: [], meta: { page: 1, limit: 25, total: 0, pages: 0 } },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useQuery>);

      mockedUseMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as unknown as ReturnType<typeof useMutation>);

      render(<ConnectorList />);
      expect(screen.getByText(/No connectors/)).toBeInTheDocument();
    });
  });
});
