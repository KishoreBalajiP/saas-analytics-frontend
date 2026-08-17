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
import type { AnalyticsResult, WidgetType } from "@/lib/api/types";
import { EmptyState } from "@/components/common/states";

const PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function columnsOf(result: AnalyticsResult) {
  if (result.columns?.length) return result.columns;
  const first = result.rows?.[0];
  return first ? Object.keys(first) : [];
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function numericKeys(rows: Array<Record<string, unknown>>) {
  const first = rows[0] ?? {};
  return Object.keys(first).filter((key) => typeof first[key] === "number");
}

function labelKey(rows: Array<Record<string, unknown>>) {
  const first = rows[0] ?? {};
  return Object.keys(first).find((key) => typeof first[key] !== "number") ?? Object.keys(first)[0];
}

export function WidgetView({
  type,
  result,
  height = 260,
}: {
  type: WidgetType;
  result: AnalyticsResult | undefined;
  height?: number;
}) {
  const rows = result?.rows ?? [];

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
    const metricKey = numericKeys(rows)[0] ?? Object.keys(row)[0];
    const value = metricKey ? row[metricKey] : undefined;
    return (
      <div>
        <div className="font-display text-4xl font-semibold tabular-nums">{formatCell(value)}</div>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
          {metricKey ?? "value"}
        </p>
      </div>
    );
  }

  if (type === "table") {
    const columns = columnsOf(result!);
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
                    {formatCell(row[column])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const valueKeys = numericKeys(rows);
  const nameKey = labelKey(rows) ?? "name";

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
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie data={rows} dataKey={key} nameKey={nameKey} outerRadius={90} label>
            {rows.map((_, index) => (
              <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line" || type === "area") {
    const Chart = type === "line" ? LineChart : AreaChart;
    return (
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={rows}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
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
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
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
  );
}
