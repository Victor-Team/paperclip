import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { copyTextToClipboard } from "@/lib/clipboard";
import { t, useTranslation } from "@/i18n";

export function CopyField({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  useTranslation();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <code title={value} className="min-w-0 flex-1 truncate text-xs">
          {value}
        </code>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("tok225.copy_named_field", { label })}
          onClick={async () => {
            try {
              await copyTextToClipboard(value);
              setCopied(true);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? t("tok225.copied") : t("tok225.copy")}
        </Button>
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
            {t("tok225.copy_failed_select_text")}
          </p>
          <textarea
            readOnly
            aria-label={t("tok225.named_field_text", { label })}
            value={value}
            rows={5}
            className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}

export function AgentInstructions({ value }: { value: string }) {
  useTranslation();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <section
      aria-label={t("tok225.agent_instructions")}
      className="space-y-3 rounded-md bg-muted/40 p-4"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{t("tok225.agent_instructions")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("tok225.agent_instructions_help")}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        aria-label={t("tok225.copy_for_agent")}
        onClick={async () => {
          try {
            await copyTextToClipboard(value);
            setCopied(true);
            setError(false);
          } catch {
            setError(true);
          }
        }}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? t("tok225.copied_instructions") : t("tok225.copy_for_agent")}
      </Button>
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
            {t("tok225.copy_failed_select_instructions")}
          </p>
          <textarea
            readOnly
            aria-label={t("tok225.agent_instructions_text")}
            value={value}
            rows={5}
            className="w-full rounded-md border border-input bg-background p-3 text-sm"
          />
        </div>
      )}
    </section>
  );
}
