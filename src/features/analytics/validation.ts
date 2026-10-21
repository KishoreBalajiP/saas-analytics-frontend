import type { AnalyticsQueryParams } from "@/lib/api/types";
import { isSafeFieldName } from "@/features/analytics/dateRange";

export interface QueryValidationError {
  field: string;
  message: string;
}

const UNSAFE_NAME = "Field names cannot contain $ or .";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Client-side checks that mirror the API's strict query contract so most
 * mistakes are caught before a round trip. The server stays authoritative and
 * answers 400 INVALID_QUERY with field errors for anything missed here.
 */
export function validateAnalyticsQuery(params: AnalyticsQueryParams): QueryValidationError[] {
  const errors: QueryValidationError[] = [];

  if (!params.connectorIds?.length) {
    errors.push({ field: "connectors", message: "Select at least one dataset." });
  }
  if (params.page !== undefined && (!Number.isInteger(params.page) || params.page < 1)) {
    errors.push({ field: "page", message: "Page must be a whole number greater than zero." });
  }
  if (
    params.limit !== undefined &&
    (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 200)
  ) {
    errors.push({ field: "limit", message: "Limit must be a whole number between 1 and 200." });
  }

  params.metrics?.forEach((metric, index) => {
    const field = (metric.field ?? "").trim();
    if (!field && metric.op !== "count") {
      errors.push({ field: `metric-${index}`, message: "Enter a field for every metric." });
    } else if (field && !isSafeFieldName(field)) {
      errors.push({ field: `metric-${index}`, message: UNSAFE_NAME });
    }
  });

  const groupFields = (params.groupBy ?? []).map((group) =>
    typeof group === "string" ? group : group.field,
  );
  groupFields.forEach((field, index) => {
    if (!field.trim()) {
      errors.push({ field: `group-${index}`, message: "Enter a field for every group." });
    } else if (!isSafeFieldName(field)) {
      errors.push({ field: `group-${index}`, message: UNSAFE_NAME });
    }
  });
  const nonEmptyGroups = groupFields.filter((field) => field.trim());
  if (new Set(nonEmptyGroups).size !== nonEmptyGroups.length) {
    errors.push({ field: "groupBy", message: "Group-by fields must be unique." });
  }

  params.filters?.forEach((filter, index) => {
    if (!filter.field.trim()) {
      errors.push({ field: `filter-${index}`, message: "Enter a field for every filter." });
    } else if (!isSafeFieldName(filter.field)) {
      errors.push({ field: `filter-${index}`, message: UNSAFE_NAME });
    }
    if (filter.op !== "exists" && (filter.value === "" || filter.value === null)) {
      errors.push({ field: `filter-${index}`, message: "Enter a value for this filter." });
    }
  });

  params.orderBy?.forEach((order, index) => {
    if (!order.field.trim()) {
      errors.push({ field: `sort-${index}`, message: "Enter a field for every sort rule." });
    } else if (!isSafeFieldName(order.field)) {
      errors.push({ field: `sort-${index}`, message: UNSAFE_NAME });
    }
  });

  const range = params.dateRange;
  if (range) {
    if (!range.field?.trim()) {
      errors.push({
        field: "dateRange-field",
        message: "Choose the date column the range applies to.",
      });
    } else if (!isSafeFieldName(range.field)) {
      errors.push({ field: "dateRange-field", message: UNSAFE_NAME });
    }
    const relative = range.preset && range.preset !== "custom";
    if (!relative) {
      if (!range.from && !range.to) {
        errors.push({ field: "dateRange", message: "Enter a start date, an end date, or both." });
      }
      const from = range.from ? Date.parse(range.from) : undefined;
      const to = range.to ? Date.parse(range.to) : undefined;
      if (range.from && (!ISO_DATE.test(range.from) || Number.isNaN(from))) {
        errors.push({ field: "dateFrom", message: "Enter a valid start date." });
      }
      if (range.to && (!ISO_DATE.test(range.to) || Number.isNaN(to))) {
        errors.push({ field: "dateTo", message: "Enter a valid end date." });
      }
      if (from !== undefined && to !== undefined && from > to) {
        errors.push({ field: "dateRange", message: "Start date must be on or before end date." });
      }
    }
  }

  return errors;
}
