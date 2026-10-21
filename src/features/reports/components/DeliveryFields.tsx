// delivery: roadmap 3.4 - schedule recipients and destinations editor.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api/quota";
import type { DeliveryDestinationType } from "@/lib/api/types";
import * as deliveryApi from "../api/delivery";

export function DeliveryFields({
  externalEmails,
  onExternalEmails,
  destinationIds,
  onDestinationIds,
}: {
  externalEmails: string;
  onExternalEmails: (v: string) => void;
  destinationIds: string[];
  onDestinationIds: (ids: string[]) => void;
}) {
  const client = useQueryClient();
  const destinations = useQuery({
    queryKey: ["delivery-destinations"],
    queryFn: () => deliveryApi.listDestinations(),
  });
  const [type, setType] = useState<DeliveryDestinationType>("slack");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => deliveryApi.createDestination({ type, name: name.trim(), url: url.trim() }),
    onSuccess: (row) => {
      setName("");
      setUrl("");
      setSecret(row.signingSecret ?? null);
      onDestinationIds([...destinationIds, row._id]);
      void client.invalidateQueries({ queryKey: ["delivery-destinations"] });
      toast.success("Destination added");
    },
    onError: (e) => toast.error(errorMessage(e, "Unable to add destination")),
  });
  const toggle = (id: string, on: boolean) =>
    onDestinationIds(on ? [...destinationIds, id] : destinationIds.filter((d) => d !== id));

  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">Delivery</legend>
      <Label>
        External recipients (emails)
        <Input
          value={externalEmails}
          placeholder="client@example.com, cfo@example.com"
          onChange={(e) => onExternalEmails(e.target.value)}
        />
      </Label>
      <div className="space-y-1 text-sm">
        <p className="font-medium">Destinations</p>
        {(destinations.data ?? []).map((d) => (
          <label key={d._id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={destinationIds.includes(d._id)}
              onChange={(e) => toggle(d._id, e.target.checked)}
            />
            {d.name}{" "}
            <span className="text-muted-foreground">
              ({d.type} · {d.urlHint})
            </span>
          </label>
        ))}
        {destinations.data?.length === 0 ? (
          <p className="text-muted-foreground">No destinations yet.</p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <select
          aria-label="Destination type"
          className="rounded-md border px-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as DeliveryDestinationType)}
        >
          <option value="slack">Slack</option>
          <option value="teams">Teams</option>
          <option value="webhook">Webhook</option>
        </select>
        <Input
          aria-label="Destination name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          aria-label="Destination URL"
          type="password"
          placeholder="https://hooks…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!name.trim() || !url.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          Add destination
        </Button>
      </div>
      {secret ? (
        <p role="status" className="break-all text-xs">
          Webhook signing secret (shown once): <code>{secret}</code>
        </p>
      ) : null}
    </fieldset>
  );
}
