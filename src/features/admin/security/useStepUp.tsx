import { useCallback, useState } from "react";

import { isStepUpRequired } from "@/features/auth/api/adminSecurity";

import { StepUpDialog } from "./StepUpDialog";

interface Pending {
  confirm: () => void;
  cancel: () => void;
}

/**
 * Run a sensitive admin call; when the server answers 403
 * `STEP_UP_REQUIRED`, ask the admin to re-authenticate and retry the call
 * once confirmed. Cancelling rejects with the original error.
 *
 *   const stepUp = useStepUp({ mfaEnabled: me?.mfaEnabled });
 *   useMutation({ mutationFn: () => stepUp.run(() => api.resetAdminMfaFor(id, reason)) });
 *   return <>{...}{stepUp.dialog}</>;
 */
export function useStepUp({ mfaEnabled = true }: { mfaEnabled?: boolean } = {}) {
  const [pending, setPending] = useState<Pending | null>(null);

  const run = useCallback(
    <T,>(fn: () => Promise<T>): Promise<T> =>
      fn().catch((error: unknown) => {
        if (!isStepUpRequired(error)) throw error;
        return new Promise<T>((resolve, reject) => {
          setPending({
            confirm: () => {
              setPending(null);
              fn().then(resolve, reject);
            },
            cancel: () => {
              setPending(null);
              reject(error);
            },
          });
        });
      }),
    [],
  );

  const dialog = (
    <StepUpDialog
      open={pending !== null}
      mfaEnabled={mfaEnabled}
      onConfirmed={() => pending?.confirm()}
      onCancel={() => pending?.cancel()}
    />
  );

  return { run, dialog, awaitingStepUp: pending !== null };
}
