/**
 * Single source of truth for adapter display metadata.
 *
 * Built-in adapters have entries in `adapterDisplayMap`. External (plugin)
 * adapters get sensible defaults derived from their type string via
 * `getAdapterDisplay()`.
 */
import type { ComponentType } from "react";
import {
  Bot,
  Code,
  Gem,
  Moon,
  MousePointer2,
  Sparkles,
  Terminal,
  Cpu,
} from "lucide-react";
import { OpenCodeLogoIcon } from "@/components/OpenCodeLogoIcon";
import { t } from "@/i18n";

// ---------------------------------------------------------------------------
// Type suffix parsing
// ---------------------------------------------------------------------------

// Suffixes stripped from type ids when deriving a human-readable label for
// unknown (plugin) adapter types. "_local" is a legacy qualifier from before
// first-class Environments and is never displayed; "_gateway" is re-appended
// as " (gateway)" to disambiguate gateway variants. Known adapters in
// `adapterDisplayMap` have final labels and never get a derived suffix.
const STRIPPED_TYPE_SUFFIXES = ["_local", "_gateway"] as const;

// Uses the module-level `t` (not the `useTranslation` hook): this registry is
// called from 15+ non-component call sites; see `ui/src/lib/timeAgo.ts` for
// the same pattern. Known gap: `ui/src/components/agent-config-primitives.tsx`
// caches `getAdapterLabels()` in a module-level constant at import time, so
// that one cached snapshot does not retranslate on a live language switch.
function displaySuffixes(): Record<string, string> {
  return {
    _gateway: t("adapterdisplayregistry.general.suffixGateway"),
  };
}

function getTypeSuffix(type: string): string | null {
  for (const [suffix, mode] of Object.entries(displaySuffixes())) {
    if (type.endsWith(suffix)) return mode;
  }
  return null;
}

function withSuffix(label: string, suffix: string | null): string {
  return suffix ? `${label} (${suffix})` : label;
}

// ---------------------------------------------------------------------------
// Display metadata per adapter type
// ---------------------------------------------------------------------------

export interface AdapterDisplayInfo {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  recommended?: boolean;
  comingSoon?: boolean;
  disabledLabel?: string;
  experimental?: boolean;
  hideFromVisualSelection?: boolean;
}

function adapterDisplayMap(): Record<string, AdapterDisplayInfo> {
  return {
    acpx_local: {
      label: t("adapterdisplayregistry.general.acpxRetired"),
      description: t("adapterdisplayregistry.general.retiredStandaloneAcpxAdapter"),
      icon: Bot,
      comingSoon: true,
      disabledLabel: t("adapterdisplayregistry.general.useClaudeCodeOrCodexWith"),
      hideFromVisualSelection: true,
    },
    claude_local: {
      label: t("adapterdisplayregistry.general.claudeCode"),
      description: t("adapterdisplayregistry.general.claudeCodeCliHarness"),
      icon: Sparkles,
      recommended: true,
    },
    codex_local: {
      label: t("adapterdisplayregistry.general.codex"),
      description: t("adapterdisplayregistry.general.codexCliHarness"),
      icon: Code,
      recommended: true,
    },
    paperclip_runner: {
      label: t("adapterdisplayregistry.general.paperclipRunner"),
      description: t("adapterdisplayregistry.general.experimentalRustRunnerWith"),
      icon: Cpu,
      experimental: true,
    },
    gemini_local: {
      label: t("adapterdisplayregistry.general.geminiCli"),
      description: t("adapterdisplayregistry.general.geminiCliHarness"),
      icon: Gem,
    },
    grok_local: {
      label: t("adapterdisplayregistry.general.grokBuild"),
      description: t("adapterdisplayregistry.general.grokBuildHarness"),
      icon: Bot,
    },
    kimi_local: {
      label: t("adapterdisplayregistry.general.kimiCode"),
      description: t("adapterdisplayregistry.general.kimiCodeCliHarness"),
      icon: Moon,
    },
    hermes_gateway: {
      label: t("adapterdisplayregistry.general.hermesGateway"),
      description: t("adapterdisplayregistry.general.remoteHermesApiServer"),
      icon: Bot,
      hideFromVisualSelection: true,
    },
    hermes_local: {
      label: t("adapterdisplayregistry.general.hermes"),
      description: t("adapterdisplayregistry.general.hermesHarness"),
      icon: Bot,
    },
    opencode_local: {
      label: t("adapterdisplayregistry.general.opencode"),
      description: t("adapterdisplayregistry.general.opencodeMultiProviderHarness"),
      icon: OpenCodeLogoIcon,
    },
    pi_local: {
      label: t("adapterdisplayregistry.general.pi"),
      description: t("adapterdisplayregistry.general.piHarness"),
      icon: Terminal,
    },
    cursor: {
      label: t("adapterdisplayregistry.general.cursor"),
      description: t("adapterdisplayregistry.general.cursorCliHarness"),
      icon: MousePointer2,
    },
    cursor_cloud: {
      label: t("adapterdisplayregistry.general.cursorCloud"),
      description: t("adapterdisplayregistry.general.managedRemoteCursorAgent"),
      icon: MousePointer2,
    },
    openclaw_gateway: {
      label: t("adapterdisplayregistry.general.openclawGateway"),
      description: t("adapterdisplayregistry.general.externalGatewayAdapter"),
      icon: Bot,
      comingSoon: true,
      disabledLabel: t("adapterdisplayregistry.general.inviteExternalAgentsFrom"),
      hideFromVisualSelection: true,
    },
    process: {
      label: t("adapterdisplayregistry.general.process"),
      description: t("adapterdisplayregistry.general.internalProcessAdapter"),
      icon: Cpu,
      comingSoon: true,
    },
    http: {
      label: t("adapterdisplayregistry.general.http"),
      description: t("adapterdisplayregistry.general.internalHttpAdapter"),
      icon: Cpu,
      comingSoon: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function humanizeType(type: string): string {
  // Strip known type suffixes so "droid_local" → "Droid", not "Droid Local"
  let base = type;
  for (const suffix of STRIPPED_TYPE_SUFFIXES) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length);
      break;
    }
  }
  return base.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getAdapterLabel(type: string): string {
  // Known labels are final — only unknown (plugin) types get a derived
  // suffix, so labels like "OpenClaw Gateway" don't become
  // "OpenClaw Gateway (gateway)".
  const known = adapterDisplayMap()[type];
  if (known) return known.label;
  return withSuffix(humanizeType(type), getTypeSuffix(type));
}

export function getAdapterLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [type, info] of Object.entries(adapterDisplayMap())) {
    labels[type] = info.label;
  }
  return labels;
}

export function getAdapterDisplay(type: string): AdapterDisplayInfo {
  const known = adapterDisplayMap()[type];
  if (known) return known;

  const suffix = getTypeSuffix(type);
  const label = withSuffix(humanizeType(type), suffix);
  return {
    label,
    description: suffix
      ? t("adapterdisplayregistry.general.externalAdapterWithSuffix", { suffix })
      : t("adapterdisplayregistry.general.externalAdapterPlain"),
    icon: Cpu,
  };
}

export function isKnownAdapterType(type: string): boolean {
  return type in adapterDisplayMap();
}
