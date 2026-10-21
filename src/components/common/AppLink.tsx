import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";

type LinkProps = Omit<ComponentProps<typeof Link>, "to" | "search">;

/**
 * Router-aware link that accepts a runtime string path (breadcrumbs, dynamic
 * detail links built from ids). Route files still own type-safe navigation.
 */
export function AppLink({
  to,
  search,
  children,
  ...props
}: LinkProps & { to: string; search?: Record<string, string>; children?: ReactNode }) {
  return (
    <Link to={to as never} {...(search ? { search: search as never } : {})} {...props}>
      {children}
    </Link>
  );
}
