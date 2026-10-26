import { ApiError } from "@/lib/api/client";
import type { Connector } from "@/lib/api/types";
import type { SyncRunStatus } from "@/features/datasets/api";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/** How often the dataset page refreshes while a sync is queued or running. */
export const SYNC_POLL_INTERVAL_MS = 5000;

/**
 * True while the connector has a queued or running sync that still holds its
 * lease. A sync whose lease expired (its worker stopped) no longer blocks a
 * new one: the server accepts the next sync request and the stale-job reaper
 * marks the old run Interrupted.
 */
export function isSyncInFlight(
  connector: Pick<Connector, "syncStatus" | "syncLeaseUntil"> | null | undefined,
  now: number = Date.now(),
) {
  if (connector?.syncStatus !== "queued" && connector?.syncStatus !== "running") return false;
  if (!connector.syncLeaseUntil) return true;
  const leaseUntil = new Date(connector.syncLeaseUntil).getTime();
  return Number.isNaN(leaseUntil) || leaseUntil > now;
}

const STATUS_LABELS: Record<string, string> = {
  idle: "Never synced",
  queued: "Queued",
  running: "Running",
  retrying: "Retrying",
  succeeded: "Succeeded",
  failed: "Failed",
  abandoned: "Interrupted",
  cancelled: "Cancelled",
};

export function syncStatusLabel(status: string | null | undefined) {
  if (!status) return STATUS_LABELS["idle"];
  return STATUS_LABELS[status] ?? status;
}

export function syncStatusVariant(
  status: SyncRunStatus | Connector["syncStatus"] | string | null | undefined,
): BadgeVariant {
  switch (status) {
    case "succeeded":
      return "default";
    case "failed":
    case "abandoned":
      return "destructive";
    case "queued":
    case "running":
    case "retrying":
      return "secondary";
    default:
      return "outline";
  }
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual",
  webhook: "Webhook",
  recovery: "Automatic recovery",
  schedule: "Schedule",
};

export function syncTriggerLabel(trigger: string | null | undefined) {
  return trigger ? (TRIGGER_LABELS[trigger] ?? trigger) : "—";
}

/** "850 ms", "12.3 s", "4 min 05 s". */
export function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes} min ${String(rest).padStart(2, "0")} s`;
}

export const SYNC_IN_PROGRESS_MESSAGE =
  "A sync is already running for this dataset. Wait for it to finish, then try again.";
export const SYNC_QUEUE_UNAVAILABLE_MESSAGE =
  "The sync service is temporarily unavailable. Nothing was queued; try again in a minute.";

/**
 * Which sync-slot problem an error is, if any. Other 409s (e.g.
 * CONNECTOR_PAUSED, QUOTA_EXCEEDED) and 503s carry their own code and keep
 * the server's message, so only a code-less status falls back to the slot
 * meaning.
 */
export function syncSlotError(error: unknown): "in_progress" | "queue_unavailable" | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "SYNC_IN_PROGRESS" || (error.statusCode === 409 && !error.code)) {
    return "in_progress";
  }
  if (
    error.code === "QUEUE_TIMEOUT" ||
    error.code === "QUEUE_UNAVAILABLE" ||
    (error.statusCode === 503 && !error.code)
  ) {
    return "queue_unavailable";
  }
  return null;
}

/** User-facing message for a failed sync request. */
export function syncErrorMessage(error: unknown) {
  const slot = syncSlotError(error);
  if (slot === "in_progress") return SYNC_IN_PROGRESS_MESSAGE;
  if (slot === "queue_unavailable") return SYNC_QUEUE_UNAVAILABLE_MESSAGE;
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "Sync failed";
}

/**
 * Whether a dataset can be queried, from its sync bookkeeping:
 *   ready      - it holds data (a re-sync may be running; old data stays queryable)
 *   processing - its first import is queued or running
 *   failed     - its first import failed (no data)
 *   empty      - nothing imported yet (e.g. a webhook with no deliveries)
 * The API refuses queries on `processing` / `failed` datasets (409 DATASET_NOT_READY).
 */
export type DatasetState = "ready" | "processing" | "failed" | "empty";

export function datasetState(
  connector: Pick<Connector, "lastSyncedAt" | "syncStatus"> | null | undefined,
): DatasetState {
  if (connector?.lastSyncedAt) return "ready";
  if (connector?.syncStatus === "queued" || connector?.syncStatus === "running")
    return "processing";
  if (connector?.syncStatus === "failed") return "failed";
  return "empty";
}

export const DATASET_STATE_LABELS: Record<DatasetState, string> = {
  ready: "Ready",
  processing: "Processing",
  failed: "Import failed",
  empty: "No data yet",
};

export function datasetStateVariant(state: DatasetState): BadgeVariant {
  if (state === "ready") return "default";
  if (state === "failed") return "destructive";
  if (state === "processing") return "secondary";
  return "outline";
}

/** Datasets a builder may offer: ready ones, plus any already in use (kept selectable). */
export function selectableDatasets<
  T extends Pick<Connector, "_id" | "lastSyncedAt" | "syncStatus">,
>(connectors: T[], inUse: string[] = []) {
  return connectors.filter((c) => datasetState(c) === "ready" || inUse.includes(c._id));
}
