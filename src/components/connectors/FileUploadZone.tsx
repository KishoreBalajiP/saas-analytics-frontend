import { Copy, Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEFAULT_ACCEPT = ".csv,.txt,.xlsx,.xls";

function matchesAccept(file: File, accept: string) {
  const patterns = accept
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (!patterns.length) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return patterns.some((pattern) => {
    const base = pattern.startsWith(".") ? pattern.slice(1) : pattern;
    if (base.endsWith("/*")) {
      const prefix = base.slice(0, -2);
      return type.startsWith(`${prefix}/`);
    }
    return name.endsWith(base) || type === base;
  });
}

export function FileUploadZone({
  onFileSelect,
  accept = DEFAULT_ACCEPT,
  label = "Drag and drop a file here, or click to browse",
  isProcessing = false,
  className,
}: {
  onFileSelect: (file: File) => void;
  accept?: string;
  label?: string;
  isProcessing?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function acceptFile(file: File) {
    if (!matchesAccept(file, accept)) {
      setError(`File type not allowed. Accepted: ${accept}`);
      return;
    }
    setError(null);
    setSelected(file);
    onFileSelect(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) acceptFile(file);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="File upload area"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-muted/50",
          dragOver && "border-primary bg-primary/5",
          isProcessing && "pointer-events-none opacity-60",
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Accepted: {accept}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {selected ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
          <span className="truncate font-mono text-xs">{selected.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(null);
              setError(null);
            }}
            disabled={isProcessing}
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function CopyableValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-1">
      {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : null}
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs">{value}</code>
        <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy value">
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      {copied ? <p className="text-xs text-success">Copied!</p> : null}
    </div>
  );
}
