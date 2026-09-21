import { request, requestPaged, type Query } from "@/lib/api/client";
import type { Connector, ConnectorType, ConnectorTypeInfo, PreviewResult } from "@/lib/api/types";

export function listTypes() {
  return request<ConnectorTypeInfo[]>("/connectors/types");
}

export function list(query: Query = {}) {
  return requestPaged<Connector>("/connectors", { query });
}

export function get(connectorId: string) {
  return request<Connector>(`/connectors/${connectorId}`);
}

export function create(body: {
  type: ConnectorType;
  name: string;
  config: Record<string, unknown>;
  fieldMapping?: Record<string, string>;
}) {
  return request<Connector>("/connectors", { method: "POST", body });
}

export function update(
  connectorId: string,
  body: {
    name?: string;
    status?: string;
    config?: Record<string, unknown>;
    fieldMapping?: Record<string, string>;
  },
) {
  return request<Connector>(`/connectors/${connectorId}`, { method: "PATCH", body });
}

export function remove(connectorId: string) {
  return request<unknown>(`/connectors/${connectorId}`, { method: "DELETE" });
}

export function validate(connectorId: string) {
  return request<{ valid: boolean; errors?: string[]; connector?: Connector }>(
    `/connectors/${connectorId}/validate`,
    { method: "POST" },
  );
}

export function listRows(connectorId: string, query: Query = {}) {
  return requestPaged<Record<string, unknown>>(`/connectors/${connectorId}/rows`, { query });
}

export function previewFile(connectorId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<PreviewResult>(`/connectors/${connectorId}/preview`, {
    method: "POST",
    formData,
  });
}

export function syncFile(connectorId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ accepted: boolean; jobType?: string; filename?: string }>(
    `/connectors/${connectorId}/sync`,
    { method: "POST", formData },
  );
}

export function syncMongoDB(connectorId: string) {
  return request<{ accepted: boolean; jobType?: string }>(
    `/connectors/${connectorId}/sync-mongodb`,
    { method: "POST", body: {} },
  );
}
