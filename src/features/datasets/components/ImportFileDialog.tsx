import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as connectorsApi from "@/features/datasets/api";
import type { FileImportOptions, FilePreview } from "@/features/datasets/api";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/quota";
import { datasetNameFromFile, extensionOf, fileProblem } from "@/features/datasets/lib/fileImport";

const ACCEPT = ".csv,.txt,.xlsx";
const DELIMITERS = [
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;)" },
  { value: "\\t", label: "Tab" },
  { value: "|", label: "Pipe (|)" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cellText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Upload file -> name -> preview -> Create dataset. The dataset is created
 * and its import queued in one request; the dataset page then shows
 * Processing until the import succeeds (or why it failed).
 */
export function ImportFileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ids = useId();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [options, setOptions] = useState<FileImportOptions>({ hasHeader: true });
  const [preview, setPreview] = useState<FilePreview | null>(null);

  const previewMutation = useMutation({
    mutationFn: ({ f, opts }: { f: File; opts: FileImportOptions }) =>
      connectorsApi.previewNewFile(f, opts),
    onSuccess: (result) => setPreview(result),
    onError: () => setPreview(null),
  });
  const importMutation = useMutation({
    mutationFn: () => connectorsApi.importFile(file!, { name: name.trim(), ...options }),
    onSuccess: ({ connector }) => {
      toast.success(`Dataset "${connector.name}" created. Importing…`);
      void queryClient.invalidateQueries({ queryKey: ["connectors"] });
      close(false);
      void navigate({ to: "/datasets/$connectorId", params: { connectorId: connector._id } });
    },
  });

  function reset() {
    setFile(null);
    setFileError(null);
    setName("");
    setOptions({ hasHeader: true });
    setPreview(null);
    previewMutation.reset();
    importMutation.reset();
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function choose(f: File | undefined) {
    if (!f) return;
    const problem = fileProblem(f);
    setFile(problem ? null : f);
    setFileError(problem);
    setPreview(null);
    importMutation.reset();
    if (problem) return;
    if (!name.trim()) setName(datasetNameFromFile(f.name));
    const opts: FileImportOptions = { hasHeader: true };
    setOptions(opts);
    previewMutation.mutate({ f, opts });
  }

  function changeOptions(patch: FileImportOptions) {
    const next = { ...options, ...patch };
    setOptions(next);
    if (file) previewMutation.mutate({ f: file, opts: next });
  }

  const nameError =
    importMutation.error instanceof ApiError && importMutation.error.code === "DATASET_NAME_TAKEN"
      ? importMutation.error.message
      : null;
  const importError = importMutation.isError && !nameError ? importMutation.error : null;
  const sheets = Array.isArray(preview?.meta?.["sheets"])
    ? (preview!.meta!["sheets"] as string[])
    : [];
  const fields = preview?.fields ?? [];
  const sample = preview?.sample ?? [];
  const noRows = !!preview && (!fields.length || !sample.length);
  const canCreate =
    !!file &&
    !!name.trim() &&
    !!preview &&
    !noRows &&
    !previewMutation.isPending &&
    !importMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload a file</DialogTitle>
          <DialogDescription>
            Import a CSV or Excel (.xlsx) file as a dataset you can query, chart and add to
            dashboards.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canCreate) importMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${ids}-file`}>File</Label>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3">
              <input
                ref={inputRef}
                id={`${ids}-file`}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  choose(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mr-1 h-4 w-4" /> {file ? "Choose another file" : "Choose file"}
              </Button>
              {file ? (
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">.csv or .xlsx</span>
              )}
            </div>
            {fileError ? (
              <p role="alert" className="text-sm text-destructive">
                {fileError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${ids}-name`}>Dataset name</Label>
            <Input
              id={`${ids}-name`}
              value={name}
              maxLength={120}
              placeholder="e.g. Orders 2026"
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) importMutation.reset();
              }}
            />
            {nameError ? (
              <p role="alert" className="text-sm text-destructive">
                {nameError}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Names are unique in this workspace. You can rename the dataset later.
              </p>
            )}
          </div>

          {file ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                <span>First row has column names</span>
                <Switch
                  checked={options.hasHeader !== false}
                  onCheckedChange={(checked) => changeOptions({ hasHeader: checked })}
                  aria-label="First row has column names"
                />
              </label>
              {preview?.type === "csv" || (!preview && extensionOf(file.name) !== "xlsx") ? (
                <label className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                  <span>Separator</span>
                  <select
                    aria-label="Separator"
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={options.delimiter ?? ","}
                    onChange={(e) => changeOptions({ delimiter: e.target.value })}
                  >
                    {DELIMITERS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {sheets.length > 1 ? (
                <label className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                  <span>Worksheet</span>
                  <select
                    aria-label="Worksheet"
                    className="h-8 max-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
                    value={options.sheet ?? String(preview?.meta?.["sheetName"] ?? sheets[0])}
                    onChange={(e) => changeOptions({ sheet: e.target.value })}
                  >
                    {sheets.map((sheet) => (
                      <option key={sheet} value={sheet}>
                        {sheet}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {previewMutation.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the file…
            </p>
          ) : previewMutation.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(previewMutation.error, "The file could not be read.")}
            </p>
          ) : preview ? (
            <div className="space-y-2" aria-label="File preview">
              <p className="text-xs text-muted-foreground">
                {fields.length} column{fields.length === 1 ? "" : "s"} · showing the first{" "}
                {sample.length} row{sample.length === 1 ? "" : "s"}
                {preview.meta?.["sheetName"]
                  ? ` of sheet "${String(preview.meta["sheetName"])}"`
                  : ""}
              </p>
              {noRows ? (
                <p role="alert" className="text-sm text-destructive">
                  No data rows found{sheets.length > 1 ? " on this sheet" : ""}. Choose another
                  {sheets.length > 1 ? " worksheet" : " file"}.
                </p>
              ) : (
                <div className="max-h-64 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {fields.map((f) => (
                          <TableHead key={f} className="whitespace-nowrap">
                            {f}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sample.map((row, i) => (
                        <TableRow key={i}>
                          {fields.map((f) => (
                            <TableCell
                              key={f}
                              className="max-w-[12rem] truncate py-1 font-mono text-xs"
                            >
                              {cellText((row as Record<string, unknown>)[f])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : null}

          {importError ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(importError, "The dataset could not be created.")}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canCreate}>
              {importMutation.isPending ? "Creating…" : "Create dataset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
