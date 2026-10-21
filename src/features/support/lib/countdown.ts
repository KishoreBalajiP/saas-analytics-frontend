/** `mm:ss` (or `h:mm:ss`) for a number of seconds; never negative. */
export function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Whole seconds from `now` until an ISO instant, or null when unknown. */
export function secondsUntil(iso: string | null | undefined, now: number) {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? null : Math.round((at - now) / 1000);
}
