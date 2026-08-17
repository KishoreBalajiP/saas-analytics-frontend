import { apiUrl } from "./client";
import { serializeQueryParams } from "./analytics";
import type { AnalyticsQueryParams } from "./types";

/**
 * The external API is authenticated with `X-Api-Key: <prefix>.<secret>`.
 * Per the security rules we never embed a real key in browser code — this module
 * only builds the request recipe (URL + header name) so the UI can render a
 * copyable curl command.
 */
export function externalCurl(path: string, query?: Record<string, string | number>) {
  const url = apiUrl(path, query);
  return `curl -H "X-Api-Key: <prefix>.<secret>" "${url}"`;
}

export const externalRecipes = {
  listDatasets: (page = 1, limit = 50) => externalCurl("/external/datasets", { page, limit }),
  getDataset: (datasetId: string) => externalCurl(`/external/datasets/${datasetId}`),
  queryDataset: (datasetId: string, params: AnalyticsQueryParams) => {
    const query = serializeQueryParams(params) as Record<string, string | number>;
    return externalCurl(`/external/datasets/${datasetId}/query`, query);
  },
  listDatasetRows: (datasetId: string, page = 1, limit = 100) =>
    externalCurl(`/external/datasets/${datasetId}/rows`, { page, limit }),
  getDashboard: (dashboardId: string) => externalCurl(`/external/dashboards/${dashboardId}`),
};
