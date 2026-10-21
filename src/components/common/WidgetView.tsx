import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { AnalyticsResult, ResolvedVisualization, WidgetType } from "@/lib/api/types";
import { EmptyState } from "@/components/common/states";
import {
  axesOf,
  formatCell,
  makeNumberFormatter,
  numericKeys,
} from "@/components/common/widgetAxes";

const PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type Row = Record<string, unknown>;

function columnsOf(result: AnalyticsResult) {
  if (result.columns?.length) return result.columns;
  const first = result.rows?.[0];
  return first ? Object.keys(first).filter((k) => !k.startsWith("__")) : [];
}

/** Category labels are strings; nulls follow the spec's null handling. */
function chartRows(
  rows: Row[],
  nameKey: string,
  valueKeys: string[],
  viz?: ResolvedVisualization | null,
) {
  const nulls = viz?.nullHandling ?? "skip";
  const out: Row[] = [];
  for (const row of rows) {
    const label = row[nameKey];
    if ((label === null || label === undefined) && nulls === "skip" && viz) continue;
    const copy: Row = {
      ...row,
      [nameKey]: label === null || label === undefined ? "(empty)" : String(label),
    };
    if (nulls === "zero") for (const key of valueKeys) if (copy[key] === null) copy[key] = 0;
    out.push(copy);
  }
  return out;
}

function axisLabel(result: AnalyticsResult | undefined, viz?: ResolvedVisualization | null) {
  if (!viz?.xField) return undefined;
  if (viz.xBucket) return `${viz.xField} (by ${viz.xBucket}, ${result?.timezone ?? "UTC"})`;
  return viz.xField;
}

function Footnotes({ result }: { result: AnalyticsResult }) {
  const excluded = Object.entries(result.excluded ?? result.provenance?.excluded ?? {});
  const topN = result.topN;
  if (!excluded.length && !topN) return null;
  return (
    <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
      {topN ? (
        <p>
          Top {Math.min(topN.limit, topN.of)} of {topN.of}
          {topN.other ? " (rest grouped as Other)" : ""}
        </p>
      ) : null}
      {excluded.map(([key, n]) => (
        <p key={key}>
          {n.toLocaleString()} non-numeric value{n === 1 ? "" : "s"} excluded from {key}
        </p>
      ))}
    </div>
  );
}

export function WidgetView({
  type,
  result,
  height = 260,
  onPageChange,
}: {
  type: WidgetType;
  result: AnalyticsResult | undefined;
  height?: number;
  /** Table paging (vizbuilder): called with the requested page. */
  onPageChange?: (page: number) => void;
}) {
  const rows = result?.rows ?? [];
  const viz = result?.visualization ?? null;
  const fmt = makeNumberFormatter(viz);

  if (!rows.length) {
    return (
      <EmptyState
        title="No data returned"
        description="The query executed successfully but matched no rows."
      />
    );
  }

  if (type === "kpi") {
    const row = rows[0] ?? {};
    const metricKey = viz?.measures[0] ?? numericKeys(rows)[0] ?? Object.keys(row)[0];
    const value = metricKey ? row[metricKey] : undefined;
    return (
      <div>
        <div className="font-display text-4xl font-semibold tabular-nums">{fmt(value)}</div>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
          {metricKey ?? "value"}
        </p>
        <Footnotes result={result!} />
      </div>
    );
  }

  if (type === "table") {
    const columns = viz?.columns?.length ? viz.columns : columnsOf(result!);
    const measures = new Set(viz?.measures ?? []);
    const page = result?.page ?? 1;
    const pages = result?.pages ?? 1;
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 50).map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column} className="font-mono text-xs">
                    {measures.has(column) ? fmt(row[column]) : formatCell(row[column])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {onPageChange && pages > 1 ? (
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
        <Footnotes result={result!} />
      </div>
    );
  }

  const { nameKey, valueKeys } = axesOf(rows, viz);
  const data = chartRows(rows, nameKey, valueKeys, viz);
  const xLabel = axisLabel(result, viz);

  if (!valueKeys.length) {
    return (
      <EmptyState
        title="No numeric metric"
        description="Charts need at least one numeric metric in the query result."
      />
    );
  }

  if (type === "pie") {
    const key = valueKeys[0]!;
    return (
      <div>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend />
            <Pie data={data} dataKey={key} nameKey={nameKey} outerRadius={90} label>
              {data.map((_, index) => (
                <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <Footnotes result={result!} />
      </div>
    );
  }

  if (type === "line" || type === "area") {
    const Chart = type === "line" ? LineChart : AreaChart;
    return (
      <div>
        <ResponsiveContainer width="100%" height={height}>
          <Chart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={nameKey}
              tick={{ fontSize: 11 }}
              {...(xLabel
                ? { label: { value: xLabel, position: "insideBottom", offset: -2 } }
                : {})}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend />
            {valueKeys.map((key, index) =>
              type === "line" ? (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={PALETTE[index % PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ) : (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={PALETTE[index % PALETTE.length]}
                  fill={PALETTE[index % PALETTE.length]}
                  fillOpacity={0.25}
                />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
        {xLabel ? <p className="text-center text-xs text-muted-foreground">{xLabel}</p> : null}
        <Footnotes result={result!} />
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
          <Tooltip formatter={(v) => fmt(v)} />
          <Legend />
          {valueKeys.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              fill={PALETTE[index % PALETTE.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {xLabel ? <p className="text-center text-xs text-muted-foreground">{xLabel}</p> : null}
      <Footnotes result={result!} />
    </div>
  );
}
