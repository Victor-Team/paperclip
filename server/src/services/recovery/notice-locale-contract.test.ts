import { describe, expect, it } from "vitest";
import {
  issueCommentPresentationSchema,
  type IssueCommentMetadata,
} from "@paperclipai/shared";
import {
  ENVIRONMENT_LEASE_ACQUIRED_ACTION,
  ENVIRONMENT_LEASE_RELEASED_ACTION,
} from "../environment-run-orchestrator.js";
import { buildWorkspaceReadyPresentation } from "../workspace-runtime.js";
import {
  DEFAULT_STRANDED_RECOVERY_NOTICE_BODY,
  DEFAULT_STRANDED_RECOVERY_NOTICE_TITLE,
  SANDBOX_PROVIDER_PLUGIN_NOT_READY_REASON,
  STRANDED_RECOVERY_AI_CONNECTION_NEXT_ACTION,
  STRANDED_RECOVERY_AI_CONNECTION_NOTICE_BODY,
  STRANDED_RECOVERY_AI_CONNECTION_UNAVAILABLE_REASON,
  STRANDED_RECOVERY_BOARD_DECISION_REQUIRED,
  STRANDED_RECOVERY_LABEL_FAILURE_CODE,
  STRANDED_RECOVERY_LABEL_NEXT_ACTION,
  STRANDED_RECOVERY_LABEL_RECOVERY_ACTION,
  STRANDED_RECOVERY_LABEL_RECOVERY_OWNER,
  STRANDED_RECOVERY_LABEL_SOURCE_RUN,
  STRANDED_RECOVERY_NEXT_ACTION_WHEN_BOARD_REQUIRED,
  STRANDED_RECOVERY_NEXT_ACTION_WHEN_OWNER_PRESENT,
  STRANDED_RECOVERY_NOTICE_TITLES_BY_CAUSE,
  STRANDED_RECOVERY_NOTICE_TITLES_BY_RUN_ERROR_CODE,
  STRANDED_RECOVERY_SECTION_RECOVERY,
  STRANDED_RECOVERY_SECTION_RUN_EVIDENCE,
  STRANDED_RECOVERY_TITLE_ACPX_AUTH_REQUIRED,
  STRANDED_RECOVERY_TITLE_AI_CONNECTION_NEEDS_ATTENTION,
  STRANDED_RECOVERY_TITLE_CLAUDE_AUTH_REQUIRED,
  STRANDED_RECOVERY_TITLE_CONFIGURATION_INCOMPLETE,
  STRANDED_RECOVERY_TITLE_NO_LIVE_EXECUTION_PATH,
  STRANDED_RECOVERY_TITLE_PROVIDER_QUOTA,
  STRANDED_RECOVERY_TITLE_REVIEW_RECOVERY_STALLED,
  STRANDED_RECOVERY_TITLE_WORKSPACE_VALIDATION_FAILED,
  WORKSPACE_SCAN_NOTICES,
  buildConfigurationIncompleteRecoveryNoticeSeed,
  buildExecutionReviewParticipantRecoveryNoticeSeed,
  buildExecutionReviewParticipantUnavailableNoticeSeed,
  buildImmediateExecutionPathRecoveryNoticeSeed,
  buildStrandedRecoveryEscalationNotice,
  buildWorkspaceValidationRecoveryNoticeSeed,
  workspaceScanNoticeForErrorCode,
} from "./stranded-notice.js";
import {
  SUCCESSFUL_RUN_HANDOFF_EXHAUSTED_NOTICE_BODY,
  SUCCESSFUL_RUN_HANDOFF_EXHAUSTED_NOTICE_TITLE,
  SUCCESSFUL_RUN_HANDOFF_REQUIRED_NOTICE_BODY,
  SUCCESSFUL_RUN_HANDOFF_REQUIRED_NOTICE_TITLE,
  SUCCESSFUL_RUN_MISSING_STATE_REASON,
  buildSuccessfulRunHandoffExhaustedNotice,
  buildSuccessfulRunHandoffRequiredNotice,
} from "./successful-run-handoff.js";

const ISSUE = {
  id: "11111111-1111-4111-8111-111111111111",
  identifier: "PAP-1",
  title: "Finish backend handoff",
  status: "in_progress",
} as const;

const RUN = {
  id: "22222222-2222-4222-8222-222222222222",
  status: "succeeded",
  agentId: "33333333-3333-4333-8333-333333333333",
} as const;

const AGENT = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "CodexCoder",
} as const;

function keyValue(metadata: IssueCommentMetadata, label: string): string | undefined {
  for (const section of metadata.sections) {
    for (const row of section.rows) {
      if (row.type === "key_value" && row.label === label) return row.value;
    }
  }
  return undefined;
}

function rowByLabel(metadata: IssueCommentMetadata, label: string) {
  for (const section of metadata.sections) {
    for (const row of section.rows) {
      if (row.label === label) return row;
    }
  }
  return undefined;
}

const ACTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "CTO" };
const SOURCE_RUN = {
  id: RUN.id,
  agentId: RUN.agentId,
  status: "failed",
} as const;

describe("TOK-226 B3 locale contract: system notices keep English persist + stable machine keys", () => {
  it("required missing-disposition notice keeps English title/body and exposes successful_run_missing_state", () => {
    const notice = buildSuccessfulRunHandoffRequiredNotice({
      issue: ISSUE,
      run: RUN,
      agent: AGENT,
      detectedProgressSummary: "Run produced concrete action evidence: 1 issue comment(s)",
    });

    expect(notice.presentation).toEqual({
      kind: "system_notice",
      tone: "warning",
      title: SUCCESSFUL_RUN_HANDOFF_REQUIRED_NOTICE_TITLE,
      detailsDefaultOpen: false,
    });
    expect(notice.presentation.title).toBe("Missing issue disposition");
    expect(notice.body).toBe(SUCCESSFUL_RUN_HANDOFF_REQUIRED_NOTICE_BODY);
    expect(keyValue(notice.metadata, "Normalized cause")).toBe(SUCCESSFUL_RUN_MISSING_STATE_REASON);
    expect(keyValue(notice.metadata, "Missing disposition")).toBe("clear_next_step");
    expect(issueCommentPresentationSchema.parse(notice.presentation).title).toBe(
      "Missing issue disposition",
    );
  });

  it("exhausted missing-disposition notice keeps English title/body and the same cause code", () => {
    const notice = buildSuccessfulRunHandoffExhaustedNotice({
      issue: ISSUE,
      sourceRun: RUN,
      correctiveRun: { ...RUN, id: "44444444-4444-4444-8444-444444444444", status: "failed" },
      sourceAssignee: AGENT,
      recoveryIssue: { ...ISSUE, id: "55555555-5555-4555-8555-555555555555", identifier: "PAP-2" },
      recoveryActionId: "77777777-7777-4777-8777-777777777777",
      recoveryOwner: { id: "66666666-6666-4666-8666-666666666666", name: "CTO" },
      latestIssueStatus: "in_progress",
      latestHandoffRunStatus: "failed",
      missingDisposition: "clear_next_step",
    });

    expect(notice.presentation.title).toBe(SUCCESSFUL_RUN_HANDOFF_EXHAUSTED_NOTICE_TITLE);
    expect(notice.presentation.title).toBe("Missing disposition recovery blocked");
    expect(notice.body).toBe(SUCCESSFUL_RUN_HANDOFF_EXHAUSTED_NOTICE_BODY);
    expect(keyValue(notice.metadata, "Normalized cause")).toBe(SUCCESSFUL_RUN_MISSING_STATE_REASON);
    expect(keyValue(notice.metadata, "Recovery action")).toBe("77777777-7777-4777-8777-777777777777");
  });

  it("does not persist Chinese when building async recovery notices", () => {
    const required = buildSuccessfulRunHandoffRequiredNotice({
      issue: ISSUE,
      run: RUN,
      agent: AGENT,
      detectedProgressSummary: "progress",
    });
    const exhausted = buildSuccessfulRunHandoffExhaustedNotice({
      issue: ISSUE,
      sourceRun: RUN,
      correctiveRun: null,
      sourceAssignee: AGENT,
      recoveryIssue: null,
      recoveryOwner: null,
      latestIssueStatus: "blocked",
      latestHandoffRunStatus: "failed",
      missingDisposition: "clear_next_step",
    });

    for (const notice of [required, exhausted]) {
      expect(notice.presentation.title).toMatch(/^[A-Za-z]/);
      expect(notice.body).toMatch(/^[A-Za-z]/);
      expect(notice.presentation.title).not.toMatch(/[\u4e00-\u9fff]/);
      expect(notice.body).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it("rejects extra presentation.code so locale mapping must use title + metadata already on the wire", () => {
    expect(() =>
      issueCommentPresentationSchema.parse({
        kind: "system_notice",
        tone: "warning",
        title: "Missing issue disposition",
        detailsDefaultOpen: false,
        code: "missing_issue_disposition",
      }),
    ).toThrow(/Unrecognized key/i);
  });

  it.each([
    ["No live execution path", buildImmediateExecutionPathRecoveryNoticeSeed({ status: "in_progress" }).title],
    ["Workspace validation failed", buildWorkspaceValidationRecoveryNoticeSeed().title],
    ["Configuration incomplete", buildConfigurationIncompleteRecoveryNoticeSeed().title],
    ["AI connection needs attention", buildConfigurationIncompleteRecoveryNoticeSeed({ reason: "ai_connection_unavailable" }).title],
    ["Review recovery stalled", buildExecutionReviewParticipantRecoveryNoticeSeed().title],
  ])("stranded seed title %s is a stable English key", (expected, actual) => {
    expect(actual).toBe(expected);
  });

  it("stranded escalation keeps Failure code as the machine identifier when the run classified one", () => {
    const notice = buildStrandedRecoveryEscalationNotice({
      recoveryActionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      recoveryOwner: null,
      recoveryCause: "workspace_validation_failed",
      sourceRun: {
        id: RUN.id,
        agentId: RUN.agentId,
        status: "failed",
        errorCode: "workspace_git_scan_timeout",
      },
    });
    expect(notice.presentation.kind).toBe("system_notice");
    expect(notice.presentation.title).toBe("Workspace scan timed out");
    expect(keyValue(notice.metadata, "Failure code")).toBe("workspace_git_scan_timeout");
    expect(keyValue(notice.metadata, "Recovery action")).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("workspace-ready title is prefix-stable and interpolates workspace identity as data", () => {
    const presentation = buildWorkspaceReadyPresentation({
      workspace: {
        baseCwd: "/workspace",
        source: "project_primary",
        projectId: "project-1",
        workspaceId: "ws-1",
        repoUrl: null,
        repoRef: null,
        strategy: "git_worktree",
        cwd: "/worktrees/demo",
        branchName: "tok-224/zh-render-server",
        worktreePath: "/worktrees/demo",
        warnings: [],
        created: false,
        branchCreatedByRuntime: false,
      },
      runtimeServices: [],
    });
    expect(presentation.kind).toBe("system_notice");
    expect(presentation.title).toBe("Workspace ready · tok-224/zh-render-server");
    expect(presentation.title?.startsWith("Workspace ready · ")).toBe(true);
  });

  it("audit lease actions are dotted machine codes, not English prose", () => {
    expect(ENVIRONMENT_LEASE_ACQUIRED_ACTION).toBe("environment.lease_acquired");
    expect(ENVIRONMENT_LEASE_RELEASED_ACTION).toBe("environment.lease_released");
    expect(ENVIRONMENT_LEASE_ACQUIRED_ACTION).not.toMatch(/\s/);
    expect(ENVIRONMENT_LEASE_RELEASED_ACTION).not.toMatch(/\s/);
  });
});

describe("TOK-226 B3 stranded-notice locale contract: closed-set English persist + mapping anchors", () => {
  const noChinese = (text: string) => {
    expect(text).toMatch(/^[A-Za-z]/);
    expect(text).not.toMatch(/[\u4e00-\u9fff]/);
  };

  it("screenshot triad: Automatic recovery blocked / Board decision required / Next action", () => {
    const notice = buildStrandedRecoveryEscalationNotice({
      recoveryActionId: ACTION_ID,
      recoveryOwner: null,
      sourceRun: null,
    });

    expect(notice.presentation).toEqual({
      kind: "system_notice",
      tone: "danger",
      title: DEFAULT_STRANDED_RECOVERY_NOTICE_TITLE,
      detailsDefaultOpen: false,
    });
    expect(notice.presentation.title).toBe("Automatic recovery blocked");
    expect(notice.body).toBe(DEFAULT_STRANDED_RECOVERY_NOTICE_BODY);
    expect(notice.metadata.sections.map((section) => section.title)).toEqual([
      STRANDED_RECOVERY_SECTION_RECOVERY,
    ]);
    expect(notice.metadata.sections[0]?.title).toBe("Recovery");

    const owner = rowByLabel(notice.metadata, STRANDED_RECOVERY_LABEL_RECOVERY_OWNER);
    expect(owner).toEqual({
      type: "key_value",
      label: "Recovery owner",
      value: STRANDED_RECOVERY_BOARD_DECISION_REQUIRED,
    });
    expect(owner && owner.type === "key_value" ? owner.value : undefined).toBe("Board decision required");

    expect(keyValue(notice.metadata, STRANDED_RECOVERY_LABEL_NEXT_ACTION)).toBe(
      STRANDED_RECOVERY_NEXT_ACTION_WHEN_BOARD_REQUIRED,
    );
    expect(rowByLabel(notice.metadata, "Next action")?.label).toBe("Next action");
    expect(keyValue(notice.metadata, STRANDED_RECOVERY_LABEL_RECOVERY_ACTION)).toBe(ACTION_ID);
    noChinese(notice.presentation.title ?? "");
    noChinese(notice.body);
  });

  it.each(Object.entries(STRANDED_RECOVERY_NOTICE_TITLES_BY_CAUSE))(
    "recoveryCause %s titles the card %s without a seed",
    (cause, title) => {
      const notice = buildStrandedRecoveryEscalationNotice({
        recoveryCause: cause,
        recoveryActionId: ACTION_ID,
        recoveryOwner: OWNER,
        sourceRun: null,
      });
      expect(notice.presentation.title).toBe(title);
      expect(notice.body).toBe(DEFAULT_STRANDED_RECOVERY_NOTICE_BODY);
      expect(keyValue(notice.metadata, STRANDED_RECOVERY_LABEL_NEXT_ACTION)).toBe(
        STRANDED_RECOVERY_NEXT_ACTION_WHEN_OWNER_PRESENT,
      );
      const owner = rowByLabel(notice.metadata, STRANDED_RECOVERY_LABEL_RECOVERY_OWNER);
      expect(owner).toMatchObject({ type: "agent_link", agentId: OWNER.id, name: OWNER.name });
    },
  );

  it.each(Object.entries(STRANDED_RECOVERY_NOTICE_TITLES_BY_RUN_ERROR_CODE))(
    "sourceRun.errorCode %s titles the card %s over the seed",
    (errorCode, title) => {
      const notice = buildStrandedRecoveryEscalationNotice({
        seed: buildImmediateExecutionPathRecoveryNoticeSeed({ status: "todo" }),
        recoveryActionId: ACTION_ID,
        recoveryOwner: null,
        sourceRun: { ...SOURCE_RUN, errorCode },
      });
      expect(notice.presentation.title).toBe(title);
      expect(keyValue(notice.metadata, STRANDED_RECOVERY_LABEL_FAILURE_CODE)).toBe(errorCode);
      expect(notice.metadata.sections.map((section) => section.title)).toEqual([
        STRANDED_RECOVERY_SECTION_RECOVERY,
        STRANDED_RECOVERY_SECTION_RUN_EVIDENCE,
      ]);
    },
  );

  it.each(Object.entries(WORKSPACE_SCAN_NOTICES))(
    "workspace scan %s keeps title, nextAction, Failure code, and composed body",
    (errorCode, scan) => {
      const notice = buildStrandedRecoveryEscalationNotice({
        seed: buildImmediateExecutionPathRecoveryNoticeSeed({ status: "in_progress" }),
        recoveryCause: "workspace_validation_failed",
        recoveryActionId: ACTION_ID,
        recoveryOwner: null,
        sourceRun: { ...SOURCE_RUN, errorCode },
      });
      expect(workspaceScanNoticeForErrorCode(errorCode)?.title).toBe(scan.title);
      expect(notice.presentation.title).toBe(scan.title);
      expect(notice.body).toBe(
        `Paperclip could not prepare the workspace before the agent started. Automatic recovery could not continue. ${scan.nextAction}`,
      );
      expect(keyValue(notice.metadata, STRANDED_RECOVERY_LABEL_NEXT_ACTION)).toBe(scan.nextAction);
      expect(keyValue(notice.metadata, STRANDED_RECOVERY_LABEL_FAILURE_CODE)).toBe(errorCode);
      expect(notice.body).not.toContain("retried continuation");
    },
  );

  it("configuration incomplete: secret/env default, AI connection, sandbox plugin params", () => {
    const secret = buildStrandedRecoveryEscalationNotice({
      seed: buildConfigurationIncompleteRecoveryNoticeSeed(),
      recoveryCause: "configuration_incomplete",
      recoveryActionId: ACTION_ID,
      recoveryOwner: null,
      sourceRun: SOURCE_RUN,
    });
    expect(secret.presentation.title).toBe(STRANDED_RECOVERY_TITLE_CONFIGURATION_INCOMPLETE);
    expect(secret.body).toContain("secret/env bindings");
    expect(keyValue(secret.metadata, STRANDED_RECOVERY_LABEL_NEXT_ACTION)).toBe(
      STRANDED_RECOVERY_NEXT_ACTION_WHEN_BOARD_REQUIRED,
    );

    const ai = buildStrandedRecoveryEscalationNotice({
      seed: buildConfigurationIncompleteRecoveryNoticeSeed({
        reason: STRANDED_RECOVERY_AI_CONNECTION_UNAVAILABLE_REASON,
      }),
      recoveryCause: "configuration_incomplete",
      recoveryActionId: ACTION_ID,
      recoveryOwner: null,
      sourceRun: SOURCE_RUN,
    });
    expect(ai.presentation.title).toBe(STRANDED_RECOVERY_TITLE_AI_CONNECTION_NEEDS_ATTENTION);
    expect(ai.body).toBe(STRANDED_RECOVERY_AI_CONNECTION_NOTICE_BODY);
    expect(keyValue(ai.metadata, STRANDED_RECOVERY_LABEL_NEXT_ACTION)).toBe(
      STRANDED_RECOVERY_AI_CONNECTION_NEXT_ACTION,
    );

    const pluginKey = "paperclip.kubernetes-sandbox-provider";
    const pluginStatus = "disabled";
    const plugin = buildStrandedRecoveryEscalationNotice({
      seed: buildConfigurationIncompleteRecoveryNoticeSeed({
        reason: SANDBOX_PROVIDER_PLUGIN_NOT_READY_REASON,
        pluginKey,
        pluginStatus,
      }),
      recoveryCause: "configuration_incomplete",
      recoveryActionId: ACTION_ID,
      recoveryOwner: OWNER,
      sourceRun: SOURCE_RUN,
    });
    expect(plugin.presentation.title).toBe(STRANDED_RECOVERY_TITLE_CONFIGURATION_INCOMPLETE);
    expect(plugin.body).toContain(`\`${pluginKey}\``);
    expect(plugin.body).toContain(`\`${pluginStatus}\``);
    expect(plugin.body).toContain("an operator disabled it");
    expect(keyValue(plugin.metadata, STRANDED_RECOVERY_LABEL_NEXT_ACTION)).toBe(
      STRANDED_RECOVERY_NEXT_ACTION_WHEN_OWNER_PRESENT,
    );
  });

  it("seed titles for default / workspace / review / no-live-path stay closed-set English", () => {
    expect(buildImmediateExecutionPathRecoveryNoticeSeed({ status: "todo" }).title).toBe(
      STRANDED_RECOVERY_TITLE_NO_LIVE_EXECUTION_PATH,
    );
    expect(buildImmediateExecutionPathRecoveryNoticeSeed({ status: "in_progress" }).title).toBe(
      STRANDED_RECOVERY_TITLE_NO_LIVE_EXECUTION_PATH,
    );
    expect(buildWorkspaceValidationRecoveryNoticeSeed().title).toBe(
      STRANDED_RECOVERY_TITLE_WORKSPACE_VALIDATION_FAILED,
    );
    expect(buildExecutionReviewParticipantRecoveryNoticeSeed().title).toBe(
      STRANDED_RECOVERY_TITLE_REVIEW_RECOVERY_STALLED,
    );
    expect(buildExecutionReviewParticipantUnavailableNoticeSeed().title).toBe(
      STRANDED_RECOVERY_TITLE_REVIEW_RECOVERY_STALLED,
    );
  });

  it("unmapped errorCode keeps seed title and still writes Failure code as the machine value", () => {
    const notice = buildStrandedRecoveryEscalationNotice({
      seed: buildImmediateExecutionPathRecoveryNoticeSeed({ status: "todo" }),
      recoveryActionId: ACTION_ID,
      recoveryOwner: OWNER,
      sourceRun: { ...SOURCE_RUN, errorCode: "process_lost", errorSummary: "adapter exited 1" },
    });
    expect(notice.presentation.title).toBe(STRANDED_RECOVERY_TITLE_NO_LIVE_EXECUTION_PATH);
    expect(keyValue(notice.metadata, STRANDED_RECOVERY_LABEL_FAILURE_CODE)).toBe("process_lost");
    expect(keyValue(notice.metadata, "Failure summary")).toBe("adapter exited 1");
    const source = rowByLabel(notice.metadata, STRANDED_RECOVERY_LABEL_SOURCE_RUN);
    expect(source).toMatchObject({ type: "run_link", runId: SOURCE_RUN.id, title: "failed" });
  });

  it("persists English only: no request-locale Chinese on title, body, labels, or sentinel values", () => {
    const notices = [
      buildStrandedRecoveryEscalationNotice({
        recoveryActionId: ACTION_ID,
        recoveryOwner: null,
        sourceRun: null,
      }),
      buildStrandedRecoveryEscalationNotice({
        seed: buildWorkspaceValidationRecoveryNoticeSeed(),
        recoveryCause: "workspace_validation_failed",
        recoveryActionId: ACTION_ID,
        recoveryOwner: OWNER,
        sourceRun: { ...SOURCE_RUN, errorCode: "workspace_validation_failed" },
      }),
      buildStrandedRecoveryEscalationNotice({
        seed: buildExecutionReviewParticipantUnavailableNoticeSeed(),
        recoveryCause: "execution_review_participant_recovery",
        recoveryActionId: ACTION_ID,
        recoveryOwner: null,
        sourceRun: { ...SOURCE_RUN, errorCode: "acpx_auth_required" },
      }),
    ];
    for (const notice of notices) {
      noChinese(notice.presentation.title ?? "");
      noChinese(notice.body);
      for (const section of notice.metadata.sections) {
        if (section.title) noChinese(section.title);
        for (const row of section.rows) {
          if (row.label) noChinese(row.label);
          if (row.type === "key_value") expect(row.value).not.toMatch(/[\u4e00-\u9fff]/);
        }
      }
    }
    expect(STRANDED_RECOVERY_TITLE_PROVIDER_QUOTA).toBe("Error: usage limit reached");
    expect(STRANDED_RECOVERY_TITLE_CLAUDE_AUTH_REQUIRED).toBe("Error: not logged in to Claude");
    expect(STRANDED_RECOVERY_TITLE_ACPX_AUTH_REQUIRED).toBe("Error: agent login required");
  });
});
