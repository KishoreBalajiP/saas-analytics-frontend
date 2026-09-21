import { request, requestPaged, type Query } from "@/lib/api/client";
import type { Notification } from "@/lib/api/types";

export function list(query: Query = {}) {
  return requestPaged<Notification>("/notifications", { query });
}

export function unreadCount() {
  return request<{ count: number }>("/notifications/unread-count");
}

export function getPreferences() {
  return request<{ preferences?: Record<string, boolean> } & Record<string, unknown>>(
    "/notifications/preferences",
  );
}

export function updatePreferences(preferences: Record<string, boolean>) {
  return request<unknown>("/notifications/preferences", {
    method: "POST",
    body: { preferences },
  });
}

export function markAllRead() {
  return request<unknown>("/notifications/read-all", { method: "POST", body: {} });
}

export function markRead(id: string) {
  return request<unknown>(`/notifications/${id}/read`, { method: "POST", body: {} });
}

export function remove(id: string) {
  return request<unknown>(`/notifications/${id}`, { method: "DELETE" });
}
