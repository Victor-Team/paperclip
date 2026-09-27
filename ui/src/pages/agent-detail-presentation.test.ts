import { describe, expect, it } from "vitest";
import {
  agentInvocationSourceLabel,
  agentMoreSkillsLabel,
  agentRunStatusLabel,
  agentWorkspacePhaseLabel,
} from "./agent-detail-presentation";

const t = (key: string) => `translated:${key}`;

describe("agent detail display labels", () => {
  it("translates known run states without changing their machine values", () => {
    expect(agentRunStatusLabel("succeeded", t)).toBe("translated:statusbadge.general.succeeded");
    expect(agentRunStatusLabel("running", t)).toBe("translated:statusbadge.general.running");
    expect(agentRunStatusLabel("scheduled_retry", t)).toBe("translated:statusbadge.general.scheduledRetry");
    expect(agentRunStatusLabel("interrupted", t)).toBe("translated:tok225review.agentRunInterrupted");
    expect(agentRunStatusLabel("skipped", t)).toBe("translated:tok225review.agentWorkspaceStatusSkipped");
    expect(agentRunStatusLabel("needs_recovery", t)).toBe("needs_recovery");
  });

  it.each([
    ["queued", "statusbadge.general.queued"],
    ["failed", "statusbadge.general.failed"],
    ["timed_out", "statusbadge.general.timedOut"],
    ["terminated", "statusbadge.general.terminated"],
    ["cancelled", "statusbadge.general.cancelled"],
  ])("maps the %s status to a localized label", (status, key) => {
    expect(agentRunStatusLabel(status, t)).toBe(`translated:${key}`);
  });

  it("translates known invocation sources and preserves unknown source identifiers", () => {
    expect(agentInvocationSourceLabel("timer", t)).toBe("translated:tok225review.agentInvocationTimer");
    expect(agentInvocationSourceLabel("on_demand", t)).toBe("translated:tok225review.agentInvocationOnDemand");
    expect(agentInvocationSourceLabel("custom_source_v2", t)).toBe("custom_source_v2");
  });

  it("translates known workspace phases and preserves unknown phase identifiers", () => {
    expect(agentWorkspacePhaseLabel("worktree_prepare", t)).toBe("translated:tok225review.agentWorkspacePhaseWorktreeSetup");
    expect(agentWorkspacePhaseLabel("workspace_provision", t)).toBe("translated:tok225review.agentWorkspacePhaseProvision");
    expect(agentWorkspacePhaseLabel("workspace_runtime_provision", t)).toBe("translated:tok225review.agentWorkspacePhaseRuntimeProvision");
    expect(agentWorkspacePhaseLabel("custom_phase", t)).toBe("custom_phase");
  });

  it.each([
    ["workspace_config_freshness", "tok225review.agentWorkspacePhaseConfigFreshness"],
    ["workspace_seed", "tok225review.agentWorkspacePhaseSeed"],
    ["workspace_runtime_provision", "tok225review.agentWorkspacePhaseRuntimeProvision"],
    ["workspace_repair", "tok225review.agentWorkspacePhaseRepair"],
    ["workspace_teardown", "tok225review.agentWorkspacePhaseTeardown"],
    ["worktree_cleanup", "tok225review.agentWorkspacePhaseWorktreeCleanup"],
    ["workspace_finalize", "tok225review.agentWorkspacePhaseFinalize"],
  ])("maps the %s phase to a localized label", (phase, key) => {
    expect(agentWorkspacePhaseLabel(phase, t)).toBe(`translated:${key}`);
  });

  it("passes the overflow count into the localized skills label", () => {
    const localized = (key: string, values?: Record<string, unknown>) =>
      key === "tok225review.agentMoreSkills" ? `另有 ${values?.count} 项` : key;
    expect(agentMoreSkillsLabel(3, localized)).toBe("另有 3 项");
  });
});
