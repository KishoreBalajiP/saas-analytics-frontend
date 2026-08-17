import { request, requestPaged, type Query } from "./client";
import type { MasterDataItem } from "./types";

export function list(catalogue: string, query: Query = {}) {
  return requestPaged<MasterDataItem>(`/master-data/${catalogue}`, {
    audience: "public",
    query,
  });
}

export function get(catalogue: string, id: string) {
  return request<MasterDataItem>(`/master-data/${catalogue}/${id}`, { audience: "public" });
}

export function create(catalogue: string, body: Partial<MasterDataItem>) {
  return request<MasterDataItem>(`/master-data/${catalogue}`, {
    method: "POST",
    audience: "admin",
    body,
  });
}

export function update(catalogue: string, id: string, body: Partial<MasterDataItem>) {
  return request<MasterDataItem>(`/master-data/${catalogue}/${id}`, {
    method: "PATCH",
    audience: "admin",
    body,
  });
}

export function remove(catalogue: string, id: string) {
  return request<unknown>(`/master-data/${catalogue}/${id}`, {
    method: "DELETE",
    audience: "admin",
  });
}
