import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/DataTable";
import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as adminApi from "@/features/admin/api";
import type { OutboxMessage, OutboxStatus } from "@/features/admin/api";
import type { PaginationMeta } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useAdminSession } from "@/lib/auth/session";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

type Variant = "default" | "secondary" | "destructive" | "outline";

function statusVariant(status?: string | null): Variant {
  if (status === "ok" || status === "sent") return "default";
  if (status === "down" || status === "dead") return "destructive";
  if (status === "degraded" || status === "retrying" || status === "sending") return "secondary";
  return "outline";
}

const FILTERS: Array<{ label: string; value: OutboxStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Dead letters", value: "dead" },
  { label: "Retrying", value: "retrying" },
  { label: "Pending", value: "pending" },
];

const HEALTH_TEXT: Record<string, string> = {
  disabled: "No mail transport is configured: email is recorded but not delivered.",
  down: "The mail server is unreachable or rejecting sends.",
  degraded: "Some messages are dead-lettered or waiting longer than 15 minutes.",
  ok: "Email is being delivered.",
};

/**
 * Mail transport and email-outbox health, with the outbox messages and a
 * requeue action for dead letters (`monitoring.update`). Callers gate the
 * page on `monitoring.view`.
 */
export function MailMonitoring() {
  const { permissions } = useAdminSession();
  const canRequeue = hasPermission(permissions, Permissions.MONITORING_UPDATE);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<OutboxStatus | "">("");
  const [page, setPage] = useState(1);

  const health = useQuery({
    queryKey: ["admin", "monitoring", "mail"],
    queryFn: adminApi.mailHealth,
    refetchInterval: 30000,
  });
  const messages = useQuery({
    queryKey: ["admin", "monitoring", "outbox", status, page],
    queryFn: () => adminApi.listOutbox({ page, limit: 20, status: status || undefined }),
  });
  const requeue = useMutation({
    mutationFn: (id: string) => adminApi.requeueOutboxMessage(id),
    onSuccess: () => {
      toast.success("Message requeued");
      void queryClient.invalidateQueries({ queryKey: ["admin", "monitoring", "outbox"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "monitoring", "mail"] });
    },
    onError: (err: Error) => toast.error(`Requeue failed: ${err.message}`),
  });

  const columns: Column<OutboxMessage & Record<string, unknown>>[] = [
    {
      key: "template",
      header: "Template",
      render: (m) => <span className="font-mono text-xs">{m.template}</span>,
    },
    { key: "to", header: "To", render: (m) => m.to.join(", ") },
    {
      key: "status",
      header: "Status",
      render: (m) => (
        <Badge variant={statusVariant(m.status)} className="capitalize">
          {m.status}
        </Badge>
      ),
    },
    {
      key: "attempts",
      header: "Attempts",
      render: (m) => `${m.attempts}${m.maxAttempts ? ` / ${m.maxAttempts}` : ""}`,
    },
    {
      key: "next",
      header: "Next / sent",
      render: (m) =>
        m.status === "sent"
          ? date(m.sentAt)
          : m.status === "dead"
            ? date(m.deadAt)
            : date(m.nextAttemptAt),
    },
    {
      key: "lastError",
      header: "Last error",
      render: (m) =>
        m.lastError?.message ? (
          <span className="text-destructive">{m.lastError.message}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "",
      render: (m) =>
        canRequeue && m.status === "dead" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={requeue.isPending}
            onClick={() => requeue.mutate(m.id)}
            aria-label={`Requeue ${m.template} message`}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Requeue
          </Button>
        ) : null,
    },
  ];

  const h = health.data;
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Email delivery</CardTitle>
          {h ? (
            <Badge variant={statusVariant(h.status)} className="capitalize">
              {h.status}
            </Badge>
          ) : null}
        </div>
        {health.isLoading ? (
          <TableSkeleton rows={1} cols={4} />
        ) : health.isError ? (
          <ErrorState
            error={health.error}
            onRetry={() => health.refetch()}
            resource="Mail health"
          />
        ) : h ? (
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">{HEALTH_TEXT[h.status] ?? ""}</p>
            <p>
              Transport <span className="font-mono">{h.transport}</span> · backlog{" "}
              {h.outbox.backlog} · dead letters {h.outbox.dead} · last sent{" "}
              {date(h.outbox.lastSentAt)}
            </p>
            {h.sends.lastError?.message ? (
              <p className="text-destructive">Last failure: {h.sends.lastError.message}</p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter outbox by status">
          {FILTERS.map((filter) => (
            <Button
              key={filter.label}
              size="sm"
              variant={status === filter.value ? "default" : "outline"}
              aria-pressed={status === filter.value}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {messages.isLoading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : messages.isError ? (
          <ErrorState error={messages.error} onRetry={() => messages.refetch()} resource="Outbox" />
        ) : (
          <DataTable
            columns={columns}
            data={(messages.data?.data ?? []) as (OutboxMessage & Record<string, unknown>)[]}
            meta={messages.data?.meta as PaginationMeta | undefined}
            onPageChange={setPage}
            getRowId={(m) => String(m.id)}
            emptyMessage="No messages."
          />
        )}
      </CardContent>
    </Card>
  );
}
