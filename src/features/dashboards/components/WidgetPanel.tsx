import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { WidgetView } from "@/components/common/WidgetView";
import * as dashboardsApi from "@/features/dashboards/api";
import type { AnalyticsResult, Widget } from "@/lib/api/types";

import { ProvenancePanel } from "./ProvenancePanel";

/**
 * A widget's rendered result plus the provenance panel (vizbuilder). Page 1
 * comes from the dashboard execution; other table pages are fetched from the
 * single-widget execute endpoint.
 */
export function WidgetPanel({
  dashboardId,
  widget,
  result,
}: {
  dashboardId: string;
  widget: Widget;
  result: AnalyticsResult;
}) {
  const [page, setPage] = useState(1);
  const pageQuery = useQuery({
    queryKey: ["dashboards", dashboardId, "widgets", widget._id, "execute", { page }],
    queryFn: () => dashboardsApi.executeWidget(dashboardId, widget._id, { page }),
    enabled: page > 1,
  });
  const shown = page > 1 && pageQuery.data ? pageQuery.data.result : result;
  return (
    <>
      <WidgetView
        type={widget.type}
        result={shown}
        {...(widget.type === "table" ? { onPageChange: setPage } : {})}
      />
      <ProvenancePanel provenance={shown.provenance} />
    </>
  );
}
