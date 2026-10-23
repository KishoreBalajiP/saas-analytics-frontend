import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  me: null as Record<string, unknown> | null,
  permissions: [] as string[],
  refetch: vi.fn(),
}));
const api = vi.hoisted(() => ({
  enrollTenantMfa: vi.fn(),
  verifyTenantMfa: vi.fn(),
  disableTenantMfa: vi.fn(),
  stepUpTenant: vi.fn(),
  regenerateTenantRecoveryCodes: vi.fn(),
  getWorkspaceSecurity: vi.fn(),
  updateWorkspaceSecurity: vi.fn(),
  workspaceSecurityKey: ["workspace", "security"],
  get tenantEnrollmentApi() {
    return { start: api.enrollTenantMfa, verify: api.verifyTenantMfa };
  },
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: () => session }));
vi.mock("@/features/auth/api/tenantSecurity", () => api);
vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { TenantMfaCard } from "./TenantMfaCard";
import { WorkspaceSecurityCard } from "./WorkspaceSecurityCard";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  session.permissions = [];
});

describe("TenantMfaCard", () => {
  it("enrols through the tenant endpoints and shows recovery codes", async () => {
    const user = userEvent.setup();
    session.me = { id: "u1", email: "u@x.io", mfa: { enabled: false, required: false } };
    api.enrollTenantMfa.mockResolvedValue({ secret: "ABCDEFGH", otpauthUrl: "otpauth://totp/x" });
    api.verifyTenantMfa.mockResolvedValue({
      enabled: true,
      recoveryCodes: ["AAAA-BBBB-CCCC-DDDD"],
      recoveryCodesRemaining: 1,
    });
    wrap(<TenantMfaCard />);
    await user.click(screen.getByRole("button", { name: /set up mfa/i }));
    await user.type(await screen.findByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify and turn on/i }));
    expect(await screen.findByText("AAAA-BBBB-CCCC-DDDD")).toBeInTheDocument();
    expect(api.verifyTenantMfa).toHaveBeenCalledWith("123456");
  });

  it("turns MFA off with password and code", async () => {
    const user = userEvent.setup();
    session.me = { id: "u1", email: "u@x.io", mfa: { enabled: true, recoveryCodesRemaining: 9 } };
    api.disableTenantMfa.mockResolvedValue({ enabled: false, enrollmentRequired: false });
    wrap(<TenantMfaCard />);
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.type(screen.getByLabelText("Authenticator code"), "654321");
    await user.click(screen.getByRole("button", { name: /turn off mfa/i }));
    await waitFor(() =>
      expect(api.disableTenantMfa).toHaveBeenCalledWith("pw", { code: "654321" }),
    );
  });

  it("requires step-up before showing newly generated recovery codes", async () => {
    const user = userEvent.setup();
    session.me = { id: "u1", email: "u@x.io", mfa: { enabled: true, recoveryCodesRemaining: 9 } };
    api.stepUpTenant.mockResolvedValue({ stepUpExpiresAt: new Date().toISOString() });
    api.regenerateTenantRecoveryCodes.mockResolvedValue({
      recoveryCodes: ["AAAA-BBBB-CCCC-DDDD"],
      recoveryCodesRemaining: 1,
      generatedAt: new Date().toISOString(),
    });
    const refetch = vi.fn();
    session.refetch = refetch;
    wrap(<TenantMfaCard />);
    await user.click(screen.getByRole("button", { name: /generate new recovery codes/i }));
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.type(screen.getByLabelText("Authenticator code"), "654321");
    await user.click(screen.getByRole("button", { name: /verify identity/i }));
    await waitFor(() => expect(api.stepUpTenant).toHaveBeenCalledWith("pw", { code: "654321" }));
    await user.click(await screen.findByRole("button", { name: /^generate recovery codes$/i }));
    expect(await screen.findByText("AAAA-BBBB-CCCC-DDDD")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /i saved my recovery codes/i }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("WorkspaceSecurityCard", () => {
  it("keeps personal MFA available without workspace policy permission", () => {
    session.me = { id: "u1", mfa: { enabled: false, required: false } };
    const { container } = wrap(<WorkspaceSecurityCard />);
    expect(container).not.toBeEmptyDOMElement();
    expect(api.getWorkspaceSecurity).not.toHaveBeenCalled();
  });

  it("lets security.configure toggle the policy", async () => {
    const user = userEvent.setup();
    session.permissions = ["security.view", "security.configure"];
    session.me = { id: "u1", mfa: { enabled: true, required: false } };
    api.getWorkspaceSecurity.mockResolvedValue({
      mfaRequired: false,
      members: { total: 2, mfaEnabled: 1 },
    });
    api.updateWorkspaceSecurity.mockResolvedValue({
      mfaRequired: true,
      members: { total: 2, mfaEnabled: 1 },
    });
    wrap(<WorkspaceSecurityCard />);
    await user.click(
      await screen.findByRole("button", { name: /require mfa for all workspace members/i }),
    );
    expect(api.updateWorkspaceSecurity).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(api.updateWorkspaceSecurity).toHaveBeenCalledWith(true));
  });

  it("view-only members cannot toggle", async () => {
    session.permissions = ["security.view"];
    api.getWorkspaceSecurity.mockResolvedValue({
      mfaRequired: true,
      members: { total: 1, mfaEnabled: 1 },
    });
    wrap(<WorkspaceSecurityCard />);
    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /require mfa for all workspace members/i }),
    ).toBeNull();
  });
});
