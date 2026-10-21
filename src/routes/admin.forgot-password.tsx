import { createFileRoute } from "@tanstack/react-router";

import { AdminForgotPasswordPage } from "@/features/admin/security/AdminForgotPasswordPage";

export const Route = createFileRoute("/admin/forgot-password")({
  head: () => ({ meta: [{ title: "Reset admin password - Analivo" }] }),
  component: AdminForgotPasswordPage,
});
