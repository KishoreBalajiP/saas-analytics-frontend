/**
 * Billing history (billing, roadmap 3.1): the workspace's checkouts and
 * payments, newest first, from `GET /tenants/:id/subscription/transactions`.
 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import * as billingApi from "@/features/billing/api";
import type { BillingTransaction } from "@/features/billing/api";
import { formatMoney } from "@/features/billing/checkout";

const STATUS_LABEL: Record<BillingTransaction["status"], string> = {
  pending: "Awaiting payment",
  authorized: "Authorized (not captured)",
  captured: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  expired: "Expired",
  cancelled: "Abandoned",
};

function statusLabel(txn: BillingTransaction) {
  if (txn.status === "captured" && !txn.applied) return "Paid - applying";
  return STATUS_LABEL[txn.status] ?? txn.status;
}

function statusVariant(
  txn: BillingTransaction,
): "default" | "secondary" | "destructive" | "outline" {
  if (txn.status === "captured") return "default";
  if (txn.status === "failed") return "destructive";
  if (txn.status === "pending" || txn.status === "authorized") return "outline";
  return "secondary";
}

export function BillingHistory({ tenantId }: { tenantId: string }) {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: ["billing", "transactions", tenantId, page],
    queryFn: () => billingApi.listTransactions(tenantId, { page, limit: 10 }),
    enabled: Boolean(tenantId),
  });
  if (history.isLoading) return <TableSkeleton rows={3} cols={4} />;
  if (history.isError) return <ErrorState error={history.error} resource="Billing history" />;
  const rows = history.data?.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No payments yet"
        description="Purchased terms and payment attempts appear here."
      />
    );
  }
  return (
    <div className="space-y-3">
      <ul className="divide-y text-sm" data-testid="billing-history">
        {rows.map((txn) => (
          <li key={txn.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <div className="font-medium">
                {txn.planId} · {txn.interval === "year" ? "12 months" : "1 month"}
              </div>
              <div className="text-muted-foreground text-xs">
                {txn.createdAt ? new Date(txn.createdAt).toLocaleString() : "—"} · {txn.orderId}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>{formatMoney(txn.amountMinor, txn.currency)}</span>
              <Badge variant={statusVariant(txn)}>{statusLabel(txn)}</Badge>
            </div>
          </li>
        ))}
      </ul>
      {(history.data?.meta.pages ?? 1) > 1 && (
        <div className="flex items-center justify-between text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {history.data?.meta.pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= (history.data?.meta.pages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
