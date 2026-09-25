import type { CSSProperties } from "react";
import { useTranslation } from "@/i18n";
import { cn } from "../lib/utils";
import {
  statusBadge,
  statusBadgeDefault,
  agentStatusMotion,
  agentStatusVar,
  agentStatusVarDefault,
  taskStatusVar,
  taskStatusVarDefault,
} from "../lib/status-colors";
import { StatusGlyph } from "./StatusGlyph";

/** Known StatusBadge statuses. Values are i18n keys, never translated text. */
const STATUS_BADGE_LABEL_KEYS: Record<string, string> = {
  active: "statusbadge.general.active",
  running: "statusbadge.general.running",
  scheduled_retry: "statusbadge.general.scheduledRetry",
  paused: "statusbadge.general.paused",
  idle: "statusbadge.general.idle",
  archived: "statusbadge.general.archived",
  planned: "statusbadge.general.planned",
  achieved: "statusbadge.general.achieved",
  completed: "statusbadge.general.completed",
  failed: "statusbadge.general.failed",
  timed_out: "statusbadge.general.timedOut",
  succeeded: "statusbadge.general.succeeded",
  ok: "statusbadge.general.ok",
  warning: "statusbadge.general.warning",
  error: "statusbadge.general.error",
  info: "statusbadge.general.info",
  terminated: "statusbadge.general.terminated",
  pending: "statusbadge.general.pending",
  queued: "statusbadge.general.queued",
  pending_approval: "statusbadge.general.pendingApproval",
  revision_requested: "statusbadge.general.revisionRequested",
  approved: "statusbadge.general.approved",
  rejected: "statusbadge.general.rejected",
  draft: "statusbadge.general.draft",
  backlog: "statusbadge.general.backlog",
  todo: "statusbadge.general.todo",
  in_progress: "statusbadge.general.inProgress",
  in_review: "statusbadge.general.inReview",
  blocked: "statusbadge.general.blocked",
  done: "statusbadge.general.done",
  cancelled: "statusbadge.general.cancelled",
  allowed: "statusbadge.general.allowed",
  denied: "statusbadge.general.denied",
  block: "statusbadge.general.block",
  "require-approval": "statusbadge.general.requireApproval",
  redacted: "statusbadge.general.redacted",
  "rate-limit": "statusbadge.general.rateLimit",
  deferred: "statusbadge.general.deferred",
  hidden: "statusbadge.general.hidden",
  quarantined: "statusbadge.general.quarantined",
  "runtime-error": "statusbadge.general.runtimeError",
  healthy: "statusbadge.general.healthy",
  degraded: "statusbadge.general.degraded",
  unchecked: "statusbadge.general.unchecked",
};

/** Issue chips keep sentence-case English, so they do not share the lowercase keys. */
const ISSUE_STATUS_LABEL_KEYS: Record<string, string> = {
  backlog: "statusbadge.general.issueBacklog",
  todo: "statusbadge.general.issueTodo",
  in_progress: "statusbadge.general.issueInProgress",
  in_review: "statusbadge.general.issueInReview",
  done: "statusbadge.general.issueDone",
  blocked: "statusbadge.general.issueBlocked",
  cancelled: "statusbadge.general.issueCancelled",
  idle: "statusbadge.general.idle",
};

/** Agent chips. `active` keeps the idle display alias and only the label is translated. */
const AGENT_STATUS_LABEL_KEYS: Record<string, string> = {
  idle: "statusbadge.general.idle",
  active: "statusbadge.general.idle",
  running: "statusbadge.general.running",
  paused: "statusbadge.general.paused",
  error: "statusbadge.general.error",
};

/** Inline `--sc` local var pointing a status helper at a base-hue CSS var. */
function scStyle(cssVar: string): CSSProperties {
  return { "--sc": `var(${cssVar})` } as CSSProperties;
}

/** "in_review" → "In review" (sentence case). */
function sentenceCaseStatus(status: string): string {
  const s = status.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generic status badge for runs / goals / approvals (not task status).
 */
// design-allow(pill-pattern): DECISION-SHEET.md C8 - status badges keep the bespoke WCAG-tuned
// .status-chip color-mix mechanic and do not wrap the Badge primitive.
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const { t } = useTranslation();
  const key = STATUS_BADGE_LABEL_KEYS[status];
  const text = label ?? (key ? t(key) : status.replace(/[_-]/g, " "));
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {text}
    </span>
  );
}

/**
 * Agent status chip — bordered chip recoloured from the editable
 * `--status-agent-*` base hue via the `.status-chip` color-mix helper. `active`
 * renders as "idle" (alias for dead code).
 */
export function AgentStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cssVar = agentStatusVar[status] ?? agentStatusVarDefault;
  const displayStatus = status === "active" ? "idle" : status;
  const key = AGENT_STATUS_LABEL_KEYS[status];
  const label = key ? t(key) : displayStatus.replace(/_/g, " ");
  return (
    <span
      className="status-chip inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium leading-none whitespace-nowrap shrink-0"
      style={scStyle(cssVar)}
    >
      {label}
    </span>
  );
}

/**
 * Agent status indicator — heartbeat capsule (vertical 8x16, r4) filled from the
 * editable `--status-agent-*` base hue. Running agents pulse, broken (error)
 * agents blink; both honor `prefers-reduced-motion`.
 */
export function AgentStatusCapsule({ status }: { status: string }) {
  const cssVar = agentStatusVar[status] ?? agentStatusVarDefault;
  const motion = agentStatusMotion[status] ?? "";
  return (
    <span
      aria-hidden
      className={cn("status-fill inline-block h-4 w-2 rounded-(--rad-4) shrink-0", motion)}
      style={scStyle(cssVar)}
    />
  );
}

/**
 * Issue/task status chip — bordered chip recoloured from the editable
 * `--status-task-*` base hue via `.status-chip`, carrying the unified
 * {@link StatusGlyph} (one distinct, color-blind-safe shape per status), a
 * sentence-cased label and regular weight. `cancelled` is struck through.
 * Distinct from the generic {@link StatusBadge} so run/goal/approval badges are
 * unaffected.
 */
export function IssueStatusBadge({ status: taskStatus, externalConversationState }: { status: string; externalConversationState?: "active" | "waiting" | null }) {
  const { t } = useTranslation();
  const status = taskStatus === "in_review" && externalConversationState === "waiting" ? "idle" : taskStatus;
  const cssVar = taskStatusVar[status] ?? taskStatusVarDefault;
  const key = ISSUE_STATUS_LABEL_KEYS[status];
  const label = key ? t(key) : sentenceCaseStatus(status);
  return (
    <span
      className={cn(
        "status-chip inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-normal leading-none whitespace-nowrap shrink-0",
        status === "cancelled" && "line-through"
      )}
      style={scStyle(cssVar)}
    >
      <StatusGlyph status={status} size="sm" />
      {label}
    </span>
  );
}
