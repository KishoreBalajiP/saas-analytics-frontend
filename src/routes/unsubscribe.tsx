// delivery: roadmap 3.4 - public opt-out page for external report recipients.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import * as deliveryApi from "@/features/reports/api/delivery";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({ meta: [{ title: "Unsubscribe - Analivo" }] }),
  component: UnsubscribePage,
});

export function UnsubscribeCard({ token }: { token: string }) {
  const mutation = useMutation({ mutationFn: () => deliveryApi.unsubscribe(token) });
  return (
    <Card className="mx-auto mt-16 max-w-md">
      <CardHeader>
        <Brand />
        <CardTitle>Unsubscribe from scheduled reports</CardTitle>
        <CardDescription>
          You will no longer receive scheduled reports from this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mutation.isSuccess ? (
          <p role="status">You have been unsubscribed.</p>
        ) : (
          <>
            {mutation.isError || !token ? (
              <p role="alert" className="mb-2 text-sm text-destructive">
                This unsubscribe link is invalid.
              </p>
            ) : null}
            <Button disabled={!token || mutation.isPending} onClick={() => mutation.mutate()}>
              Unsubscribe
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UnsubscribePage() {
  const { token } = Route.useSearch();
  return <UnsubscribeCard token={token} />;
}
