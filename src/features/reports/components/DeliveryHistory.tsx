// delivery: roadmap 3.4 - per-delivery history of a report with retry.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { errorMessage } from "@/lib/api/quota";
import type { DeliveryRun } from "@/lib/api/types";
import * as deliveryApi from "../api/delivery";

const STATUS_VARIANT: Record<
  DeliveryRun["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  retrying: "secondary",
  sent: "default",
  dead: "destructive",
  skipped: "outline",
};

export function DeliveryHistory({ reportId, canRetry }: { reportId: string; canRetry: boolean }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["deliveries", reportId],
    queryFn: () => deliveryApi.listDeliveries({ sourceId: reportId, limit: 50 }),
  });
  const retry = useMutation({
    mutationFn: (id: string) => deliveryApi.retryDelivery(id),
    onSuccess: (row) => {
      toast[row.status === "sent" ? "success" : "warning"](`Delivery ${row.status}`);
      void client.invalidateQueries({ queryKey: ["deliveries", reportId] });
    },
    onError: (e) => toast.error(errorMessage(e, "Unable to retry delivery")),
  });
  const rows = query.data?.data ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Delivery history</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isError ? (
          <p className="text-sm text-destructive">Unable to load deliveries.</p>
        ) : rows.length ? (
          <table className="w-full text-sm" aria-label="Deliveries">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">Recipient</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t">
                  <td className="py-1">{row.recipient}</td>
                  <td className="capitalize">{row.destinationType}</td>
                  <td>
                    <Badge variant={STATUS_VARIANT[row.status]} className="capitalize">
                      {row.status}
                    </Badge>
                  </td>
                  <td>{row.attempts}</td>
                  <td className="text-xs text-destructive">{row.lastError ?? ""}</td>
                  <td className="text-right">
                    {canRetry && (row.status === "dead" || row.status === "retrying") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate(row._id)}
                        aria-label={`Retry delivery to ${row.recipient}`}
                      >
                        Retry
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No deliveries yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
