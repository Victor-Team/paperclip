type Translate = (key: string, values?: Record<string, unknown>) => string;

const INVOCATION_SOURCE_KEYS: Record<string, string> = {
  timer: "tok225review.agentInvocationTimer",
  assignment: "tok225review.agentInvocationAssignment",
  on_demand: "tok225review.agentInvocationOnDemand",
  automation: "tok225review.agentInvocationAutomation",
};

const WORKSPACE_PHASE_KEYS: Record<string, string> = {
  worktree_prepare: "tok225review.agentWorkspacePhaseWorktreeSetup",
  workspace_config_freshness: "tok225review.agentWorkspacePhaseConfigFreshness",
  workspace_provision: "tok225review.agentWorkspacePhaseProvision",
  workspace_seed: "tok225review.agentWorkspacePhaseSeed",
  workspace_runtime_provision: "tok225review.agentWorkspacePhaseRuntimeProvision",
  workspace_repair: "tok225review.agentWorkspacePhaseRepair",
  workspace_teardown: "tok225review.agentWorkspacePhaseTeardown",
  worktree_cleanup: "tok225review.agentWorkspacePhaseWorktreeCleanup",
  workspace_finalize: "tok225review.agentWorkspacePhaseFinalize",
};

const RUN_STATUS_KEYS: Record<string, string> = {
  running: "statusbadge.general.running",
  scheduled_retry: "statusbadge.general.scheduledRetry",
  succeeded: "statusbadge.general.succeeded",
  interrupted: "tok225review.agentRunInterrupted",
  failed: "statusbadge.general.failed",
  timed_out: "statusbadge.general.timedOut",
  terminated: "statusbadge.general.terminated",
  cancelled: "statusbadge.general.cancelled",
  queued: "statusbadge.general.queued",
  skipped: "tok225review.agentWorkspaceStatusSkipped",
};

export function agentInvocationSourceLabel(source: string, t: Translate): string {
  const key = INVOCATION_SOURCE_KEYS[source];
  return key ? t(key) : source;
}

export function agentWorkspacePhaseLabel(phase: string, t: Translate): string {
  const key = WORKSPACE_PHASE_KEYS[phase];
  return key ? t(key) : phase;
}

export function agentRunStatusLabel(status: string, t: Translate): string {
  const key = RUN_STATUS_KEYS[status];
  return key ? t(key) : status;
}

export function agentMoreSkillsLabel(count: number, t: Translate): string {
  return t("tok225review.agentMoreSkills", { count });
}
