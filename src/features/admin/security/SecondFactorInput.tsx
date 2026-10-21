import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Authenticator code input with a switch to a one-time recovery code.
 * Controlled: the parent owns `value` and `useRecovery`.
 */
export function SecondFactorInput({
  id,
  value,
  onChange,
  useRecovery,
  onToggleRecovery,
  required = true,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  useRecovery: boolean;
  onToggleRecovery: (next: boolean) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{useRecovery ? "Recovery code" : "Authenticator code"}</Label>
      {useRecovery ? (
        <Input
          id={id}
          autoComplete="off"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          maxLength={40}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
      ) : (
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
          required={required}
        />
      )}
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() => {
          onChange("");
          onToggleRecovery(!useRecovery);
        }}
      >
        {useRecovery ? "Use an authenticator code instead" : "Use a recovery code instead"}
      </button>
    </div>
  );
}
