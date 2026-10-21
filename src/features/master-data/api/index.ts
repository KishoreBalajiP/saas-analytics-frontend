import { request, requestPaged } from "@/lib/api/client";

const audience = "admin" as const;

/** A row of a shared reference catalogue (`/master-data/:catalogue`). */
export interface MasterDataItem {
  id?: string;
  _id?: string;
  catalogue?: string;
  code: string;
  name: string;
  locale?: string | null;
  data?: Record<string, unknown> | null;
  isSystem?: boolean;
}

export function itemId(item: MasterDataItem): string {
  return item.id ?? item._id ?? "";
}

const base = (catalogue: string) => `/master-data/${encodeURIComponent(catalogue)}`;

/** GET /master-data/:catalogue (public read). */
export function listMasterData(
  catalogue: string,
  query: { search?: string; page?: number; limit?: number } = {},
) {
  return requestPaged<MasterDataItem>(base(catalogue), { audience, query });
}

/** POST /master-data/:catalogue (master_data.create, platform admins). */
export function createMasterDataItem(
  catalogue: string,
  body: { code: string; name: string; locale?: string },
) {
  return request<MasterDataItem>(base(catalogue), { method: "POST", audience, body });
}

/** PATCH /master-data/:catalogue/:id (master_data.update). */
export function updateMasterDataItem(
  catalogue: string,
  id: string,
  body: { code?: string; name?: string; locale?: string },
) {
  return request<MasterDataItem>(`${base(catalogue)}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    audience,
    body,
  });
}

/** DELETE /master-data/:catalogue/:id (master_data.delete). */
export function deleteMasterDataItem(catalogue: string, id: string) {
  return request<void>(`${base(catalogue)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    audience,
  });
}
