import { resolveApiHref } from "@/lib/api/client";

/**
 * Start a browser download of a signed artefact URL (report runs,
 * analytics exports). The URL carries its own short-lived grant, so no
 * bearer token is needed; the server answers with
 * `Content-Disposition: attachment`, and `download` names the file for
 * same-origin links.
 */
export function triggerDownload(url: string, fileName?: string | null) {
  const anchor = document.createElement("a");
  anchor.href = resolveApiHref(url);
  if (fileName) anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** "1,000 rows" / "1 row"; "—" when unknown. */
export function formatRows(count?: number | null) {
  if (count === null || count === undefined) return "—";
  return `${count.toLocaleString()} row${count === 1 ? "" : "s"}`;
}
