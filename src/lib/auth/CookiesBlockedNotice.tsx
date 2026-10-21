import { ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Shown on a sign-in page when the previous session could not be restored
 * because the browser never sent the HttpOnly sign-in cookie (typically
 * third-party-cookie blocking in Safari, Brave or a private window).
 */
export function CookiesBlockedNotice() {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
      <ShieldAlert className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Your browser blocked the sign-in cookie</AlertTitle>
      <AlertDescription className="text-amber-900/80">
        You were signed out because this browser did not keep the secure cookie that keeps you
        signed in. This usually happens when cross-site cookies are blocked (Safari, Brave or a
        private window). Allow cookies for this site and sign in again, otherwise you will be signed
        out each time you reload.
      </AlertDescription>
    </Alert>
  );
}
