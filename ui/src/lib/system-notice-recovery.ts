import type { IssueCommentMetadata, IssueCommentMetadataRow } from "@paperclipai/shared";
import { t } from "@/i18n";

const TITLE_KEYS: Record<string, string> = {
  "Automatic recovery blocked": "recoveryNoticeTitleBlocked",
  "No live execution path": "recoveryNoticeTitleNoExecutionPath",
  "Workspace validation failed": "recoveryNoticeTitleWorkspaceValidation",
  "Configuration incomplete": "recoveryNoticeTitleConfigurationIncomplete",
  "Review recovery stalled": "recoveryNoticeTitleReviewStalled",
  "Error: usage limit reached": "recoveryNoticeTitleUsageLimit",
  "Error: not logged in to Claude": "recoveryNoticeTitleClaudeLogin",
  "Error: agent login required": "recoveryNoticeTitleAgentLogin",
  "Workspace scan timed out": "recoveryNoticeTitleWorkspaceScanTimeout",
  "Workspace scan queue is full": "recoveryNoticeTitleWorkspaceScanSaturated",
  "Workspace scan exceeded its limit": "recoveryNoticeTitleWorkspaceScanLimit",
  "Workspace scan failed": "recoveryNoticeTitleWorkspaceScanFailed",
  "Workspace scan was cancelled": "recoveryNoticeTitleWorkspaceScanCancelled",
  "AI connection needs attention": "recoveryNoticeTitleAiConnection",
  "Continuation failed": "recoveryNoticeTitleContinuationFailed",
  "Missing disposition recovery blocked": "recoveryNoticeTitleMissingDisposition",
};

const SECTION_KEYS: Record<string, string> = {
  Recovery: "recoveryNoticeSectionRecovery",
  "Run evidence": "recoveryNoticeSectionRunEvidence",
  Evidence: "recoveryNoticeSectionEvidence",
  "Required action": "recoveryNoticeSectionRequiredAction",
};

const FIELD_KEYS: Record<string, string> = {
  "Recovery action": "recoveryNoticeFieldRecoveryAction",
  "Recovery owner": "recoveryNoticeFieldRecoveryOwner",
  "Next action": "recoveryNoticeFieldNextAction",
  "Source run": "recoveryNoticeFieldSourceRun",
  "Failure code": "recoveryNoticeFieldFailureCode",
  "Failure summary": "recoveryNoticeFieldFailureSummary",
  "Source issue": "recoveryNoticeFieldSourceIssue",
  "Recovery issue": "recoveryNoticeFieldRecoveryIssue",
  "Board waiting path": "recoveryNoticeFieldBoardWaitingPath",
  "Source assignee": "recoveryNoticeFieldSourceAssignee",
  "Suggested action": "recoveryNoticeFieldSuggestedAction",
  "Latest issue status": "recoveryNoticeFieldLatestIssueStatus",
  "Latest handoff run status": "recoveryNoticeFieldLatestRunStatus",
  "Corrective handoff run": "recoveryNoticeFieldCorrectiveRun",
  "Normalized cause": "recoveryNoticeFieldNormalizedCause",
  "Missing disposition": "recoveryNoticeFieldMissingDisposition",
  "Status before": "recoveryNoticeFieldStatusBefore",
  "Status after": "recoveryNoticeFieldStatusAfter",
  "Previous status": "recoveryNoticeFieldStatusBefore",
  "Current status": "recoveryNoticeFieldStatusAfter",
  Task: "recoveryNoticeFieldTask",
  Agent: "recoveryNoticeFieldAgent",
  Run: "recoveryNoticeFieldRun",
};

const STATUS_KEYS: Record<string, string> = {
  todo: "recoveryNoticeStatusTodo",
  in_progress: "recoveryNoticeStatusInProgress",
  in_review: "recoveryNoticeStatusInReview",
  blocked: "recoveryNoticeStatusBlocked",
  done: "recoveryNoticeStatusDone",
  cancelled: "recoveryNoticeStatusCancelled",
  queued: "recoveryNoticeStatusQueued",
  running: "recoveryNoticeStatusRunning",
  succeeded: "recoveryNoticeStatusSucceeded",
  failed: "recoveryNoticeStatusFailed",
  timed_out: "recoveryNoticeStatusTimedOut",
  cancelled_by_user: "recoveryNoticeStatusCancelled",
};

const ERROR_CODES: Record<string, string> = {
  provider_quota: "recoveryNoticeTitleUsageLimit",
  claude_auth_required: "recoveryNoticeTitleClaudeLogin",
  acpx_auth_required: "recoveryNoticeTitleAgentLogin",
  workspace_git_scan_timeout: "recoveryNoticeTitleWorkspaceScanTimeout",
  workspace_git_scan_saturated: "recoveryNoticeTitleWorkspaceScanSaturated",
  workspace_git_scan_output_limit: "recoveryNoticeTitleWorkspaceScanLimit",
  workspace_git_scan_failed: "recoveryNoticeTitleWorkspaceScanFailed",
  workspace_git_scan_cancelled: "recoveryNoticeTitleWorkspaceScanCancelled",
};

const NEXT_ACTION_KEYS: Record<string, string> = {
  "The recovery owner should either restore a live execution path or record the manual resolution on the source issue":
    "recoveryNoticeNextActionOwner",
  "Inspect the evidence, then retry the original owner, explicitly reassign, repair the execution path, or record an intentional resolution":
    "recoveryNoticeNextActionBoard",
  "inspect the evidence, then retry the original owner, explicitly reassign, or record a valid issue disposition":
    "recoveryNoticeNextActionHandoff",
  "Reconnect the selected AI account or choose an available connection, then continue the task.":
    "recoveryNoticeNextActionReconnectAi",
  "Check repository access and server load, then retry the task.": "recoveryNoticeNextActionWorkspaceTimeout",
  "Check server load and the workspace scan queue, then retry the task.": "recoveryNoticeNextActionWorkspaceQueue",
  "Check the repository size and workspace scan output limit before retrying the task.":
    "recoveryNoticeNextActionWorkspaceLimit",
  "Inspect the failed run and check repository access and integrity before retrying the task.":
    "recoveryNoticeNextActionWorkspaceFailed",
  "Inspect why workspace preparation was cancelled before retrying the task.":
    "recoveryNoticeNextActionWorkspaceCancelled",
};

const KNOWN_SIMPLE_BODIES: Record<string, string> = {
  "Paperclip could not restore a live execution path for this issue automatically. Moving it to `blocked` so it is visible for intervention.":
    "recoveryNoticeBodyDefault",
  "Paperclip stopped before launching the local adapter because the issue workspace failed validation. Moving it to `blocked` so the workspace link, cwd, or git checkout can be repaired before resuming.":
    "recoveryNoticeBodyWorkspaceValidation",
  "This task paused because its selected AI account is unavailable. Reconnect the account or choose an available connection to continue.":
    "recoveryNoticeBodyAiUnavailable",
  "Paperclip stopped before dispatching the adapter because required secret/env bindings are missing. Moving it to `blocked` so an operator can bind the missing secret(s) before resuming.":
    "recoveryNoticeBodyMissingBindings",
  "Paperclip retried the pending execution-review participant once, but the review stage still has no completed decision or live reviewer run. Moving it to `blocked` so the board can inspect the evidence, repair the reviewer runtime, restore the review stage, or record an intentional manual resolution.":
    "recoveryNoticeBodyReviewStalled",
  "Paperclip cannot continue the pending execution-review participant because the participant is not invokable and the review stage has no completed decision or live reviewer run. Moving it to `blocked` so the board can inspect the evidence, repair the reviewer runtime, restore the review stage, or record an intentional manual resolution.":
    "recoveryNoticeBodyReviewUnavailable",
  "Paperclip could not resolve this issue's missing disposition automatically. The source assignment is unchanged and a board decision is required.":
    "recoveryNoticeBodyHandoffExhausted",
};

const WORKSPACE_SCAN_BODY: Record<string, string> = {
  workspace_git_scan_timeout: "recoveryNoticeBodyWorkspaceTimeout",
  workspace_git_scan_saturated: "recoveryNoticeBodyWorkspaceQueue",
  workspace_git_scan_output_limit: "recoveryNoticeBodyWorkspaceLimit",
  workspace_git_scan_failed: "recoveryNoticeBodyWorkspaceFailed",
  workspace_git_scan_cancelled: "recoveryNoticeBodyWorkspaceCancelled",
};

const RETRY_WITHOUT_LIVE_PATH = /^(Paperclip automatically retried dispatch for this assigned `todo` issue(?: during terminal run recovery| after a lost wake\/run)?),? (but it still has no live execution path\.) Moving it to `blocked` so it is visible for intervention\.$/;
const CONTINUATION_WITHOUT_LIVE_PATH = /^Paperclip automatically retried continuation for this assigned `in_progress` issue(?<detail>.*?)but it still has no live execution path(?<attempts> \([^)]+\))?\. Moving it to `blocked` so it is visible for intervention\.$/;
const NON_RETRYABLE_BODY = /^Paperclip detected a non-retryable failure on this issue's continuation run \(`(?<code>[^`]+)`\)\. Skipping automatic retries and moving it to `blocked` so it is visible for intervention\.$/;
const UNSAFE_RECOVERY_BODY = /^Paperclip cannot safely continue automatic recovery because the (?<reason>original assignee is not invokable|original recovery target is over budget)\. The source assignment is unchanged and the board must choose the next action\.$/;
const WORKSPACE_SCAN_BODY_PREFIX = "Paperclip could not prepare the workspace before the agent started. Automatic recovery could not continue.";
const SANDBOX_PLUGIN_BODY = /^Paperclip stopped before dispatching the adapter because the sandbox provider plugin `(?<pluginKey>[^`]+)` is in status `(?<pluginStatus>[^`]+)` and cannot lease a sandbox\. Runs will keep failing the same way until the plugin is `ready` again\. Moving it to `blocked` so an operator can (?<remedy>.+) before resuming\.$/;
const LEGACY_MISSING_BINDINGS_BODY = /^Paperclip stopped before dispatching the adapter because required secret\/env bindings are missing\. Latest retry failure: `configuration_incomplete`\. Moving it to `blocked` (?:with a source-scoped recovery action|so an operator can bind the missing secret\(s\)(?: before resuming)?)\.$/;

function recoveryT(key: string, values?: Record<string, unknown>) {
  return t(`tok225review.${key}`, values);
}

function localizeStatus(value: string) {
  const key = STATUS_KEYS[value];
  return key ? recoveryT(key) : value;
}

export function localizeRecoveryNoticeTitle(title?: string | null, body?: string): string | null {
  const trimmed = title?.trim();
  if (trimmed && TITLE_KEYS[trimmed]) return recoveryT(TITLE_KEYS[trimmed]);
  if (trimmed && ERROR_CODES[trimmed]) return recoveryT(ERROR_CODES[trimmed]);
  if (trimmed) return null;
  const errorCode = body?.match(/Latest retry failure: `([^`]+)`/)?.[1];
  if (errorCode && ERROR_CODES[errorCode]) return recoveryT(ERROR_CODES[errorCode]);
  const bodyText = body ?? "";
  if (KNOWN_SIMPLE_BODIES[bodyText]) {
    const bodyKey = KNOWN_SIMPLE_BODIES[bodyText];
    if (bodyKey === "recoveryNoticeBodyReviewStalled" || bodyKey === "recoveryNoticeBodyReviewUnavailable") return recoveryT("recoveryNoticeTitleReviewStalled");
    if (bodyKey === "recoveryNoticeBodyWorkspaceValidation") return recoveryT("recoveryNoticeTitleWorkspaceValidation");
    if (bodyKey === "recoveryNoticeBodyAiUnavailable") return recoveryT("recoveryNoticeTitleAiConnection");
    if (bodyKey === "recoveryNoticeBodyHandoffExhausted") return recoveryT("recoveryNoticeTitleMissingDisposition");
    return recoveryT("recoveryNoticeTitleBlocked");
  }
  if (bodyText.startsWith("Paperclip cannot safely continue automatic recovery")) return recoveryT("recoveryNoticeTitleBlocked");
  if (bodyText.startsWith("Paperclip detected a non-retryable failure on this issue's continuation run")) return recoveryT("recoveryNoticeTitleContinuationFailed");
  if (bodyText.startsWith(WORKSPACE_SCAN_BODY_PREFIX)) {
    const scanCode = Object.keys(NEXT_ACTION_TEXT).find((code) => bodyText.includes(NEXT_ACTION_TEXT[code]!));
    if (scanCode && ERROR_CODES[scanCode]) return recoveryT(ERROR_CODES[scanCode]!);
  }
  if (bodyText.startsWith("Paperclip stopped before dispatching the adapter because the sandbox provider plugin")) return recoveryT("recoveryNoticeTitleConfigurationIncomplete");
  if (bodyText.includes("secret/env bindings are missing")) return recoveryT("recoveryNoticeTitleConfigurationIncomplete");
  if (bodyText.includes("workspace failed validation")) return recoveryT("recoveryNoticeTitleWorkspaceValidation");
  if (bodyText.includes("no live execution path")) return recoveryT("recoveryNoticeTitleNoExecutionPath");
  if (bodyText.includes("selected AI account is unavailable")) return recoveryT("recoveryNoticeTitleAiConnection");
  return null;
}

export function localizeRecoveryNoticeBody(body: string): string {
  const simpleKey = KNOWN_SIMPLE_BODIES[body];
  if (simpleKey) return recoveryT(simpleKey);
  if (LEGACY_MISSING_BINDINGS_BODY.test(body)) return recoveryT("recoveryNoticeBodyMissingBindings");

  const workspaceError = Object.keys(WORKSPACE_SCAN_BODY).find((code) =>
    body.startsWith(WORKSPACE_SCAN_BODY_PREFIX) && body.includes(NEXT_ACTION_TEXT[code]!),
  );
  if (workspaceError) return recoveryT(WORKSPACE_SCAN_BODY[workspaceError]!);

  const retryMatch = body.match(RETRY_WITHOUT_LIVE_PATH);
  if (retryMatch) {
    return recoveryT("recoveryNoticeBodyDispatchRetry");
  }

  const continuationMatch = body.match(CONTINUATION_WITHOUT_LIVE_PATH);
  if (continuationMatch) {
    const progress = continuationMatch.groups?.detail?.includes("made progress") ?? false;
    const attempts = continuationMatch.groups?.attempts?.match(/\((\d+)× attempts\)/)?.[1];
    return recoveryT("recoveryNoticeBodyContinuationRetry", {
      status: localizeStatus("in_progress"),
      progress: progress ? recoveryT("recoveryNoticeProgressMade") : "",
      attempts: attempts ? recoveryT("recoveryNoticeAttemptCount", { count: attempts }) : "",
    });
  }

  const unsafeMatch = body.match(UNSAFE_RECOVERY_BODY);
  if (unsafeMatch) {
    return unsafeMatch.groups?.reason === "original assignee is not invokable"
      ? recoveryT("recoveryNoticeBodyAssigneeUnavailable")
      : recoveryT("recoveryNoticeBodyTargetOverBudget");
  }

  const nonRetryableMatch = body.match(NON_RETRYABLE_BODY);
  if (nonRetryableMatch) {
    return recoveryT("recoveryNoticeBodyNonRetryable", { code: nonRetryableMatch.groups?.code ?? "" });
  }

  const pluginMatch = body.match(SANDBOX_PLUGIN_BODY);
  if (pluginMatch?.groups) {
    const remedyKey = pluginRemedyKey(pluginMatch.groups.pluginStatus);
    return recoveryT("recoveryNoticeBodySandboxPlugin", {
      pluginKey: pluginMatch.groups.pluginKey,
      pluginStatus: pluginStatusLabel(pluginMatch.groups.pluginStatus),
      pluginReadyStatus: pluginStatusLabel("ready"),
      remedy: recoveryT(remedyKey),
    });
  }

  return body;
}

const NEXT_ACTION_TEXT: Record<string, string> = {
  workspace_git_scan_timeout: "Check repository access and server load, then retry the task.",
  workspace_git_scan_saturated: "Check server load and the workspace scan queue, then retry the task.",
  workspace_git_scan_output_limit: "Check the repository size and workspace scan output limit before retrying the task.",
  workspace_git_scan_failed: "Inspect the failed run and check repository access and integrity before retrying the task.",
  workspace_git_scan_cancelled: "Inspect why workspace preparation was cancelled before retrying the task.",
};

function pluginRemedyKey(status: string) {
  if (status === "upgrade_pending") return "recoveryNoticePluginRemedyUpgrade";
  if (status === "disabled") return "recoveryNoticePluginRemedyDisabled";
  return "recoveryNoticePluginRemedyDefault";
}

function pluginStatusLabel(status: string) {
  const keys: Record<string, string> = {
    ready: "recoveryNoticePluginStatusReady",
    disabled: "recoveryNoticePluginStatusDisabled",
    upgrade_pending: "recoveryNoticePluginStatusUpgradePending",
  };
  const key = keys[status];
  if (!key) return status;
  const label = recoveryT(key);
  return label === status ? label : `${label} (${status})`;
}

function localizeMetadataValue(row: IssueCommentMetadataRow): IssueCommentMetadataRow {
  if (row.type === "key_value") {
    if (row.label === "Recovery owner" && row.value === "Board decision required") {
      return { ...row, value: recoveryT("recoveryNoticeBoardDecisionRequired") };
    }
    if ((row.label === "Next action" || row.label === "Suggested action") && NEXT_ACTION_KEYS[row.value]) {
      return { ...row, value: recoveryT(NEXT_ACTION_KEYS[row.value]!) };
    }
    if (row.label === "Board waiting path") {
      if (row.value.startsWith("recovery_owner:")) {
        return { ...row, value: `${recoveryT("recoveryNoticeWaitingForOwner")}: ${row.value.slice("recovery_owner:".length)}` };
      }
      if (row.value.startsWith("issue_thread_interaction:")) {
        return { ...row, value: `${recoveryT("recoveryNoticeWaitingForBoardResponse")}: ${row.value.slice("issue_thread_interaction:".length)}` };
      }
      if (row.value.startsWith("unavailable:")) {
        return { ...row, value: `${recoveryT("recoveryNoticeWaitingPathUnavailable")}: ${row.value.slice("unavailable:".length)}` };
      }
    }
    if (["Status", "Status before", "Status after", "Previous status", "Current status", "Latest issue status", "Latest handoff run status", "Missing disposition"].includes(row.label ?? "")) {
      return { ...row, value: localizeStatus(row.value) };
    }
    if (row.label === "Recovery cause" && row.value === "stranded_assigned_issue") {
      return { ...row, value: recoveryT("recoveryNoticeCauseStrandedIssue") };
    }
    return row;
  }
  if (row.type === "run_link" && row.title) {
    return { ...row, title: localizeStatus(row.title) };
  }
  return row;
}

export function isStrandedRecoveryNotice(input: {
  title?: string | null;
  body: string;
  metadata?: IssueCommentMetadata | null;
}): boolean {
  if (input.title && TITLE_KEYS[input.title.trim()]) return true;
  if (input.title && input.title.trim() === "Missing disposition recovery blocked") return true;
  if (Object.keys(ERROR_CODES).some((code) => input.body.includes(`\`${code}\``))) return true;
  if (input.body.startsWith("Paperclip automatically retried ") && input.body.includes("no live execution path")) return true;
  if (input.body.startsWith("Paperclip cannot safely continue automatic recovery")) return true;
  if (input.body.startsWith(WORKSPACE_SCAN_BODY_PREFIX)) return true;
  if (KNOWN_SIMPLE_BODIES[input.body]) return true;
  if (input.body.startsWith("Paperclip stopped before dispatching the adapter because the sandbox provider plugin")) return true;
  if (input.body.startsWith("Paperclip detected a non-retryable failure on this issue's continuation run")) return true;
  if (input.body.includes("secret/env bindings are missing")) return true;
  if (input.body.includes("workspace failed validation")) return true;
  if (input.body.startsWith("Paperclip could not resolve this issue's missing disposition automatically.")) return true;
  return Boolean(Array.isArray(input.metadata?.sections) && input.metadata.sections.some((section) =>
    section.title === "Recovery" && section.rows.some((row) =>
      (row.type === "key_value" && row.label === "Recovery action") ||
      (row.type === "agent_link" && row.label === "Recovery owner"),
    ),
  ));
}

export function localizeRecoveryMetadata(metadata: IssueCommentMetadata | null | undefined): IssueCommentMetadata | null | undefined {
  if (!metadata || !Array.isArray(metadata.sections)) return metadata;
  return {
    ...metadata,
    sections: metadata.sections.map((section) => ({
      ...section,
      title: section.title && SECTION_KEYS[section.title]
        ? recoveryT(SECTION_KEYS[section.title]!)
        : section.title,
      rows: section.rows.map((row) => {
        const localizedRow = localizeMetadataValue(row);
        const labelKey = localizedRow.label ? FIELD_KEYS[localizedRow.label] : undefined;
        return labelKey ? { ...localizedRow, label: recoveryT(labelKey) } : localizedRow;
      }),
    })),
  };
}

export function localizeRecoveryMetadataIfApplicable(input: {
  title?: string | null;
  body: string;
  metadata: IssueCommentMetadata | null | undefined;
}): IssueCommentMetadata | null | undefined {
  return isStrandedRecoveryNotice(input) ? localizeRecoveryMetadata(input.metadata) : input.metadata;
}
