/** Anything the backend can mark broken when its dataset is deleted. */
export interface BrokenAware {
  brokenAt?: string | null;
  brokenReason?: string | null;
}

export function isBroken(entity: BrokenAware | null | undefined): boolean {
  return Boolean(entity?.brokenAt);
}

/** Human explanation of a `brokenReason` code. */
export function brokenReasonText(reason?: string | null): string {
  if (reason === "CONNECTOR_DELETED" || reason === "DATASET_DELETED") {
    return "The dataset it reads from was deleted.";
  }
  return "A dataset it depends on is no longer available.";
}
