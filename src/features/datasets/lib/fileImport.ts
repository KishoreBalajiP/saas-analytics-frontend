/** Upload file helpers (client-side checks and naming; the server re-checks everything). */

export function extensionOf(name: string) {
  return /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
}

/** "Q3 sales.xlsx" -> "Q3 sales" (the user can rename it). */
export function datasetNameFromFile(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Client-side check before uploading; the server re-checks the content. */
export function fileProblem(file: File) {
  const ext = extensionOf(file.name);
  if (ext === "xls")
    return "Legacy .xls workbooks are not supported. Save the file as .xlsx and try again.";
  if (!["csv", "txt", "xlsx"].includes(ext)) return "Choose a .csv or .xlsx file.";
  if (file.size === 0) return "The file is empty.";
  return null;
}
