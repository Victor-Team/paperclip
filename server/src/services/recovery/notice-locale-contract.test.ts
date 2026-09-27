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
  buildConfigurationIncompleteRecoveryNoticeSeed,
  buildExecutionReviewParticipantRecoveryNoticeSeed,
  buildImmediateExecutionPathRecoveryNoticeSeed,
  buildStrandedRecoveryEscalationNotice,
  buildWorkspaceValidationRecoveryNoticeSeed,
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
