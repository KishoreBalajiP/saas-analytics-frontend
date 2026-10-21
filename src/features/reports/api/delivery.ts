// delivery: roadmap 3.4 - destinations, delivery history, unsubscribe.
import { request, requestPaged, type Query } from "@/lib/api/client";
import type { DeliveryDestination, DeliveryDestinationType, DeliveryRun } from "@/lib/api/types";

export function listDestinations() {
  return request<DeliveryDestination[]>("/delivery/destinations");
}

export function createDestination(body: {
  type: DeliveryDestinationType;
  name: string;
  url: string;
}) {
  return request<DeliveryDestination>("/delivery/destinations", { method: "POST", body });
}

export function removeDestination(id: string) {
  return request<{ id: string }>(`/delivery/destinations/${id}`, { method: "DELETE" });
}

export function listDeliveries(query: Query = {}) {
  return requestPaged<DeliveryRun>("/delivery/deliveries", { query });
}

export function retryDelivery(id: string) {
  return request<DeliveryRun>(`/delivery/deliveries/${id}/retry`, { method: "POST" });
}

export function unsubscribe(token: string) {
  return request<{ unsubscribed: boolean }>("/delivery/unsubscribe", {
    method: "POST",
    body: { token },
  });
}
