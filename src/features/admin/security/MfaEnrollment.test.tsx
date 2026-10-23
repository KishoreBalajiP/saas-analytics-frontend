import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const authApi = vi.hoisted(() => ({ enrollMfa: vi.fn(), verifyMfa: vi.fn() }));
vi.mock("@/features/auth/api", () => authApi);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { MfaEnrollment } from "./MfaEnrollment";

const CODES = Array.from(
  { length: 10 },
  (_, i) => `ABCD-EFGH-JKMN-PQ${String.fromCharCode(65 + i)}2`,
);

function renderEnrollment(onComplete = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MfaEnrollment onComplete={onComplete} />
    </QueryClientProvider>,
  );
  return onComplete;
}

beforeEach(() => {
  vi.clearAllMocks();
  authApi.enrollMfa.mockResolvedValue({
    secret: "JBSWY3DPEHPK3PXPJBSWY3DP",
    otpauthUrl: "otpauth://totp/Analivo:ops@example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DP",
  });
  authApi.verifyMfa.mockResolvedValue({
    enabled: true,
    recoveryCodes: CODES,
    recoveryCodesRemaining: 10,
  });
});

describe("MfaEnrollment", () => {
  it("walks through setup and shows the recovery codes once before continuing", async () => {
    const user = userEvent.setup();
    const onComplete = renderEnrollment();

    await user.click(screen.getByRole("button", { name: /set up authenticator/i }));
    expect(await screen.findByLabelText(/setup key/i)).toHaveTextContent("JBSW Y3DP EHPK 3PXP");
    expect(await screen.findByLabelText(/mfa enrollment qr code/i)).toContainHTML("<svg");
    expect(screen.queryByRole("link", { name: /open it in your authenticator app/i })).toBeNull();

    await user.type(screen.getByLabelText(/6-digit code/i), "12a3456");
    await user.click(screen.getByRole("button", { name: /verify and turn on mfa/i }));
    expect(authApi.verifyMfa).toHaveBeenCalledWith("123456");

    const list = await screen.findByRole("list", { name: /recovery codes/i });
    expect(list.querySelectorAll("li")).toHaveLength(10);
    expect(list).toHaveTextContent(CODES[0]!);

    // Continuing requires confirming the codes were saved.
    const proceed = screen.getByRole("button", { name: /continue/i });
    expect(proceed).toBeDisabled();
    await user.click(screen.getByLabelText(/i have saved these recovery codes/i));
    expect(proceed).toBeEnabled();
    await user.click(proceed);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("explains a wrong code and lets the admin retry", async () => {
    const user = userEvent.setup();
    authApi.verifyMfa.mockRejectedValueOnce(new ApiError("Invalid verification code", 400));
    renderEnrollment();
    await user.click(screen.getByRole("button", { name: /set up authenticator/i }));
    await user.type(await screen.findByLabelText(/6-digit code/i), "000000");
    await user.click(screen.getByRole("button", { name: /verify and turn on mfa/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid verification code/i);
    expect(screen.queryByRole("list", { name: /recovery codes/i })).not.toBeInTheDocument();
  });

  it("reports when enrolment cannot start (MFA already on)", async () => {
    const user = userEvent.setup();
    authApi.enrollMfa.mockRejectedValueOnce(new ApiError("MFA is already enabled", 409));
    renderEnrollment();
    await user.click(screen.getByRole("button", { name: /set up authenticator/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/already enabled/i));
  });
});
