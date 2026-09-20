import { useState, useRef, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { AGENT_ROLE_LABELS } from "@paperclipai/shared";
import { t } from "@/i18n";
import { getAdapterLabels } from "../adapters/adapter-display-registry";

/* ---- Help text for (?) tooltips ---- */
// Uses the module-level `t` (not the `useTranslation` hook): `help` is a plain
// object consumed via `help.xxx` property access from 4 other files
// (AgentConfigForm.tsx, AgentDetail.tsx, AgentDetail.production.tsx,
// CompanyImport.tsx via the re-exported `help`), so a Proxy below resolves
// each property through this function on every access instead of freezing a
// translated snapshot at import time. Same reasoning as `adapterLabels` below.
function helpText(): Record<string, string> {
  return {
    name: t("agentconfigprimitives.general.name"),
    title: t("agentconfigprimitives.general.jobTitleShownIn"),
    role: t("agentconfigprimitives.general.role"),
    reportsTo: t("agentconfigprimitives.general.reportsTo"),
    capabilities: t("agentconfigprimitives.general.capabilities"),
    adapterType: t("agentconfigprimitives.general.adapterType"),
    cwd: t("agentconfigprimitives.general.cwd"),
    promptTemplate: t("agentconfigprimitives.general.promptTemplate"),
    model: t("agentconfigprimitives.general.model"),
    thinkingEffort: t("agentconfigprimitives.general.thinkingEffort"),
    chrome: t("agentconfigprimitives.general.chrome"),
    dangerouslySkipPermissions: t("agentconfigprimitives.general.dangerouslySkipPermissions"),
    dangerouslyBypassSandbox: t("agentconfigprimitives.general.dangerouslyBypassSandbox"),
    search: t("agentconfigprimitives.general.search"),
    fastMode: t("agentconfigprimitives.general.fastMode"),
    workspaceStrategy: t("agentconfigprimitives.general.workspaceStrategy"),
    workspaceBaseRef: t("agentconfigprimitives.general.workspaceBaseRef"),
    workspaceBranchTemplate: t("agentconfigprimitives.general.workspaceBranchTemplate"),
    worktreeParentDir: t("agentconfigprimitives.general.worktreeParentDir"),
    runtimeServicesJson: t("agentconfigprimitives.general.runtimeServicesJson"),
    maxTurnsPerRun: t("agentconfigprimitives.general.maxTurnsPerRun"),
    command: t("agentconfigprimitives.general.command"),
    localCommand: t("agentconfigprimitives.general.localCommand"),
    args: t("agentconfigprimitives.general.args"),
    extraArgs: t("agentconfigprimitives.general.extraArgs"),
    envVars: t("agentconfigprimitives.general.envVars"),
    secretAccess: t("agentconfigprimitives.general.secretAccess"),
    bootstrapPrompt: t("agentconfigprimitives.general.bootstrapPrompt"),
    payloadTemplateJson: t("agentconfigprimitives.general.payloadTemplateJson"),
    webhookUrl: t("agentconfigprimitives.general.webhookUrl"),
    heartbeatInterval: t("agentconfigprimitives.general.heartbeatInterval"),
    intervalSec: t("agentconfigprimitives.general.intervalSec"),
    timeoutSec: t("agentconfigprimitives.general.timeoutSec"),
    graceSec: t("agentconfigprimitives.general.graceSec"),
    wakeOnDemand: t("agentconfigprimitives.general.wakeOnDemand"),
    cooldownSec: t("agentconfigprimitives.general.cooldownSec"),
    maxConcurrentRuns: t("agentconfigprimitives.general.maxConcurrentRuns"),
    maxTurnContinuationEnabled: t("agentconfigprimitives.general.maxTurnContinuationEnabled"),
    maxTurnContinuationMaxAttempts: t("agentconfigprimitives.general.maxTurnContinuationMaxAttempts"),
    maxTurnContinuationDelaySec: t("agentconfigprimitives.general.maxTurnContinuationDelaySec"),
    budgetMonthlyCents: t("agentconfigprimitives.general.budgetMonthlyCents"),
  };
}

export const help: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_target, prop: string) => helpText()[prop],
});

// Same live-Proxy reasoning as `help` above: `adapterLabels` is consumed via
// `adapterLabels[type]` property access from AgentConfigForm.tsx,
// CompanyImport.tsx, AgentSkillsTab.tsx, AgentDetail.tsx and
// AgentDetail.production.tsx. Fixes the snapshot-at-import-time gap batch 12
// flagged: a plain `const adapterLabels = getAdapterLabels()` froze the
// English labels forever because it only ran once, at module load.
export const adapterLabels: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_target, prop: string) => getAdapterLabels()[prop],
});

export const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

/* ---- Primitive components ---- */

export function HintIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode; configSection?: import("../adapters/types").AdapterConfigSection }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  toggleTestId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  toggleTestId?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <HintIcon text={hint} />}
      </div>
      {/* Gallery feedback r3: was a hand-rolled h-5 w-9 pill with a bg-green-600
          track — the app's second switch implementation. Converged on the one
          canonical ToggleSwitch (status-green on-state), DESIGN.md principle 1. */}
      <ToggleSwitch
        data-testid={toggleTestId}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
}

export function ToggleWithNumber({
  label,
  hint,
  checked,
  onCheckedChange,
  number,
  onNumberChange,
  numberLabel,
  numberHint,
  numberPrefix,
  showNumber,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  number: number;
  onNumberChange: (v: number) => void;
  numberLabel: string;
  numberHint?: string;
  numberPrefix?: string;
  showNumber: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {hint && <HintIcon text={hint} />}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {showNumber && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {numberPrefix && <span>{numberPrefix}</span>}
          <input
            type="number"
            className="w-16 rounded-md border border-border px-2 py-0.5 bg-transparent outline-none text-xs font-mono text-center"
            value={number}
            onChange={(e) => onNumberChange(Number(e.target.value))}
          />
          <span>{numberLabel}</span>
          {numberHint && <HintIcon text={numberHint} />}
        </div>
      )}
    </div>
  );
}

export function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  bordered,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(bordered && "border-t border-border")}>
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        {title}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function AutoExpandTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  minRows,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={{ minHeight }}
    />
  );
}

/**
 * Text input that manages internal draft state.
 * Calls `onCommit` on blur (and optionally on every change if `immediate` is set).
 */
export function DraftInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      {...props}
    />
  );
}

/**
 * Auto-expanding textarea with draft state and blur-commit.
 */
export function DraftTextarea({
  value,
  onCommit,
  immediate,
  placeholder,
  minRows,
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  placeholder?: string;
  minRows?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [draft, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      style={{ minHeight }}
    />
  );
}

/**
 * Number input with draft state and blur-commit.
 */
export function DraftNumberInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: number;
  onCommit: (v: number) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type">) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(Number(e.target.value) || 0);
      }}
      onBlur={() => {
        const num = Number(draft) || 0;
        if (num !== value) onCommit(num);
      }}
      {...props}
    />
  );
}

/**
 * Label + input rendered on the same line (inline layout for compact fields).
 */
export function InlineField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      <div className="w-24 ml-auto">{children}</div>
    </div>
  );
}
