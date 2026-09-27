import type { IssueCommentMetadata, IssueCommentPresentation } from "@paperclipai/shared";
import {
  agentLinkRow,
  keyValueRow,
  runLinkRow,
  systemNoticePresentation,
  type NoticeMetadataRow,
  type NoticeMetadataSection,
} from "./notice-format.js";

// Short human-readable body plus the presentation header for one recovery
// family. The escalation path merges in the metadata rows only it knows
// (recovery action, owner, source run) via buildStrandedRecoveryEscalationNotice.
export type StrandedRecoveryNoticeSeed = {
  body: string;
  title: string;
  tone: IssueCommentPresentation["tone"];
  nextAction?: string;
};

export type StrandedRecoveryEscalationNotice = {
  body: string;
  presentation: IssueCommentPresentation;
  metadata: IssueCommentMetadata;
};

export const DEFAULT_STRANDED_RECOVERY_NOTICE_BODY =
  "Paperclip could not restore a live execution path for this issue automatically. " +
  "Moving it to `blocked` so it is visible for intervention.";

/** Default collapsed-card title. Locale mapping keys off this exact string. */
export const DEFAULT_STRANDED_RECOVERY_NOTICE_TITLE = "Automatic recovery blocked";

export const STRANDED_RECOVERY_TITLE_NO_LIVE_EXECUTION_PATH = "No live execution path";
export const STRANDED_RECOVERY_TITLE_WORKSPACE_VALIDATION_FAILED = "Workspace validation failed";
export const STRANDED_RECOVERY_TITLE_CONFIGURATION_INCOMPLETE = "Configuration incomplete";
export const STRANDED_RECOVERY_TITLE_AI_CONNECTION_NEEDS_ATTENTION = "AI connection needs attention";
export const STRANDED_RECOVERY_TITLE_REVIEW_RECOVERY_STALLED = "Review recovery stalled";
export const STRANDED_RECOVERY_TITLE_PROVIDER_QUOTA = "Error: usage limit reached";
export const STRANDED_RECOVERY_TITLE_CLAUDE_AUTH_REQUIRED = "Error: not logged in to Claude";
export const STRANDED_RECOVERY_TITLE_ACPX_AUTH_REQUIRED = "Error: agent login required";

export const STRANDED_RECOVERY_SECTION_RECOVERY = "Recovery";
export const STRANDED_RECOVERY_SECTION_RUN_EVIDENCE = "Run evidence";

export const STRANDED_RECOVERY_LABEL_RECOVERY_ACTION = "Recovery action";
export const STRANDED_RECOVERY_LABEL_RECOVERY_OWNER = "Recovery owner";
export const STRANDED_RECOVERY_LABEL_NEXT_ACTION = "Next action";
export const STRANDED_RECOVERY_LABEL_SOURCE_RUN = "Source run";
export const STRANDED_RECOVERY_LABEL_FAILURE_CODE = "Failure code";
export const STRANDED_RECOVERY_LABEL_FAILURE_SUMMARY = "Failure summary";

/** Sentinel value on Recovery owner when there is no invokable agent. */
export const STRANDED_RECOVERY_BOARD_DECISION_REQUIRED = "Board decision required";

export const STRANDED_RECOVERY_NEXT_ACTION_WHEN_OWNER_PRESENT =
  "The recovery owner should either restore a live execution path or record the manual resolution on the source issue";
export const STRANDED_RECOVERY_NEXT_ACTION_WHEN_BOARD_REQUIRED =
  "Inspect the evidence, then retry the original owner, explicitly reassign, repair the execution path, or record an intentional resolution";

export const STRANDED_RECOVERY_AI_CONNECTION_UNAVAILABLE_REASON = "ai_connection_unavailable";
export const STRANDED_RECOVERY_AI_CONNECTION_NEXT_ACTION =
  "Reconnect the selected AI account or choose an available connection, then continue the task.";
export const STRANDED_RECOVERY_AI_CONNECTION_NOTICE_BODY =
  "This task paused because its selected AI account is unavailable. Reconnect the account or choose an available connection to continue.";

export const STRANDED_RECOVERY_NOTICE_TITLES_BY_CAUSE = {
  workspace_validation_failed: STRANDED_RECOVERY_TITLE_WORKSPACE_VALIDATION_FAILED,
  configuration_incomplete: STRANDED_RECOVERY_TITLE_CONFIGURATION_INCOMPLETE,
  execution_review_participant_recovery: STRANDED_RECOVERY_TITLE_REVIEW_RECOVERY_STALLED,
} as const;

// Titles keyed by the source run's classified error code. The raw failure text
// never reaches the issue thread (summarizeRunFailureForIssueComment withholds
// it), so the classified code is the only safe, specific cause the collapsed
// notice row can lead with. A mapped code outranks the seed titles because the
// seeds describe the recovery family ("No live execution path"), not the cause.
export const STRANDED_RECOVERY_NOTICE_TITLES_BY_RUN_ERROR_CODE = {
  provider_quota: STRANDED_RECOVERY_TITLE_PROVIDER_QUOTA,
  claude_auth_required: STRANDED_RECOVERY_TITLE_CLAUDE_AUTH_REQUIRED,
  acpx_auth_required: STRANDED_RECOVERY_TITLE_ACPX_AUTH_REQUIRED,
} as const;

export const WORKSPACE_SCAN_NOTICES = {
  workspace_git_scan_timeout: {
    title: "Workspace scan timed out",
    nextAction: "Check repository access and server load, then retry the task.",
  },
  workspace_git_scan_saturated: {
    title: "Workspace scan queue is full",
    nextAction: "Check server load and the workspace scan queue, then retry the task.",
  },
  workspace_git_scan_output_limit: {
    title: "Workspace scan exceeded its limit",
    nextAction: "Check the repository size and workspace scan output limit before retrying the task.",
  },
  workspace_git_scan_failed: {
    title: "Workspace scan failed",
    nextAction: "Inspect the failed run and check repository access and integrity before retrying the task.",
  },
  workspace_git_scan_cancelled: {
    title: "Workspace scan was cancelled",
    nextAction: "Inspect why workspace preparation was cancelled before retrying the task.",
  },
} as const;

export type WorkspaceScanErrorCode = keyof typeof WORKSPACE_SCAN_NOTICES;
export type StrandedRecoveryCauseTitleKey = keyof typeof STRANDED_RECOVERY_NOTICE_TITLES_BY_CAUSE;
export type StrandedRecoveryRunErrorTitleKey = keyof typeof STRANDED_RECOVERY_NOTICE_TITLES_BY_RUN_ERROR_CODE;

export function workspaceScanNoticeForErrorCode(errorCode: string | null | undefined) {
  if (!errorCode) return undefined;
  if (errorCode in WORKSPACE_SCAN_NOTICES) {
    return WORKSPACE_SCAN_NOTICES[errorCode as WorkspaceScanErrorCode];
  }
  return undefined;
}

function titleForRunErrorCode(errorCode: string | null | undefined) {
  const code = errorCode?.trim() ?? "";
  if (code in STRANDED_RECOVERY_NOTICE_TITLES_BY_RUN_ERROR_CODE) {
    return STRANDED_RECOVERY_NOTICE_TITLES_BY_RUN_ERROR_CODE[code as StrandedRecoveryRunErrorTitleKey];
  }
  return undefined;
}

function titleForRecoveryCause(recoveryCause: string | null | undefined) {
  if (!recoveryCause) return undefined;
  if (recoveryCause in STRANDED_RECOVERY_NOTICE_TITLES_BY_CAUSE) {
    return STRANDED_RECOVERY_NOTICE_TITLES_BY_CAUSE[recoveryCause as StrandedRecoveryCauseTitleKey];
  }
  return undefined;
}

export function buildImmediateExecutionPathRecoveryNoticeSeed(input: {
  status: "todo" | "in_progress";
}): StrandedRecoveryNoticeSeed {
  const retryDescription = input.status === "todo"
    ? "Paperclip automatically retried dispatch for this assigned `todo` issue during terminal run recovery"
    : "Paperclip automatically retried continuation for this assigned `in_progress` issue during terminal run recovery";
  return {
    body:
      `${retryDescription}, but it still has no live execution path. ` +
      "Moving it to `blocked` so it is visible for intervention.",
    title: STRANDED_RECOVERY_TITLE_NO_LIVE_EXECUTION_PATH,
    tone: "danger",
  };
}

export function buildWorkspaceValidationRecoveryNoticeSeed(): StrandedRecoveryNoticeSeed {
  return {
    body:
      "Paperclip stopped before launching the local adapter because the issue workspace failed validation. " +
      "Moving it to `blocked` so the workspace link, cwd, or git checkout can be repaired before resuming.",
    title: STRANDED_RECOVERY_TITLE_WORKSPACE_VALIDATION_FAILED,
    tone: "danger",
  };
}

export const SANDBOX_PROVIDER_PLUGIN_NOT_READY_REASON = "sandbox_provider_plugin_not_ready";

function readNonEmptyStringField(payload: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * What the operator must do to bring a sandbox provider plugin back to
 * `ready`, by the status the run observed. Enabling an `upgrade_pending`
 * plugin also approves the capabilities the upgrade added, so that case asks
 * for a review first.
 */
export function sandboxProviderPluginRemedy(pluginStatus: string): string {
  switch (pluginStatus) {
    case "upgrade_pending":
      return "review and approve the upgraded plugin's capabilities, then enable it (Plugins → Enable)";
    case "disabled":
      return "enable the plugin again (Plugins → Enable); an operator disabled it";
    default:
      return "enable the plugin (Plugins → Enable); a server restart also re-activates a bundled plugin";
  }
}

/**
 * Seed for a `configuration_incomplete` escalation. `configurationIncomplete`
 * is the structured payload the failed run recorded in `resultJson`; the body
 * names the specific gap for the reasons this notice knows, and falls back to
 * the secret/env-binding wording (the original and most common reason).
 */
export function buildConfigurationIncompleteRecoveryNoticeSeed(
  configurationIncomplete?: Record<string, unknown> | null,
): StrandedRecoveryNoticeSeed {
  if (readNonEmptyStringField(configurationIncomplete, "reason") === STRANDED_RECOVERY_AI_CONNECTION_UNAVAILABLE_REASON) {
    return {
      title: STRANDED_RECOVERY_TITLE_AI_CONNECTION_NEEDS_ATTENTION,
      body: STRANDED_RECOVERY_AI_CONNECTION_NOTICE_BODY,
      nextAction: STRANDED_RECOVERY_AI_CONNECTION_NEXT_ACTION,
      tone: "danger",
    };
  }
  if (readNonEmptyStringField(configurationIncomplete, "reason") === SANDBOX_PROVIDER_PLUGIN_NOT_READY_REASON) {
    const pluginKey = readNonEmptyStringField(configurationIncomplete, "pluginKey") ?? "the sandbox provider plugin";
    const pluginStatus = readNonEmptyStringField(configurationIncomplete, "pluginStatus") ?? "not ready";
    return {
      body:
        `Paperclip stopped before dispatching the adapter because the sandbox provider plugin \`${pluginKey}\` ` +
        `is in status \`${pluginStatus}\` and cannot lease a sandbox. Runs will keep failing the same way until the ` +
        `plugin is \`ready\` again. Moving it to \`blocked\` so an operator can ${sandboxProviderPluginRemedy(pluginStatus)} ` +
        "before resuming.",
      title: STRANDED_RECOVERY_TITLE_CONFIGURATION_INCOMPLETE,
      tone: "danger",
    };
  }
  return {
    body:
      "Paperclip stopped before dispatching the adapter because required secret/env bindings are missing. " +
      "Moving it to `blocked` so an operator can bind the missing secret(s) before resuming.",
    title: STRANDED_RECOVERY_TITLE_CONFIGURATION_INCOMPLETE,
    tone: "danger",
  };
}

export function buildExecutionReviewParticipantRecoveryNoticeSeed(): StrandedRecoveryNoticeSeed {
  return {
    body:
      "Paperclip retried the pending execution-review participant once, but the review stage still has no " +
      "completed decision or live reviewer run. Moving it to `blocked` so the board can inspect the evidence, repair the " +
      "reviewer runtime, restore the review stage, or record an intentional manual resolution.",
    title: STRANDED_RECOVERY_TITLE_REVIEW_RECOVERY_STALLED,
    tone: "danger",
  };
}

export function buildExecutionReviewParticipantUnavailableNoticeSeed(): StrandedRecoveryNoticeSeed {
  return {
    body:
      "Paperclip cannot continue the pending execution-review participant because the participant is not " +
      "invokable and the review stage has no completed decision or live reviewer run. Moving it to `blocked` " +
      "so the board can inspect the evidence, repair the reviewer runtime, restore the review stage, or record an " +
      "intentional manual resolution.",
    title: STRANDED_RECOVERY_TITLE_REVIEW_RECOVERY_STALLED,
    tone: "danger",
  };
}

// Escalation dedupe matches the `Recovery action` key_value row via
// noticeMetadataReferencesRecoveryAction, so this builder must always emit
// that row with the raw action id.
export function buildStrandedRecoveryEscalationNotice(input: {
  seed?: StrandedRecoveryNoticeSeed | null;
  fallbackBody?: string | null;
  recoveryCause?: string | null;
  recoveryActionId: string;
  recoveryOwner: { id: string; name: string | null } | null | undefined;
  sourceRun: {
    id: string;
    agentId?: string | null;
    status: string;
    errorCode?: string | null;
    errorSummary?: string | null;
  } | null | undefined;
}): StrandedRecoveryEscalationNotice {
  const workspaceScan = workspaceScanNoticeForErrorCode(input.sourceRun?.errorCode);
  const seed = workspaceScan ? {
    ...workspaceScan,
    body: `Paperclip could not prepare the workspace before the agent started. Automatic recovery could not continue. ${workspaceScan.nextAction}`,
    tone: "danger" as const,
  } : input.seed;
  const fallbackBody = input.fallbackBody?.trim();
  const body = seed?.body ?? (fallbackBody || DEFAULT_STRANDED_RECOVERY_NOTICE_BODY);
  const title =
    titleForRunErrorCode(input.sourceRun?.errorCode) ??
    seed?.title ??
    titleForRecoveryCause(input.recoveryCause) ??
    DEFAULT_STRANDED_RECOVERY_NOTICE_TITLE;

  const recoveryRows: NoticeMetadataRow[] = [
    keyValueRow(STRANDED_RECOVERY_LABEL_RECOVERY_ACTION, input.recoveryActionId),
    input.recoveryOwner
      ? agentLinkRow(STRANDED_RECOVERY_LABEL_RECOVERY_OWNER, input.recoveryOwner)
      : keyValueRow(
          STRANDED_RECOVERY_LABEL_RECOVERY_OWNER,
          STRANDED_RECOVERY_BOARD_DECISION_REQUIRED,
        ),
    keyValueRow(
      STRANDED_RECOVERY_LABEL_NEXT_ACTION,
      seed?.nextAction ?? (input.recoveryOwner
        ? STRANDED_RECOVERY_NEXT_ACTION_WHEN_OWNER_PRESENT
        : STRANDED_RECOVERY_NEXT_ACTION_WHEN_BOARD_REQUIRED),
    ),
  ];

  const runRows: NoticeMetadataRow[] = [];
  if (input.sourceRun) {
    runRows.push(runLinkRow(STRANDED_RECOVERY_LABEL_SOURCE_RUN, input.sourceRun));
    const failureCode = input.sourceRun.errorCode?.trim();
    if (failureCode) runRows.push(keyValueRow(STRANDED_RECOVERY_LABEL_FAILURE_CODE, failureCode));
    const failureSummary = input.sourceRun.errorSummary?.trim();
    if (failureSummary) runRows.push(keyValueRow(STRANDED_RECOVERY_LABEL_FAILURE_SUMMARY, failureSummary));
  }

  const sections: NoticeMetadataSection[] = [
    { title: STRANDED_RECOVERY_SECTION_RECOVERY, rows: recoveryRows },
    ...(runRows.length > 0 ? [{ title: STRANDED_RECOVERY_SECTION_RUN_EVIDENCE, rows: runRows }] : []),
  ];

  return {
    body,
    presentation: systemNoticePresentation({ tone: seed?.tone ?? "danger", title }),
    metadata: {
      version: 1,
      sourceRunId: input.sourceRun?.id ?? null,
      sections,
    },
  };
}
