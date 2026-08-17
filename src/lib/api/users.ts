import { request, requestPaged, type Query } from "./client";
import type { Me } from "./types";

export interface TenantUser {
  _id?: string;
  id?: string;
  email: string;
  status?: string;
  roles?: string[];
  profile?: { name?: string };
  createdAt?: string;
}

export function listUsers(query: Query = {}) {
  return requestPaged<TenantUser>("/users", { query });
}

export function getUser(userId: string) {
  return request<TenantUser>(`/users/${userId}`);
}

/**
 * @deprecated Use `authApi.tenantMe()` from `@/lib/api/auth` instead.
 * Kept only for backward compatibility during the transition.
 */
export function me() {
  return request<Me>("/users/me");
}
