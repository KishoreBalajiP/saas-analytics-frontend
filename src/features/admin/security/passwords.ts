/** Minimum password length enforced by the backend (admin portal). */
export const MIN_PASSWORD_LENGTH = 8;

/** True when a new password and its confirmation can be submitted. */
export function passwordsReady(password: string, confirm: string) {
  return password.length >= MIN_PASSWORD_LENGTH && password === confirm;
}
