import { describe, expect, it } from "vitest";
import type { IssueCommentMetadata } from "@paperclipai/shared";
import { i18n } from "@/i18n";
import {
  isStrandedRecoveryNotice,
  localizeRecoveryMetadataIfApplicable,
  localizeRecoveryNoticeBody,
  localizeRecoveryNoticeTitle,
} from "./system-notice-recovery";
import { mapCommentMetadataToSystemNoticeSections } from "./system-notice-comment";

const metadata: IssueCommentMetadata = {
  version: 1,
  sections: [
    {
      title: "Recovery",
      rows: [
        { type: "key_value", label: "Recovery action", value: "recovery-uuid-1234" },
        { type: "key_value", label: "Recovery owner", value: "Board decision required" },
        { type: "key_value", label: "Next action", value: "Inspect the evidence, then retry the original owner, explicitly reassign, repair the execution path, or record an intentional resolution" },
      ],
    },
    {
      title: "Run evidence",
      rows: [
        { type: "run_link", label: "Source run", runId: "run-uuid-5678", title: "failed" },
        { type: "key_value", label: "Failure code", value: "claude_auth_required" },
        { type: "key_value", label: "Failure summary", value: "provider supplied detail stays unchanged" },
      ],
    },
  ],
};

describe("system recovery notice localization", () => {
  it.each([
    ["Automatic recovery blocked", "recoveryNoticeTitleBlocked"],
    ["No live execution path", "recoveryNoticeTitleNoExecutionPath"],
    ["Workspace validation failed", "recoveryNoticeTitleWorkspaceValidation"],
    ["Configuration incomplete", "recoveryNoticeTitleConfigurationIncomplete"],
    ["Review recovery stalled", "recoveryNoticeTitleReviewStalled"],
    ["Error: usage limit reached", "recoveryNoticeTitleUsageLimit"],
    ["Error: not logged in to Claude", "recoveryNoticeTitleClaudeLogin"],
    ["Error: agent login required", "recoveryNoticeTitleAgentLogin"],
    ["Workspace scan timed out", "recoveryNoticeTitleWorkspaceScanTimeout"],
    ["Workspace scan queue is full", "recoveryNoticeTitleWorkspaceScanSaturated"],
    ["Workspace scan exceeded its limit", "recoveryNoticeTitleWorkspaceScanLimit"],
    ["Workspace scan failed", "recoveryNoticeTitleWorkspaceScanFailed"],
    ["Workspace scan was cancelled", "recoveryNoticeTitleWorkspaceScanCancelled"],
    ["AI connection needs attention", "recoveryNoticeTitleAiConnection"],
    ["Continuation failed", "recoveryNoticeTitleContinuationFailed"],
    ["Missing disposition recovery blocked", "recoveryNoticeTitleMissingDisposition"],
  ])("localizes known recovery title %s", async (title, key) => {
    await i18n.changeLanguage("zh-CN");
    expect(localizeRecoveryNoticeTitle(title)).toBe(i18n.t(`tok225review.${key}`));
    await i18n.changeLanguage("en");
  });

  it("localizes the second-round sample's title, body and structured recovery metadata", async () => {
    await i18n.changeLanguage("zh-CN");
    const body = "Paperclip cannot safely continue automatic recovery because the original assignee is not invokable. The source assignment is unchanged and the board must choose the next action.";
    expect(isStrandedRecoveryNotice({ title: "Automatic recovery blocked", body, metadata })).toBe(true);
    expect(localizeRecoveryNoticeTitle("Automatic recovery blocked", body)).toBe("自动恢复已阻止");
    expect(localizeRecoveryNoticeBody(body)).toBe("Paperclip 无法安全地继续自动恢复，因为原分派对象当前不可调用。原分派关系保持不变，董事会需要决定下一步操作。");

    const localized = localizeRecoveryMetadataIfApplicable({ title: "Automatic recovery blocked", body, metadata });
    const sections = mapCommentMetadataToSystemNoticeSections(localized, { recoveryNotice: true });
    expect(sections.map((section) => section.title)).toEqual(["恢复处置", "运行证据"]);
    expect(sections[0]?.rows.map((row) => row.label)).toEqual(["恢复操作", "恢复负责人", "下一步操作"]);
    expect(sections[0]?.rows[0]).toMatchObject({ value: "recovery-uuid-1234" });
    expect(sections[0]?.rows[1]).toMatchObject({ value: "需要董事会决定" });
    expect(sections[0]?.rows[2]).toMatchObject({ value: "检查证据，然后重试原负责人、明确改派、修复执行路径，或记录有意作出的处置。" });
    expect(sections[1]?.rows[0]).toMatchObject({ label: "来源运行", runId: "run-uuid-5678", status: "失败" });
    expect(sections[1]?.rows[1]).toMatchObject({ label: "失败代码", value: "claude_auth_required" });
    expect(sections[1]?.rows[2]).toMatchObject({ label: "失败摘要", value: "provider supplied detail stays unchanged" });

    await i18n.changeLanguage("en");
    const english = localizeRecoveryMetadataIfApplicable({ title: "Automatic recovery blocked", body, metadata });
    expect(english?.sections[0]?.rows[0]).toMatchObject({ label: "Recovery action", value: "recovery-uuid-1234" });
    expect(english?.sections[0]?.rows[1]).toMatchObject({ value: "Board decision required" });
    expect(english?.sections[1]?.rows[1]).toMatchObject({ label: "Failure code", value: "claude_auth_required" });
    expect(english?.sections[1]?.rows[2]).toMatchObject({ value: "provider supplied detail stays unchanged" });
  });

  it.each([
    ["Paperclip could not restore a live execution path for this issue automatically. Moving it to `blocked` so it is visible for intervention.", "recoveryNoticeBodyDefault"],
    ["Paperclip stopped before launching the local adapter because the issue workspace failed validation. Moving it to `blocked` so the workspace link, cwd, or git checkout can be repaired before resuming.", "recoveryNoticeBodyWorkspaceValidation"],
    ["This task paused because its selected AI account is unavailable. Reconnect the account or choose an available connection to continue.", "recoveryNoticeBodyAiUnavailable"],
    ["Paperclip stopped before dispatching the adapter because required secret/env bindings are missing. Moving it to `blocked` so an operator can bind the missing secret(s) before resuming.", "recoveryNoticeBodyMissingBindings"],
    ["Paperclip retried the pending execution-review participant once, but the review stage still has no completed decision or live reviewer run. Moving it to `blocked` so the board can inspect the evidence, repair the reviewer runtime, restore the review stage, or record an intentional manual resolution.", "recoveryNoticeBodyReviewStalled"],
    ["Paperclip cannot continue the pending execution-review participant because the participant is not invokable and the review stage has no completed decision or live reviewer run. Moving it to `blocked` so the board can inspect the evidence, repair the reviewer runtime, restore the review stage, or record an intentional manual resolution.", "recoveryNoticeBodyReviewUnavailable"],
    ["Paperclip could not resolve this issue's missing disposition automatically. The source assignment is unchanged and a board decision is required.", "recoveryNoticeBodyHandoffExhausted"],
  ])("localizes known fixed recovery body: %s", async (body, key) => {
    await i18n.changeLanguage("zh-CN");
    const localized = localizeRecoveryNoticeBody(body);
    expect(localized).not.toBe(body);
    expect(localized).not.toContain("Moving it to");
    expect(localized).not.toContain("board");
    expect(localized).toBe(i18n.t(`tok225review.${key}`));
    await i18n.changeLanguage("en");
    expect(localizeRecoveryNoticeBody(body)).toBe(body);
    await i18n.changeLanguage("en");
  });

  it.each([
    ["Paperclip automatically retried dispatch for this assigned `todo` issue during terminal run recovery, but it still has no live execution path. Moving it to `blocked` so it is visible for intervention."],
    ["Paperclip automatically retried dispatch for this assigned `todo` issue after a lost wake/run, but it still has no live execution path. Moving it to `blocked` so it is visible for intervention."],
    ["Paperclip automatically retried continuation for this assigned `in_progress` issue during terminal run recovery, but it still has no live execution path. Moving it to `blocked` so it is visible for intervention."],
    ["Paperclip automatically retried continuation for this assigned `in_progress` issue and the retry made progress, but it still has no live execution path. Moving it to `blocked` so it is visible for intervention."],
    ["Paperclip automatically retried continuation for this assigned `in_progress` issue after its live execution disappeared, but it still has no live execution path (3× attempts). Moving it to `blocked` so it is visible for intervention."],
    ["Paperclip detected a non-retryable failure on this issue's continuation run (`workspace_validation_failed`). Skipping automatic retries and moving it to `blocked` so it is visible for intervention."],
    ["Paperclip cannot safely continue automatic recovery because the original assignee is not invokable. The source assignment is unchanged and the board must choose the next action."],
    ["Paperclip cannot safely continue automatic recovery because the original recovery target is over budget. The source assignment is unchanged and the board must choose the next action."],
  ])("localizes a stranded recovery state without changing machine markers", async (body) => {
    await i18n.changeLanguage("zh-CN");
    const localized = localizeRecoveryNoticeBody(body);
    expect(localized).not.toBe(body);
    expect(localized).toContain("Paperclip");
    expect(localized).not.toContain("Moving it to");
    if (body.includes("workspace_validation_failed")) expect(localized).toContain("workspace_validation_failed");
    if (body.includes("3× attempts")) expect(localized).toContain("3");
    await i18n.changeLanguage("en");
  });

  it.each([
    ["workspace_git_scan_timeout", "Check repository access and server load, then retry the task."],
    ["workspace_git_scan_saturated", "Check server load and the workspace scan queue, then retry the task."],
    ["workspace_git_scan_output_limit", "Check the repository size and workspace scan output limit before retrying the task."],
    ["workspace_git_scan_failed", "Inspect the failed run and check repository access and integrity before retrying the task."],
    ["workspace_git_scan_cancelled", "Inspect why workspace preparation was cancelled before retrying the task."],
  ])("localizes workspace scan recovery %s", async (code, nextAction) => {
    await i18n.changeLanguage("zh-CN");
    const body = `Paperclip could not prepare the workspace before the agent started. Automatic recovery could not continue. ${nextAction}`;
    expect(localizeRecoveryNoticeTitle("Workspace scan failed", body)).toBeTruthy();
    expect(localizeRecoveryNoticeBody(body)).not.toContain("Automatic recovery");
    expect(localizeRecoveryNoticeBody(body)).not.toContain("retry the task");
    expect(code).toMatch(/^workspace_git_scan_/);
    await i18n.changeLanguage("en");
  });

  it("localizes plugin remedy instructions and the fixed metadata value while preserving plugin keys/status codes", async () => {
    await i18n.changeLanguage("zh-CN");
    const body = "Paperclip stopped before dispatching the adapter because the sandbox provider plugin `plugin-provider-x` is in status `upgrade_pending` and cannot lease a sandbox. Runs will keep failing the same way until the plugin is `ready` again. Moving it to `blocked` so an operator can review and approve the upgraded plugin's capabilities, then enable it (Plugins → Enable) before resuming.";
    const localized = localizeRecoveryNoticeBody(body);
    expect(localized).toContain("plugin-provider-x");
    expect(localized).toContain("upgrade_pending");
    expect(localized).toContain("ready");
    expect(localized).toContain("插件 → 启用");
    expect(localized).not.toContain("review and approve");
    await i18n.changeLanguage("en");
  });

  it("keeps arbitrary user text and non-recovery system notices unchanged", async () => {
    await i18n.changeLanguage("zh-CN");
    const userText = "Please retry this task after checking the plugin.";
    expect(localizeRecoveryNoticeBody(userText)).toBe(userText);
    expect(isStrandedRecoveryNotice({ title: "A user supplied title", body: userText, metadata: null })).toBe(false);
    await i18n.changeLanguage("en");
  });
});
