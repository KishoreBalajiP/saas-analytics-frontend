import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { QueryClientContext } from "@tanstack/react-query";

import * as authApi from "@/features/auth/api";
import {
  ApiError,
  getAccessToken,
  isSupportSessionActive,
  onRemoteSignOut,
  setAccessToken,
} from "@/lib/api/client";
import { endSupportSession } from "./supportSession";
import { hasPermission as checkPermission } from "@/lib/permissions";
import type { Me } from "@/lib/api/types";
import { expectsLiveSession } from "./sessionHint";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

/**
 * Why restoring a session on page load failed, when the UI can say
 * something useful. `cookies_blocked`: this browser signed in and the
 * session should still be alive, but the refresh cookie never reached the
 * server (third-party-cookie blocking).
 */
export type SessionRestoreError = "cookies_blocked";

interface SessionState {
  status: SessionStatus;
  /** Set when the last restore attempt failed for a reason worth explaining. */
  restoreError?: SessionRestoreError | null;
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
  const [restoreError, setRestoreError] = useState<SessionRestoreError | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  // Cached server data belongs to one identity. Clear it on sign-out and when
  // a new session starts so the next user in this tab never sees the
  // previous tenant's data. (Undefined when no QueryClientProvider is
  // mounted, e.g. in isolated unit tests.)
  const queryClient = useContext(QueryClientContext);

  const load = useCallback(async () => {
    try {
      // No in-memory access token (fresh tab): try the HttpOnly refresh cookie first.
      if (!getAccessToken(audience)) {
        try {
          if (audience === "admin") await authApi.refreshAdmin();
          else await authApi.refreshTenant();
        } catch (error) {
          const blocked =
            error instanceof ApiError &&
            error.code === "SESSION_COOKIE_MISSING" &&
            expectsLiveSession(audience);
          setRestoreError(blocked ? "cookies_blocked" : null);
          setMe(null);
          setStatus("anonymous");
          return;
        }
      }
      const profile = audience === "admin" ? await authApi.adminMe() : await authApi.tenantMe();
      setMe(profile);
      if (profile.tenantId) setTenantSlug(profile.tenantId);
      setRestoreError(null);
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

  // Signing out in another tab signs this tab out too.
  useEffect(
    () =>
      onRemoteSignOut((signedOut) => {
        if (signedOut !== audience) return;
        queryClient?.clear();
        setMe(null);
        setStatus("anonymous");
      }),
    [audience, queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      if (audience === "admin") await authApi.logoutAdmin();
      // support: a support session ends itself; it must not sign the
      // browser's own tenant session (or other tabs) out.
      else if (isSupportSessionActive()) await endSupportSession();
      else await authApi.logoutTenant();
    } finally {
      queryClient?.clear();
      setMe(null);
      setStatus("anonymous");
    }
  }, [audience, queryClient]);

  const setSession = useCallback(
    (profile: Me, slug?: string) => {
      queryClient?.clear();
      setMe(profile);
      setRestoreError(null);
      setStatus("authenticated");
      if (slug) {
        setTenantSlug(slug);
        storeTenantSlug(slug);
      }
    },
    [queryClient],
  );

  const permissions = useMemo(() => me?.permissions ?? [], [me]);

  // Same rule as lib/permissions (deny when the list is empty). The profile
  // endpoints return the caller's effective permissions; the backend remains
  // authoritative for every request.
  const hasPermission = useCallback(
    (permission: string) => checkPermission(permissions, permission),
    [permissions],
  );

  return {
    status,
    restoreError,
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
