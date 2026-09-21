import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as authApi from "@/features/auth/api";
import { ApiError, getAccessToken, setAccessToken } from "@/lib/api/client";
import type { Me } from "@/lib/api/types";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

interface SessionState {
  status: SessionStatus;
  me: Me | null;
  tenantSlug: string | null;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  refetch: () => Promise<void>;
  setSession: (me: Me, tenantSlug?: string) => void;
  signOut: () => Promise<void>;
}

const TENANT_SLUG_KEY = "saas.tenantSlug";

function readStoredSlug() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TENANT_SLUG_KEY);
  } catch {
    return null;
  }
}

export function storeTenantSlug(slug: string) {
  try {
    window.localStorage.setItem(TENANT_SLUG_KEY, slug);
  } catch {
    /* ignore */
  }
}

const TenantSessionContext = createContext<SessionState | null>(null);
const AdminSessionContext = createContext<SessionState | null>(null);

function useSessionState(audience: "tenant" | "admin"): SessionState {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // No in-memory access token (fresh tab): try the HttpOnly refresh cookie first.
      if (!getAccessToken(audience)) {
        try {
          if (audience === "admin") await authApi.refreshAdmin();
          else await authApi.refreshTenant();
        } catch {
          setMe(null);
          setStatus("anonymous");
          return;
        }
      }
      const profile = audience === "admin" ? await authApi.adminMe() : await authApi.tenantMe();
      setMe(profile);
      if (profile.tenantId) setTenantSlug(profile.tenantId);
      setStatus("authenticated");
    } catch (error) {
      if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) {
        setAccessToken(audience, null);
      }
      setMe(null);
      setStatus("anonymous");
    }
  }, [audience]);

  useEffect(() => {
    // Client-only: sessions depend on cookies + in-memory tokens.
    setTenantSlug(readStoredSlug());
    void load();
  }, [load]);

  const signOut = useCallback(async () => {
    try {
      if (audience === "admin") await authApi.logoutAdmin();
      else await authApi.logoutTenant();
    } finally {
      setMe(null);
      setStatus("anonymous");
    }
  }, [audience]);

  const setSession = useCallback((profile: Me, slug?: string) => {
    setMe(profile);
    setStatus("authenticated");
    if (slug) {
      setTenantSlug(slug);
      storeTenantSlug(slug);
    }
  }, []);

  const permissions = useMemo(() => me?.permissions ?? [], [me]);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!permissions.length) return true; // backend stays authoritative; UX-only gate
      return permissions.includes(permission);
    },
    [permissions],
  );

  return {
    status,
    me,
    tenantSlug,
    permissions,
    hasPermission,
    refetch: load,
    setSession,
    signOut,
  };
}

export function TenantSessionProvider({ children }: { children: ReactNode }) {
  const value = useSessionState("tenant");
  return <TenantSessionContext.Provider value={value}>{children}</TenantSessionContext.Provider>;
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const value = useSessionState("admin");
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useTenantSession() {
  const ctx = useContext(TenantSessionContext);
  if (!ctx) throw new Error("useTenantSession must be used inside TenantSessionProvider");
  return ctx;
}

export function useAdminSession() {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return ctx;
}
