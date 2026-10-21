import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSession } from "@/lib/auth/session";

import { AdminAuthLayout } from "./AdminAuthLayout";
import { MfaEnrollment } from "./MfaEnrollment";

/**
 * MFA setup for an enrolment-only admin session (roadmap 2.2). A
 * privileged admin without MFA can use nothing else until this finishes;
 * the server enforces it (403 `MFA_ENROLLMENT_REQUIRED` everywhere else).
 * Rendered inside `AdminSessionProvider` by the `/admin/mfa-setup` route.
 */
export function AdminMfaSetupPage() {
  const navigate = useNavigate();
  const { status, me, refetch, signOut } = useAdminSession();

  useEffect(() => {
    if (status === "anonymous") void navigate({ to: "/admin/login" });
    else if (status === "authenticated" && me?.mfaEnabled && !me.mfaEnrollmentRequired) {
      void navigate({ to: "/admin/dashboard" });
    }
  }, [status, me, navigate]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <Skeleton className="h-40 w-full max-w-md" />
      </div>
    );
  }

  return (
    <AdminAuthLayout
      title="Set up multi-factor authentication"
      description={
        me?.mfaEnrollmentRequired
          ? "Your admin role requires multi-factor authentication. Finish this step to continue."
          : "Protect your admin account with an authenticator app."
      }
      footer={
        <Button
          variant="link"
          size="sm"
          onClick={async () => {
            await signOut();
            void navigate({ to: "/admin/login" });
          }}
        >
          Sign out
        </Button>
      }
    >
      <MfaEnrollment
        onComplete={async () => {
          await refetch();
          toast.success("Multi-factor authentication is on");
          void navigate({ to: "/admin/dashboard" });
        }}
      />
    </AdminAuthLayout>
  );
}
