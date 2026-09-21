import type { AnalyticsQueryParams } from "@/lib/api/types";

export interface QueryValidationError {
  field: string;
  message: string;
}

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
    if (!metric.field.trim()) {
      errors.push({ field: `metric-${index}`, message: "Enter a field for every metric." });
    } else if (metric.field.trim().startsWith("$")) {
      errors.push({ field: `metric-${index}`, message: "Field names cannot start with $." });
    }
  });

  const groupFields = params.groupBy ?? [];
  groupFields.forEach((field, index) => {
    if (!field.trim()) {
      errors.push({ field: `group-${index}`, message: "Enter a field for every group." });
    } else if (field.trim().startsWith("$")) {
      errors.push({ field: `group-${index}`, message: "Field names cannot start with $." });
    }
  });
  const nonEmptyGroups = groupFields.filter((field) => field.trim());
  if (new Set(nonEmptyGroups).size !== nonEmptyGroups.length) {
    errors.push({ field: "groupBy", message: "Group-by fields must be unique." });
  }

  params.filters?.forEach((filter, index) => {
    if (!filter.field.trim()) {
      errors.push({ field: `filter-${index}`, message: "Enter a field for every filter." });
    } else if (filter.field.trim().startsWith("$")) {
      errors.push({ field: `filter-${index}`, message: "Field names cannot start with $." });
    }
    if (filter.op !== "exists" && (filter.value === "" || filter.value === null)) {
      errors.push({ field: `filter-${index}`, message: "Enter a value for this filter." });
    }
  });

  params.orderBy?.forEach((order, index) => {
    if (!order.field.trim()) {
      errors.push({ field: `sort-${index}`, message: "Enter a field for every sort rule." });
    } else if (order.field.trim().startsWith("$")) {
      errors.push({ field: `sort-${index}`, message: "Field names cannot start with $." });
    }
  });

  const from = params.dateRange?.from ? Date.parse(params.dateRange.from) : undefined;
  const to = params.dateRange?.to ? Date.parse(params.dateRange.to) : undefined;
  if (from !== undefined && Number.isNaN(from)) {
    errors.push({ field: "dateFrom", message: "Enter a valid start date." });
  }
  if (to !== undefined && Number.isNaN(to)) {
    errors.push({ field: "dateTo", message: "Enter a valid end date." });
  }
  if (from !== undefined && to !== undefined && from > to) {
    errors.push({ field: "dateRange", message: "Start date must be on or before end date." });
  }

  return errors;
}
