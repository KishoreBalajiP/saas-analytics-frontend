import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Database,
  FileSpreadsheet,
  Globe,
  Webhook,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import * as connectorsApi from "@/lib/api/connectors";
import type { ConnectorType, ConnectorTypeInfo } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<ConnectorType, React.ComponentType<{ className?: string }>> = {
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  mongodb: Database,
  webhook: Webhook,
};

type Step = "type" | "config";

interface CreateConnectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateConnectorDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateConnectorDialogProps) {
  const { data: types, isLoading: typesLoading } = useQuery({
    queryKey: ["connectors", "types"],
    queryFn: connectorsApi.listTypes,
  });

  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<ConnectorType | "">("");
  const [name, setName] = useState("");

  // CSV config
  const [delimiter, setDelimiter] = useState(",");
  const [csvHasHeader, setCsvHasHeader] = useState(true);

  // XLSX config
  const [xlsxHasHeader, setXlsxHasHeader] = useState(true);
  const [sheet, setSheet] = useState("");

  // MongoDB config
  const [mongoUri, setMongoUri] = useState("");
  const [mongoDatabase, setMongoDatabase] = useState("");
  const [mongoCollection, setMongoCollection] = useState("");

  // Webhook config
  const [signingSecret, setSigningSecret] = useState("");
  const [toleranceSeconds, setToleranceSeconds] = useState("300");
  const [requireTimestamp, setRequireTimestamp] = useState(true);

  // Webhook result
  const [webhookToken, setWebhookToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setStep("type");
      setSelectedType("");
      setName("");
      setDelimiter(",");
      setCsvHasHeader(true);
      setXlsxHasHeader(true);
      setSheet("");
      setMongoUri("");
      setMongoDatabase("");
      setMongoCollection("");
      setSigningSecret("");
      setToleranceSeconds("300");
      setRequireTimestamp(true);
      setWebhookToken(null);
      setCopied(false);
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: () => {
      let config: Record<string, unknown>;
      switch (selectedType) {
        case "csv":
          config = { delimiter: delimiter || ",", hasHeader: csvHasHeader };
          break;
        case "xlsx":
          config = { hasHeader: xlsxHasHeader, ...(sheet ? { sheet } : {}) };
          break;
        case "mongodb":
          config = { uri: mongoUri, database: mongoDatabase, collection: mongoCollection };
          break;
        case "webhook":
          config = {
            signingSecret,
            toleranceSeconds: Number(toleranceSeconds) || 300,
            requireTimestamp,
          };
          break;
        default:
          throw new Error(`Unsupported type: ${selectedType}`);
      }
      return connectorsApi.create({ type: selectedType as ConnectorType, name, config });
    },
    onSuccess: (connector) => {
      toast.success("Connector created");
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
      if (connector.type === "webhook" && connector.webhookToken) {
        setWebhookToken(connector.webhookToken);
        return;
      }
      onCreated();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create connector");
    },
  });

  function validate(): boolean {
    if (!name.trim()) return false;
    if (selectedType === "mongodb" && (!mongoUri || !mongoDatabase || !mongoCollection))
      return false;
    if (selectedType === "webhook" && signingSecret.length < 16) return false;
    return true;
  }

  function handleSubmit() {
    if (!validate()) return;
    createMutation.mutate();
  }

  const nameId = useId();
  const typeId = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "type"
              ? "Select connector type"
              : `Configure ${selectedType?.toUpperCase()} connector`}
          </DialogTitle>
          <DialogDescription>
            {step === "type"
              ? "Choose a data source type to get started."
              : "Fill in the details for your connector."}
          </DialogDescription>
        </DialogHeader>

        {step === "type" && !typesLoading && (
          <RadioGroup
            value={selectedType}
            onValueChange={(value) => setSelectedType(value as ConnectorType)}
            className="space-y-2"
            aria-label="Connector type"
          >
            {(types ?? []).map((t) => {
              const Icon = TYPE_ICONS[t.type];
              return (
                <label
                  key={t.type}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50",
                    selectedType === t.type && "border-primary bg-primary/5",
                  )}
                >
                  <RadioGroupItem value={t.type} id={`${typeId}-${t.type}`} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t.displayName}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        )}

        {step === "type" && typesLoading && (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {step === "config" && webhookToken && (
          <div className="space-y-4">
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Webhook created successfully</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Copy your webhook endpoint URL below. It will not be shown again.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                  /webhooks/{webhookToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(`/webhooks/${webhookToken}`);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <Button onClick={onCreated} className="w-full">
              Go to connectors
            </Button>
          </div>
        )}

        {step === "config" && !webhookToken && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={nameId}>Name</Label>
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales Q3 data"
                autoFocus
              />
            </div>

            {selectedType === "csv" && (
              <>
                <div className="space-y-2">
                  <Label>Delimiter</Label>
                  <Input
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value)}
                    placeholder=","
                    maxLength={1}
                    className="w-16"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Has header row</Label>
                  <Switch checked={csvHasHeader} onCheckedChange={setCsvHasHeader} />
                </div>
              </>
            )}

            {selectedType === "xlsx" && (
              <>
                <div className="flex items-center justify-between">
                  <Label>Has header row</Label>
                  <Switch checked={xlsxHasHeader} onCheckedChange={setXlsxHasHeader} />
                </div>
                <div className="space-y-2">
                  <Label>Sheet name (optional)</Label>
                  <Input
                    value={sheet}
                    onChange={(e) => setSheet(e.target.value)}
                    placeholder="Leave blank for first sheet"
                  />
                </div>
              </>
            )}

            {selectedType === "mongodb" && (
              <>
                <div className="space-y-2">
                  <Label>Connection URI</Label>
                  <Input
                    value={mongoUri}
                    onChange={(e) => setMongoUri(e.target.value)}
                    placeholder="mongodb://user:pass@host:port/db"
                  />
                  <p className="text-xs text-muted-foreground">
                    <AlertCircle className="mr-1 inline h-3 w-3" />
                    Credentials are never stored or displayed after submission.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Database</Label>
                  <Input
                    value={mongoDatabase}
                    onChange={(e) => setMongoDatabase(e.target.value)}
                    placeholder="my_database"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Collection</Label>
                  <Input
                    value={mongoCollection}
                    onChange={(e) => setMongoCollection(e.target.value)}
                    placeholder="my_collection"
                  />
                </div>
              </>
            )}

            {selectedType === "webhook" && (
              <>
                <div className="space-y-2">
                  <Label>Signing Secret</Label>
                  <Input
                    type="password"
                    value={signingSecret}
                    onChange={(e) => setSigningSecret(e.target.value)}
                    placeholder="At least 16 characters"
                    autoComplete="off"
                  />
                  {signingSecret.length > 0 && signingSecret.length < 16 && (
                    <p className="text-xs text-destructive">
                      Secret must be at least 16 characters
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <AlertCircle className="mr-1 inline h-3 w-3" />
                    The secret is never stored client-side or displayed after creation.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Tolerance (seconds)</Label>
                  <Input
                    type="number"
                    value={toleranceSeconds}
                    onChange={(e) => setToleranceSeconds(e.target.value)}
                    className="w-32"
                    min={0}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Require timestamp header</Label>
                  <Switch checked={requireTimestamp} onCheckedChange={setRequireTimestamp} />
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("type")}
                disabled={createMutation.isPending}
              >
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={!validate() || createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create connector"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "type" && !webhookToken && (
          <DialogFooter>
            <Button onClick={() => setStep("config")} disabled={!selectedType}>
              Next
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
