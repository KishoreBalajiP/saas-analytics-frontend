/**
 * Email templates (roadmap 2.4): override the subject / text / HTML of the
 * built-in transactional emails per locale. The backend checks every edit
 * against the template's variable contract, renders previews with sample
 * data without sending anything, and keeps a reversible history. Sends use
 * the saved override and fall back to the built-in.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  InlineFieldErrors,
  TableSkeleton,
} from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as configApi from "@/features/platform-config/api";
import { RevisionHistory } from "@/features/platform-config/components/RevisionHistory";
import { configErrorMessage } from "@/features/platform-config/errors";
import type {
  EmailLocale,
  EmailTemplate,
  EmailTemplateContent,
  EmailTemplatePreview,
} from "@/features/platform-config/types";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

const selectClass = "border-input bg-background w-full rounded-md border px-3 py-2 text-sm";
const LOCALES: { value: EmailLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

export function EmailTemplatesView() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.EMAIL_TEMPLATES_VIEW);
  const [locale, setLocale] = useState<EmailLocale>("en");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const query = useQuery({
    queryKey: configApi.configKeys.templates(locale),
    queryFn: () => configApi.listTemplates(locale),
    enabled: canView,
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Email templates" />;
  if (query.isLoading) return <TableSkeleton rows={4} cols={3} />;
  if (query.isError) {
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Email templates" />
    );
  }
  const templates = query.data ?? [];
  const selected = templates.find((template) => template.key === selectedKey) ?? null;

  return (
    <div className="space-y-6">
      <div className="max-w-xs space-y-1">
        <Label htmlFor="template-locale">Locale</Label>
        <select
          id="template-locale"
          className={selectClass}
          value={locale}
          onChange={(event) => setLocale(event.target.value as EmailLocale)}
        >
          {LOCALES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          A locale without its own override uses the English override, then the built-in text.
        </p>
      </div>

      {templates.length === 0 ? (
        <EmptyState title="No email templates" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => setSelectedKey(template.key)}
              aria-pressed={selectedKey === template.key}
              className={`rounded-lg border p-4 text-left transition hover:bg-muted/40 ${
                selectedKey === template.key ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4" /> {template.name}
                </span>
                <Badge variant={template.customized ? "default" : "outline"}>
                  {template.customized ? `Customized · v${template.version}` : "Built-in"}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{template.key}</p>
              <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <TemplateEditor key={`${selected.key}:${locale}:${selected.version}`} template={selected} />
      ) : null}
    </div>
  );
}

function TemplateEditor({ template }: { template: EmailTemplate }) {
  const { permissions } = useAdminSession();
  const queryClient = useQueryClient();
  const canUpdate = hasPermission(permissions, Permissions.EMAIL_TEMPLATES_UPDATE);
  const locale = template.locale;

  const [subject, setSubject] = useState(template.effective.subject);
  const [text, setText] = useState(template.effective.text);
  const [html, setHtml] = useState(template.effective.html ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [preview, setPreview] = useState<EmailTemplatePreview | null>(null);

  const draft: EmailTemplateContent = { subject, text, html: html.trim() ? html : null };
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [...configApi.configKeys.templates(locale)] });
  const onError = (err: unknown) => {
    setError(err);
    toast.error(configErrorMessage(err));
  };

  const previewMutation = useMutation({
    mutationFn: () => configApi.previewTemplate(template.key, { locale, draft }),
    onSuccess: (rendered) => {
      setError(null);
      setPreview(rendered);
    },
    onError,
  });
  const save = useMutation({
    mutationFn: () =>
      configApi.updateTemplate(template.key, {
        ...draft,
        locale,
        version: template.version,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (saved) => {
      setError(null);
      toast.success(`${saved.name} saved (version ${saved.version})`);
      void refresh();
    },
    onError,
  });
  const reset = useMutation({
    mutationFn: () => configApi.resetTemplate(template.key, { locale, version: template.version }),
    onSuccess: () => {
      toast.success(`${template.name} uses the built-in text again`);
      void refresh();
    },
    onError,
  });
  const rollback = useMutation({
    mutationFn: (toVersion: number) =>
      configApi.rollbackTemplate(template.key, { locale, toVersion, version: template.version }),
    onSuccess: () => {
      toast.success(`${template.name} restored`);
      void refresh();
    },
    onError,
  });
  const busy = save.isPending || reset.isPending || rollback.isPending;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{template.name}</CardTitle>
            <CardDescription>
              Use <code>{"{{ variable }}"}</code> placeholders. Required variables must appear in
              the subject or in each body part.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="mb-4 space-y-1 text-sm" aria-label="Template variables">
              {template.variables.map((variable) => (
                <li key={variable.key}>
                  <code>{`{{${variable.key}}}`}</code>{" "}
                  {variable.required ? <Badge variant="secondary">required</Badge> : null}{" "}
                  <span className="text-muted-foreground">{variable.description}</span>
                </li>
              ))}
            </ul>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="template-subject">Subject</Label>
                <Input
                  id="template-subject"
                  value={subject}
                  maxLength={200}
                  disabled={!canUpdate || busy}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="template-text">Plain-text body</Label>
                <Textarea
                  id="template-text"
                  rows={8}
                  className="font-mono text-xs"
                  value={text}
                  disabled={!canUpdate || busy}
                  onChange={(event) => setText(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="template-html">HTML body (optional)</Label>
                <Textarea
                  id="template-html"
                  rows={6}
                  className="font-mono text-xs"
                  value={html}
                  disabled={!canUpdate || busy}
                  onChange={(event) => setHtml(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Scripts, frames, inline event handlers and javascript: links are refused.
                </p>
              </div>
              {canUpdate ? (
                <div className="space-y-1">
                  <Label htmlFor="template-reason">Reason (optional, kept in history)</Label>
                  <Input
                    id="template-reason"
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Editing templates needs the email_templates.update permission.
                </p>
              )}
              {error ? <InlineFieldErrors error={error} /> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                >
                  <Eye className="mr-1 h-4 w-4" /> Preview
                </Button>
                {canUpdate ? (
                  <Button type="submit" disabled={busy}>
                    <Save className="mr-1 h-4 w-4" /> {save.isPending ? "Saving…" : "Save override"}
                  </Button>
                ) : null}
                {canUpdate && template.customized ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => reset.mutate()}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" /> Use built-in
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>Rendered with sample values. Previews are never sent.</CardDescription>
          </CardHeader>
          <CardContent>
            {preview ? (
              <div className="space-y-3" aria-label="Rendered preview">
                <p className="text-sm">
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="font-medium">{preview.subject}</span>
                </p>
                <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                  {preview.text}
                </pre>
                {preview.html ? (
                  <iframe
                    title="HTML preview"
                    sandbox=""
                    srcDoc={preview.html}
                    className="h-64 w-full rounded-md border border-border bg-white"
                  />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose Preview to render the current draft.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <RevisionHistory<{ customized?: boolean; subject?: string | null }>
        title="History"
        queryKey={configApi.configKeys.templateHistory(template.key, locale)}
        load={() => configApi.templateHistory(template.key, locale, { limit: 50 })}
        currentVersion={template.version}
        canRestore={canUpdate}
        restoring={rollback.isPending}
        onRestore={(revision) => rollback.mutate(revision.version)}
        renderState={(revision) =>
          revision.state?.customized ? (
            <span>Override: “{revision.state.subject}”</span>
          ) : (
            <span className="text-muted-foreground">Built-in text</span>
          )
        }
      />
    </div>
  );
}
