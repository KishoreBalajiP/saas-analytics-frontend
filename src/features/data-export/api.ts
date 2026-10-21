import { request, requestPaged, type Query } from "@/lib/api/client";

import type { DataExport, DataExportDownloadLink } from "./types";

/* ------------------------------ workspace ------------------------------- */
// Tenant Bearer, `/workspace/data-exports` (data_exports.view / data_exports.export).

/** TanStack Query keys for data exports. */
export const dataExportKeys = {
  workspace: ["workspace", "data-exports"] as const,
  tenant: (tenantId: string) => ["admin", "tenant", tenantId, "data-exports"] as const,
};

/** GET /workspace/data-exports (requires `data_exports.view`). */
export function listWorkspaceExports(query: Query = {}) {
  return requestPaged<DataExport>("/workspace/data-exports", { query });
}

/** POST /workspace/data-exports (requires `data_exports.export`); 202 with the queued export. */
export function requestWorkspaceExport() {
  return request<DataExport>("/workspace/data-exports", { method: "POST", body: {} });
}

/** POST /workspace/data-exports/:id/download-url (requires `data_exports.export`). */
export function workspaceDownloadUrl(exportId: string) {
  return request<DataExportDownloadLink>(
    `/workspace/data-exports/${encodeURIComponent(exportId)}/download-url`,
    { method: "POST", body: {} },
  );
}

/** DELETE /workspace/data-exports/:id - delete the archive now. */
export function deleteWorkspaceExport(exportId: string) {
  return request<DataExport>(`/workspace/data-exports/${encodeURIComponent(exportId)}`, {
    method: "DELETE",
  });
}

/* ------------------------------- platform ------------------------------- */
// Admin Bearer, `/tenants/:id/data-exports` (iam.tenants.view / iam.tenants.export).

const audience = "admin" as const;

function tenantPath(tenantId: string, rest = "") {
  return `/tenants/${encodeURIComponent(tenantId)}/data-exports${rest}`;
}

/** GET /tenants/:id/data-exports (requires `iam.tenants.view`). */
export function listTenantExports(tenantId: string, query: Query = {}) {
  return requestPaged<DataExport>(tenantPath(tenantId), { audience, query });
}

/** POST /tenants/:id/data-exports `{ reason }` (requires `iam.tenants.export`). */
export function requestTenantExport(tenantId: string, reason: string) {
  return request<DataExport>(tenantPath(tenantId), {
    method: "POST",
    audience,
    body: { reason },
  });
}

/** POST /tenants/:id/data-exports/:exportId/download-url (requires `iam.tenants.export`). */
export function tenantDownloadUrl(tenantId: string, exportId: string) {
  return request<DataExportDownloadLink>(
    tenantPath(tenantId, `/${encodeURIComponent(exportId)}/download-url`),
    { method: "POST", audience, body: {} },
  );
}

/** DELETE /tenants/:id/data-exports/:exportId (requires `iam.tenants.export`). */
export function deleteTenantExport(tenantId: string, exportId: string) {
  return request<DataExport>(tenantPath(tenantId, `/${encodeURIComponent(exportId)}`), {
    method: "DELETE",
    audience,
  });
}
