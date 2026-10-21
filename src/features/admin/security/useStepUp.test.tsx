import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const security = vi.hoisted(() => ({ stepUpAdmin: vi.fn() }));
vi.mock("@/features/auth/api/adminSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/api/adminSecurity")>();
  return { ...actual, stepUpAdmin: security.stepUpAdmin };
});

import { useStepUp } from "./useStepUp";

function Harness({
  action,
  mfaEnabled = true,
}: {
  action: () => Promise<string>;
  mfaEnabled?: boolean;
}) {
  const stepUp = useStepUp({ mfaEnabled });
  const [result, setResult] = useState("idle");
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          stepUp.run(action).then(
            (value) => setResult(`ok:${value}`),
            (error: Error) => setResult(`error:${error.message}`),
          )
        }
      >
        Sensitive action
      </button>
      <output>{result}</output>
      {stepUp.dialog}
    </div>
  );
}

function renderHarness(action: () => Promise<string>, mfaEnabled = true) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness action={action} mfaEnabled={mfaEnabled} />
    </QueryClientProvider>,
  );
}

const stepUpRequired = () =>
  new ApiError("Confirm your password and authenticator code to continue", 403, "STEP_UP_REQUIRED");

beforeEach(() => {
  vi.clearAllMocks();
  security.stepUpAdmin.mockResolvedValue({ stepUpExpiresAt: new Date().toISOString() });
});

describe("useStepUp", () => {
  it("asks for the password and code, then retries the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValueOnce(stepUpRequired()).mockResolvedValue("done");
    renderHarness(action);

    await user.click(screen.getByRole("button", { name: /sensitive action/i }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(/confirm it is you/i);
    await user.type(screen.getByLabelText(/^password$/i), "Password123!");
    await user.type(screen.getByLabelText(/authenticator code/i), "123456");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));

    expect(security.stepUpAdmin).toHaveBeenCalledWith("Password123!", { code: "123456" });
    expect(await screen.findByText("ok:done")).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("accepts a recovery code instead of an authenticator code", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValueOnce(stepUpRequired()).mockResolvedValue("done");
    renderHarness(action);
    await user.click(screen.getByRole("button", { name: /sensitive action/i }));
    await user.type(await screen.findByLabelText(/^password$/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /use a recovery code instead/i }));
    await user.type(screen.getByLabelText(/recovery code/i), "ABCD-EFGH-JKMN-PQRS");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));
    expect(security.stepUpAdmin).toHaveBeenCalledWith("Password123!", {
      recoveryCode: "ABCD-EFGH-JKMN-PQRS",
    });
    expect(await screen.findByText("ok:done")).toBeInTheDocument();
  });

  it("shows a failed confirmation and does not retry", async () => {
    const user = userEvent.setup();
    security.stepUpAdmin.mockRejectedValueOnce(new ApiError("nope", 403, "STEP_UP_FAILED"));
    const action = vi.fn().mockRejectedValue(stepUpRequired());
    renderHarness(action);
    await user.click(screen.getByRole("button", { name: /sensitive action/i }));
    await user.type(await screen.findByLabelText(/^password$/i), "wrong");
    await user.type(screen.getByLabelText(/authenticator code/i), "123456");
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/password or code is incorrect/i);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("cancelling rejects with the original error", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValue(stepUpRequired());
    renderHarness(action);
    await user.click(screen.getByRole("button", { name: /sensitive action/i }));
    await user.click(await screen.findByRole("button", { name: /cancel/i }));
    expect(await screen.findByText(/^error:Confirm your password/)).toBeInTheDocument();
    expect(security.stepUpAdmin).not.toHaveBeenCalled();
  });

  it("passes other errors straight through without a dialog", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValue(new ApiError("Forbidden", 403, "FORBIDDEN"));
    renderHarness(action);
    await user.click(screen.getByRole("button", { name: /sensitive action/i }));
    expect(await screen.findByText("error:Forbidden")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("admins without MFA confirm with the password only", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValueOnce(stepUpRequired()).mockResolvedValue("done");
    renderHarness(action, false);
    await user.click(screen.getByRole("button", { name: /sensitive action/i }));
    await user.type(await screen.findByLabelText(/^password$/i), "Password123!");
    expect(screen.queryByLabelText(/authenticator code/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^confirm$/i }));
    expect(security.stepUpAdmin).toHaveBeenCalledWith("Password123!");
    expect(await screen.findByText("ok:done")).toBeInTheDocument();
  });
});
