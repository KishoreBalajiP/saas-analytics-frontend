import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

type LinkProps = Omit<ComponentProps<typeof Link>, "to">;

/**
 * Router-aware link that accepts a runtime string path (breadcrumbs, dynamic
 * detail links built from ids). Route files still own type-safe navigation.
 */
export function AppLink({
  to,
  children,
  ...props
}: LinkProps & { to: string; children?: ReactNode }) {
  return (
    <Link to={to as never} {...props}>
      {children}
    </Link>
  );
}
