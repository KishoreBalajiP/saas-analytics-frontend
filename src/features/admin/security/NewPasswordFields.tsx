import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { MIN_PASSWORD_LENGTH } from "./passwords";

/** New password + confirmation, with inline mismatch / length feedback. */
export function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
}: {
  password: string;
  confirm: string;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
}) {
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          aria-invalid={tooShort}
          required
        />
        <p className={tooShort ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => onConfirm(event.target.value)}
          aria-invalid={mismatch}
          required
        />
        {mismatch ? (
          <p className="text-sm text-destructive" role="alert">
            Passwords do not match.
          </p>
        ) : null}
      </div>
    </>
  );
}
