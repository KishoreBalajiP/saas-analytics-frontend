import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaEnrollment } from "@/features/admin/security/MfaEnrollment";
import { tenantEnrollmentApi } from "@/features/auth/api/tenantSecurity";
import { TenantSessionProvider, useTenantSession } from "@/lib/auth/session";

// mfa-tenant: enrolment page for a session restricted to MFA enrolment.
export const Route = createFileRoute("/mfa-setup")({
  head: () => ({ meta: [{ title: "Set up MFA - Analivo" }] }),
  component: () => (
    <TenantSessionProvider>
      <TenantMfaSetup />
    </TenantSessionProvider>
  ),
});

function TenantMfaSetup() {
  const navigate = useNavigate();
  const { refetch } = useTenantSession();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set up multi-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <MfaEnrollment
            api={tenantEnrollmentApi}
            onComplete={async () => {
              await refetch();
              toast.success("Multi-factor authentication is on");
              void navigate({ to: "/dashboard" });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
