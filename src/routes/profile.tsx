import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { PasswordForm, ProfileForm, SessionsPanel } from "@/features/profile/ProfilePanels";
import { TenantMfaCard } from "@/features/auth/mfa/TenantMfaCard";
import { useTenantSession } from "@/lib/auth/session";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Analytics Console" },
      { name: "description", content: "Manage your profile and security settings." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <TenantPortal>
      <ProfileContent />
    </TenantPortal>
  );
}

// onboarding: a working profile (name, time zone, password, sessions).
// mfa-tenant: the MFA card manages enrolment, recovery codes and disable.
function ProfileContent() {
  const { me, tenantSlug, setSession } = useTenantSession();
  if (!me) return null;
  return (
    <>
      <PageHeader
        title="Profile & Security"
        description="Your name, time zone, password, two-step verification and signed-in devices."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Profile" }]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileForm
          me={me}
          onSaved={(updated) => setSession({ ...me, ...updated }, tenantSlug ?? undefined)}
        />
        <PasswordForm />
        <SessionsPanel />
        <TenantMfaCard />
      </div>
    </>
  );
}
