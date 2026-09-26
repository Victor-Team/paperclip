import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  activityLog,
  agentRuntimeState,
  agentWakeupRequests,
  agents,
  companies,
  companyMemberships,
  companySkills,
  createDb,
  environmentLeases,
  heartbeatRunEvents,
  heartbeatRuns,
  issueComments,
  issueRecoveryActions,
  issueThreadInteractions,
  issues,
  principalPermissionGrants,
} from "@paperclipai/db";
import {
  PROVIDER_QUOTA_MONITOR_SERVICE_NAME,
  PROVIDER_TRANSIENT_RETRY_WAIT_MONITOR_SERVICE_NAME,
  PROVIDER_UNREACHABLE_MONITOR_SERVICE_NAME,
} from "@paperclipai/shared";
import request from "supertest";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { drainHeartbeatRunsToQuiescence } from "./helpers/drain-heartbeat-runs.js";
import { registerServerAdapter, unregisterServerAdapter } from "../adapters/index.ts";

const mockTelemetryClient = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("../telemetry.js", () => ({ getTelemetryClient: () => mockTelemetryClient }));

import { heartbeatService } from "../services/heartbeat.ts";
import { deliverReconciledExecutions, settleUnrecoverableExecutions } from "../services/execution-recovery-resolution.js";
import { terminalizeLegacyExecution } from "../services/legacy-execution-recovery.js";
import { isProviderUnreachableFailureMessage, PROVIDER_RETRY_WAIT_MAX_PROBES } from "../services/recovery/service.js";
import { agentService } from "../services/agents.js";
import { issueRoutes } from "../routes/issues.js";
import { routeApp, type BoardActor } from "./helpers/route-test-harness.js";
import { ensureHumanRoleDefaultGrants } from "../services/principal-access-compatibility.js";

/**
 * Ledger #56 (TOK-227, 2026-09-26): the machine lost its network. A seat's
 * run failed with "Unable to connect to API (EPROTO)", the platform spent the
 * two 30s bounded retries and then scheduled nothing; the issue sat
 * in_progress for ~30 minutes until the board pressed "retry" by hand.
 *
 * Closed-loop question: while the provider is unreachable, does the platform
 * keep probing on a bounded back-off (1 -> 2 -> 5 -> 10 minutes, capped), with
 * no board action and no recovery-only loop, and resume the ordinary work by
 * itself once the network is back?
 *
 * Every step drives default production entries only (normal `issue_assigned`
 * wake, the real finalize path, and the server's periodic passes:
 * promoteDueScheduledRetries -> resumeQueuedRuns -> reconcileStrandedAssignedIssues
 * -> tickTimers, plus the execution-control sweeps). Scheduled instants are
 * real (the recovery sweep arms each wait from the wall clock); the test drives
 * the scheduler with an explicit `now` at the production 30s cadence up to each
 * due instant and adds each wait to a virtual elapsed-time total.
 */

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
if (!embeddedPostgresSupport.supported) {
  // No module-level skip: this suite must run or fail loudly.
  throw new Error(
    `embedded Postgres unavailable for provider-unreachable closed-loop tests: ${embeddedPostgresSupport.reason ?? "unknown"}`,
  );
}

const CLAUDE_ADAPTER = "claude_local";
// External (plugin) adapter as in production: no errorCode, no errorFamily,
// no conversationContinuation marker; the failure is only prose.
const EXTERNAL_ADAPTER = "omp_local";

// Production TOK-227 error text (heartbeat_runs.error, all three failed runs).
const TOK227_ERROR = "Claude run failed: subtype=success: API Error: Unable to connect to API (EPROTO)";
const TOK227_RESULT = "API Error: Unable to connect to API (EPROTO)";

type AdapterMode =
  // TOK-227 first run (issue_assigned): errorCode claude_transient_upstream,
  // errorFamily transient_upstream, exit 143 after 63 turns of real work.
  | { kind: "claude_unreachable_first" }
  // TOK-227 bounded retries: same text, no errorCode (-> adapter_failed), no family.
  | { kind: "claude_unreachable_repeat" }
  | { kind: "omp_failure"; message: string }
  // TOK-229 (claude_local on the ACP engine), all three rounds: acpx_turn_failed.
  | { kind: "acp_service_failure" }
  // TOK-227 11:18 (run b65808cf): the turn finished (result success, is_error
  // false) but the CLI stayed alive with a background task, so the adapter's
  // terminal-result cleanup sent SIGTERM after 5s: exit 143, no error.
  | { kind: "claude_background_result" }
  // Guard shape: orphaned process-group cleanup (not a terminal result).
  | { kind: "orphan_cleanup" }
  | { kind: "success" };

const adapterState: {
  mode: AdapterMode;
  calls: Array<{ runId: string; mode: AdapterMode["kind"] }>;
  companyId: string | null;
  issueId: string | null;
} = { mode: { kind: "success" }, calls: [], companyId: null, issueId: null };

function claudeResultJson(numTurns: number, family: string | null) {
  return {
    type: "result",
    subtype: "success",
    is_error: true,
    result: TOK227_RESULT,
    summary: TOK227_RESULT,
    num_turns: numTurns,
    stop_reason: "stop_sequence",
    terminal_reason: "api_error",
    api_error_status: null,
    session_id: "claude-session-tok227",
    ...(family ? { errorFamily: family } : {}),
  };
}

describe("provider unreachable closed loop (ledger #56, default production entries)", () => {
  let db!: ReturnType<typeof createDb>;
  let heartbeat!: ReturnType<typeof heartbeatService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-unreachable-closed-loop-");
    db = createDb(tempDb.connectionString);
    heartbeat = heartbeatService(db);
    const execute = async (ctx: { runId: string; agent?: { id?: string }; context?: Record<string, unknown> }) => {
      const mode = adapterState.mode;
      const runIssueId = (typeof ctx.context?.issueId === "string" ? ctx.context.issueId : null) ?? adapterState.issueId!;
      adapterState.calls.push({ runId: ctx.runId, mode: mode.kind });
      if (mode.kind === "claude_unreachable_first") {
        return {
          exitCode: 143,
          signal: null,
          timedOut: false,
          errorMessage: TOK227_ERROR,
          errorCode: "claude_transient_upstream",
          errorFamily: "transient_upstream",
          retryNotBefore: null,
          summary: TOK227_RESULT,
          resultJson: claudeResultJson(63, "transient_upstream"),
        };
      }
      if (mode.kind === "claude_unreachable_repeat") {
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorMessage: TOK227_ERROR,
          summary: TOK227_RESULT,
          resultJson: claudeResultJson(1, null),
        };
      }
      if (mode.kind === "acp_service_failure") {
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorMessage: "ACP agent reported a terminal service failure.",
          errorCode: "acpx_turn_failed",
          resultJson: {
            mode: "persistent",
            status: "failed",
            summary: "ACP agent reported a terminal service failure.",
            fastMode: false,
            permissionMode: "approve-all",
          },
        };
      }
      if (mode.kind === "claude_background_result") {
        return {
          exitCode: 143,
          signal: null,
          timedOut: false,
          errorMessage: null,
          summary: "Waiting for the full run to finish.",
          resultJson: {
            type: "result",
            subtype: "success",
            is_error: false,
            result: "Waiting for the full run to finish.",
            summary: "Waiting for the full run to finish.",
            num_turns: 12,
            stop_reason: "end_turn",
            terminal_reason: "completed",
            session_id: "claude-session-tok227",
            unmanagedBackgroundTask: {
              kind: "terminal_result_cleanup",
              stopped: true,
              stopReason: "unmanaged_background_task_stopped",
              reason: "unmanaged background task stopped; no durable live path",
              terminalResultSeen: true,
              signal: "SIGTERM",
              forceKilled: false,
            },
          },
        };
      }
      if (mode.kind === "orphan_cleanup") {
        return {
          exitCode: 143,
          signal: null,
          timedOut: false,
          errorMessage: null,
          resultJson: {
            unmanagedBackgroundTask: {
              kind: "orphaned_process_group_cleanup",
              stopped: true,
              stopReason: "unmanaged_background_task_stopped",
              reason: "unmanaged background task stopped; no durable live path",
            },
          },
        };
      }
      if (mode.kind === "omp_failure") {
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorMessage: mode.message,
          resultJson: { errors: [mode.message], stderr: "", stdout: "", toolCalls: [], stopReason: "adapter_failed", timeoutFired: false, unknownLines: [] },
        };
      }
      // The seat finishes the task the way a real one does: run-linked comment, then done.
      await db.insert(issueComments).values({
        companyId: adapterState.companyId!,
        issueId: runIssueId,
        authorAgentId: ctx.agent?.id ?? null,
        authorType: "agent",
        createdByRunId: ctx.runId,
        body: "Network is back; task finished.",
      });
      await db.update(issues).set({ status: "done", completedAt: new Date() }).where(eq(issues.id, runIssueId));
      return { exitCode: 0, signal: null, timedOut: false, errorMessage: null, summary: "done" };
    };
    for (const type of [CLAUDE_ADAPTER, EXTERNAL_ADAPTER]) {
      registerServerAdapter({
        type,
        execute: execute as never,
        testEnvironment: async () => ({ adapterType: type, status: "pass", checks: [], testedAt: new Date().toISOString() }),
      });
    }
  }, 30_000);

  afterEach(async () => {
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await db.delete(heartbeatRunEvents);
        await db.delete(activityLog);
        await db.delete(environmentLeases);
        await db.delete(issueThreadInteractions);
        await db.delete(issueRecoveryActions);
        await db.delete(issueComments);
        await db.delete(issues);
        await db.delete(heartbeatRuns);
        await db.delete(agentWakeupRequests);
        await db.delete(agentRuntimeState);
        await db.delete(agents);
        await db.delete(companySkills);
        await db.delete(principalPermissionGrants);
        await db.delete(companyMemberships);
        await db.delete(companies);
        break;
      } catch (error) {
        if (attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    adapterState.calls = [];
  });

  afterAll(async () => {
    unregisterServerAdapter(CLAUDE_ADAPTER);
    unregisterServerAdapter(EXTERNAL_ADAPTER);
    await tempDb?.cleanup();
  });

  async function seed(adapterType: string, issueNumber = 1, existingCompanyId?: string) {
    const companyId = existingCompanyId ?? randomUUID();
    const agentId = randomUUID();
    const issueId = randomUUID();
    const prefix = `N${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    if (!existingCompanyId) {
      await db.insert(companies).values({
        id: companyId,
        name: "Unreachable Closed Loop Co",
        issuePrefix: prefix,
        requireBoardApprovalForNewAgents: false,
        defaultResponsibleUserId: "responsible-user",
      });
    }
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: `Seat${issueNumber}`,
      role: "engineer",
      status: "idle",
      adapterType,
      adapterConfig: {},
      runtimeConfig: { heartbeat: { wakeOnDemand: true, maxConcurrentRuns: 1 } },
      permissions: {},
    });
    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Assigned work while the network is down",
      status: "in_progress",
      priority: "medium",
      assigneeAgentId: agentId,
      issueNumber,
      identifier: `${prefix}-${issueNumber}`,
    });
    adapterState.companyId = companyId;
    adapterState.issueId = issueId;
    return { companyId, agentId, issueId };
  }

  async function wakeAssigned(agentId: string, issueId: string) {
    await heartbeat.wakeup(agentId, {
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_assigned",
      payload: { issueId },
      contextSnapshot: { issueId, wakeReason: "issue_assigned" },
    });
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
  }

  /** One pass of the server's periodic scheduler plus the execution-control sweeps. */
  async function fullSweep(now: number, opts: { tick?: boolean } = {}) {
    const at = new Date(now);
    await heartbeat.promoteDueScheduledRetries(at);
    await heartbeat.resumeQueuedRuns();
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    await heartbeat.reconcileStrandedAssignedIssues();
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    if (opts.tick !== false) {
      await heartbeat.tickTimers(at);
      await drainHeartbeatRunsToQuiescence(db, heartbeat);
    }
    await settleUnrecoverableExecutions(db, at);
    await deliverReconciledExecutions(db, heartbeat.wakeup);
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
  }

  async function snapshot(companyId: string, issueId: string) {
    const [issue] = await db.select().from(issues).where(eq(issues.id, issueId));
    const runs = await db.select().from(heartbeatRuns)
      .where(and(eq(heartbeatRuns.companyId, companyId), eq(heartbeatRuns.agentId, issue!.assigneeAgentId!)))
      .orderBy(asc(heartbeatRuns.createdAt));
    const actions = await db.select().from(issueRecoveryActions).where(eq(issueRecoveryActions.sourceIssueId, issueId));
    const monitor = ((issue!.executionPolicy as Record<string, any> | null)?.monitor ?? null) as Record<string, any> | null;
    return {
      issue: {
        status: issue!.status,
        monitorNextCheckAt: issue!.monitorNextCheckAt?.getTime() ?? null,
        monitorServiceName: monitor?.serviceName ?? null,
        monitorExternalRef: monitor?.externalRef ?? null,
      },
      runs: runs.map((run) => ({
        id: run.id,
        status: run.status,
        errorCode: run.errorCode,
        retryOfRunId: run.retryOfRunId,
        errorFamily: (run.resultJson as Record<string, unknown> | null)?.errorFamily ?? null,
        conversationContinuation: (run.resultJson as Record<string, unknown> | null)?.conversationContinuation ?? null,
        scheduledRetryAttempt: run.scheduledRetryAttempt,
        scheduledRetryReason: run.scheduledRetryReason,
        scheduledRetryAt: run.scheduledRetryAt?.getTime() ?? null,
        wakeReason: (run.contextSnapshot as Record<string, unknown> | null)?.wakeReason ?? null,
        finishedAt: run.finishedAt?.getTime() ?? null,
        livenessState: run.livenessState,
        livenessReason: run.livenessReason,
      })),
      actions: actions.map((action) => ({ ownerType: action.ownerType, status: action.status, cause: action.cause })),
    };
  }
  type Snap = Awaited<ReturnType<typeof snapshot>>;

  function log(label: string, value: unknown) {
    console.log(`[unreachable-closed-loop] ${label}: ${JSON.stringify(value, null, 1)}`);
  }

  function liveRuns(snap: Snap) {
    return snap.runs.filter((run) => ["scheduled_retry", "queued", "running"].includes(run.status));
  }

  /** At most one pending path, never two successors of one run, no board, no recovery-only turn. */
  function expectQuietWait(snap: Snap) {
    expect(liveRuns(snap).length).toBeLessThanOrEqual(1);
    const successors = snap.runs.map((run) => run.retryOfRunId).filter((id): id is string => Boolean(id));
    expect(new Set(successors).size).toBe(successors.length);
    expect(snap.actions).toEqual([]);
    expect(snap.runs.some((run) => run.wakeReason === "issue_recovery_only_continuation")).toBe(false);
    expect(snap.issue.status).toBe("in_progress");
  }

  async function monitorWaits(issueId: string) {
    const rows = await db
      .select({ action: activityLog.action, details: activityLog.details })
      .from(activityLog)
      .where(eq(activityLog.entityId, issueId))
      .orderBy(asc(activityLog.createdAt));
    return rows
      .filter((row) => row.action === "issue.monitor_scheduled")
      .map((row) => {
        const details = row.details as Record<string, any>;
        return { source: details.source, waitMs: Date.parse(String(details.nextCheckAt)) - Date.parse(String(details.scheduledAt)) };
      });
  }

  /** The next instant something is due: a pending scheduled retry, or the issue monitor. */
  function nextDueAt(snap: Snap) {
    const candidates = [
      ...liveRuns(snap).filter((run) => run.status === "scheduled_retry").map((run) => run.scheduledRetryAt!),
      ...(snap.issue.monitorNextCheckAt ? [snap.issue.monitorNextCheckAt] : []),
    ];
    return candidates.length ? Math.min(...candidates) : null;
  }

  /**
   * Keep the provider unreachable for `outageMs` of virtual time. Between two
   * due instants the scheduler runs at the production 30s cadence and nothing
   * may start early; at each due instant it runs twice (a retry created by a
   * monitor tick is promoted by the next pass). Returns the virtual time used.
   */
  const outageTrace: Array<{ gapMs: number; runs: number; pending: string[] }> = [];
  async function driveOutage(input: { companyId: string; issueId: string; outageMs: number }) {
    outageTrace.length = 0;
    let elapsed = 0;
    for (let guard = 0; guard < 80; guard += 1) {
      const before = await snapshot(input.companyId, input.issueId);
      const due = nextDueAt(before);
      expect(due).not.toBeNull();
      const anchor = Date.now();
      const gap = Math.max(0, due! - anchor);
      if (elapsed + gap > input.outageMs) return elapsed;
      const runsBefore = before.runs.length;
      for (let at = anchor + 30_000; at < due! - 1_000; at += 30_000) {
        await fullSweep(at);
        const early = await snapshot(input.companyId, input.issueId);
        expect(early.runs.length).toBe(runsBefore);
        expectQuietWait(early);
      }
      // A retry created by the monitor tick is promoted by the next pass
      // (production: 30s later). Same instant, no tick: a wait armed during
      // this pass is due on the wall clock, not at this virtual instant.
      await fullSweep(due! + 1_000);
      await fullSweep(due! + 1_000, { tick: false });
      const after = await snapshot(input.companyId, input.issueId);
      expectQuietWait(after);
      elapsed += gap;
      outageTrace.push({ gapMs: gap, runs: after.runs.length, pending: liveRuns(after).map((run) => run.status) });
    }
    throw new Error("outage loop did not converge");
  }

  /** Drive the bounded retries until the connectivity wait monitor is armed. */
  async function armConnectivityWait(companyId: string, issueId: string) {
    let snap = await snapshot(companyId, issueId);
    for (let guard = 0; guard < 6 && !snap.issue.monitorNextCheckAt; guard += 1) {
      const due = nextDueAt(snap) ?? Date.now();
      await fullSweep(due + 1_000);
      await fullSweep(due + 1_000, { tick: false });
      snap = await snapshot(companyId, issueId);
    }
    return snap;
  }

  /** Network is back: production cadence from now until the issue is done (or `limitMs`). */
  async function driveUntilDone(companyId: string, issueId: string, limitMs: number) {
    const anchor = Date.now();
    let end = await snapshot(companyId, issueId);
    let at = anchor;
    while (end.issue.status !== "done" && at - anchor < limitMs) {
      at += 30_000;
      await fullSweep(at);
      end = await snapshot(companyId, issueId);
    }
    return { end, tookMs: at - anchor };
  }

  async function boardAppFor(companyId: string) {
    const userId = `board-${randomUUID()}`;
    await db.insert(companyMemberships).values({
      companyId,
      principalType: "user",
      principalId: userId,
      status: "active",
      membershipRole: "owner",
      updatedAt: new Date(),
    });
    await ensureHumanRoleDefaultGrants(db, { companyId, principalId: userId, membershipRole: "owner", grantedByUserId: null });
    const actor: BoardActor = {
      type: "board",
      source: "session",
      userId,
      companyIds: [companyId],
      memberships: [{ companyId, membershipRole: "owner", status: "active" }],
      isInstanceAdmin: false,
    };
    return routeApp(db, actor, issueRoutes as never);
  }

  /** Seat fails like TOK-227; returns once the first failure is recorded. */
  async function startTok227(adapterType = CLAUDE_ADAPTER) {
    const seeded = await seed(adapterType);
    adapterState.mode = adapterType === CLAUDE_ADAPTER
      ? { kind: "claude_unreachable_first" }
      : { kind: "omp_failure", message: "request to https://api.provider.example/v1/messages failed, reason: connect ECONNREFUSED 10.0.0.1:443" };
    await wakeAssigned(seeded.agentId, seeded.issueId);
    if (adapterType === CLAUDE_ADAPTER) adapterState.mode = { kind: "claude_unreachable_repeat" };
    const s1 = await snapshot(seeded.companyId, seeded.issueId);
    return { ...seeded, s1 };
  }

  // ---- classification unit guard (the single owner of the vocabulary)

  it("classifies connectivity failures and nothing else (EPROTO/ECONNREFUSED/ECONNRESET/ETIMEDOUT/ENOTFOUND/EAI_AGAIN/fetch failed/socket hang up)", () => {
    for (const message of [
      TOK227_ERROR,
      "connect ECONNREFUSED 127.0.0.1:443",
      "read ECONNRESET",
      "connect ETIMEDOUT 104.18.1.1:443",
      "getaddrinfo ENOTFOUND api.anthropic.com",
      "getaddrinfo EAI_AGAIN api.openai.com",
      "TypeError: fetch failed",
      "Error: socket hang up",
      "write EPROTO 140000000:error:0A00010B:SSL routines",
    ]) expect({ message, unreachable: isProviderUnreachableFailureMessage(message) }).toEqual({ message, unreachable: true });
    for (const message of [
      "429 You have exceeded the 5-hour usage quota. It will reset at 2026-09-26 18:00:00 +0800 CST.",
      "You've hit your session limit · resets 5pm",
      'Model "provider/example-model" not found',
      "missing api key",
      "ACP agent reported a terminal limit failure.",
      "Overloaded",
      null,
    ]) expect({ message, unreachable: isProviderUnreachableFailureMessage(message) }).toEqual({ message, unreachable: false });
  });

  // ---- N1: a 30-minute outage, production claude_local shape

  it("N1: TOK-227 claude_local shape, 30-minute outage: bounded probes on 1->2->5->10 min back-off, no board, stays in_progress; network back -> resumes the ordinary work by itself", async () => {
    const { companyId, issueId, s1 } = await startTok227();
    log("N1 after first failure", s1);
    // First round is recognised on the adapter's own errorCode + prose.
    expect(s1.runs[0]).toMatchObject({
      status: "failed",
      errorCode: "claude_transient_upstream",
      errorFamily: "provider_unreachable",
      conversationContinuation: "continue_conversation_v1",
    });
    expect(liveRuns(s1)).toEqual([expect.objectContaining({ status: "scheduled_retry", scheduledRetryAttempt: 1, scheduledRetryReason: "transient_failure" })]);

    const offlineMs = await driveOutage({ companyId, issueId, outageMs: 30 * 60_000 });
    expect(offlineMs).toBeGreaterThanOrEqual(25 * 60_000);
    const sOut = await snapshot(companyId, issueId);
    log("N1 after 30 minutes offline", { trace: outageTrace, sOut });
    const failed = sOut.runs.filter((run) => run.status === "failed");
    // 3 bounded runs (0s, +30s, +60s) + probes at ~+2, +4, +9, +19, +29 min = 8.
    expect(failed.length).toBeGreaterThanOrEqual(7);
    expect(failed.length).toBeLessThanOrEqual(9);
    expect(adapterState.calls.length).toBe(failed.length);
    // Later rounds are adapter_failed with the prose only (production), still recognised.
    expect(failed.slice(1).every((run) => run.errorCode === "adapter_failed" && run.errorFamily === "provider_unreachable")).toBe(true);
    // Every probe is one counted retry turn, not an uncounted wake.
    expect(failed.map((run) => run.scheduledRetryAttempt)).toEqual(failed.map((_, index) => index));
    expect(failed.slice(1).every((run) => run.wakeReason === "transient_failure_retry")).toBe(true);
    // Back-off: 1, 2, 5, 10, 10 ... minutes, never shorter.
    const waits = await monitorWaits(issueId);
    log("N1 waits", waits);
    expect(waits.every((wait) => wait.source === "recovery.provider_unreachable")).toBe(true);
    expect(waits.slice(0, 5).map((wait) => Math.round(wait.waitMs / 60_000))).toEqual([1, 2, 5, 10, 10].slice(0, Math.min(5, waits.length)));
    expect(waits.length).toBeGreaterThanOrEqual(4);
    expect(sOut.issue.monitorServiceName).toBe(PROVIDER_UNREACHABLE_MONITOR_SERVICE_NAME);
    expectQuietWait(sOut);

    // Network is back. Nobody acts; the next due probe does the work as a normal turn.
    adapterState.mode = { kind: "success" };
    const { end, tookMs } = await driveUntilDone(companyId, issueId, 12 * 60_000);
    log("N1 end", { tookMs, end });
    expect(end.issue.status).toBe("done");
    // Picked up by the next probe: at most one 10-minute wait (+ one cadence step).
    expect(tookMs).toBeLessThanOrEqual(10 * 60_000 + 60_000);
    const succeeded = end.runs.filter((run) => run.status === "succeeded");
    expect(succeeded).toHaveLength(1);
    expect(succeeded[0]!.wakeReason).toBe("transient_failure_retry");
    expect(end.actions).toEqual([]);
    expect(end.runs.some((run) => run.wakeReason === "issue_recovery_only_continuation")).toBe(false);
    expect(liveRuns(end)).toEqual([]);
  }, 300_000);

  it("N1b: external adapter (omp_local, prose only): same bounded wait, no legacy reconciliation / recovery-only loop, resumes by itself", async () => {
    const { companyId, issueId, s1 } = await startTok227(EXTERNAL_ADAPTER);
    log("N1b after first failure", s1);
    expect(s1.runs[0]).toMatchObject({ status: "failed", errorCode: "adapter_failed", errorFamily: "provider_unreachable", conversationContinuation: null });
    expect(liveRuns(s1)).toEqual([expect.objectContaining({ status: "scheduled_retry", scheduledRetryAttempt: 1 })]);

    await driveOutage({ companyId, issueId, outageMs: 12 * 60_000 });
    const sOut = await snapshot(companyId, issueId);
    log("N1b after 12 minutes offline", sOut);
    const failed = sOut.runs.filter((run) => run.status === "failed");
    // 3 bounded + probes at ~+2, +4, +9 min.
    expect(failed.length).toBeGreaterThanOrEqual(5);
    expect(failed.length).toBeLessThanOrEqual(7);
    expect(failed.map((run) => run.scheduledRetryAttempt)).toEqual(failed.map((_, index) => index));
    expect(sOut.issue.monitorServiceName).toBe(PROVIDER_UNREACHABLE_MONITOR_SERVICE_NAME);
    expectQuietWait(sOut);

    adapterState.mode = { kind: "success" };
    const { end } = await driveUntilDone(companyId, issueId, 12 * 60_000);
    log("N1b end", end);
    expect(end.issue.status).toBe("done");
    expect(end.actions).toEqual([]);
    expect(end.runs.some((run) => run.wakeReason === "issue_recovery_only_continuation")).toBe(false);
    expect(end.runs.filter((run) => run.status === "succeeded")).toHaveLength(1);
  }, 300_000);

  // ---- N2: board "continue now" lists and releases connectivity waits

  it("N2: the company waits list shows connectivity waits with their reason in both phases, and resume-now releases them", async () => {
    const { companyId, issueId } = await startTok227();
    const app = await boardAppFor(companyId);

    // Phase one: the bounded 30s retry is pending.
    const phaseOne = await request(app).get(`/api/companies/${companyId}/provider-quota/waits`);
    expect(phaseOne.status).toBe(200);
    expect(phaseOne.body.waits).toEqual([expect.objectContaining({ issueId, kind: "scheduled_retry", reason: "provider_unreachable" })]);

    // Phase two: bounded retries spent, the connectivity wait monitor is armed.
    let snap = await armConnectivityWait(companyId, issueId);
    expect(snap.issue.monitorServiceName).toBe(PROVIDER_UNREACHABLE_MONITOR_SERVICE_NAME);
    const phaseTwo = await request(app).get(`/api/companies/${companyId}/provider-quota/waits`);
    expect(phaseTwo.body).toMatchObject({ count: 1 });
    expect(phaseTwo.body.waits).toEqual([expect.objectContaining({ issueId, reason: "provider_unreachable" })]);
    expect(phaseTwo.body.waits[0].kind).not.toBe("stale_monitor");
    const callsBefore = adapterState.calls.length;

    adapterState.mode = { kind: "success" };
    const click = await request(app).post(`/api/companies/${companyId}/provider-quota/resume-now`).send({});
    expect(click.status).toBe(200);
    expect(click.body.results).toEqual([expect.objectContaining({ issueId, outcome: "released" })]);
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && (await snapshot(companyId, issueId)).issue.status !== "done") {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await drainHeartbeatRunsToQuiescence(db, heartbeat);
    }
    const end = await snapshot(companyId, issueId);
    log("N2 end", end);
    expect(end.issue.status).toBe("done");
    expect(adapterState.calls.slice(callsBefore).map((call) => call.mode)).toEqual(["success"]);
    expect((await request(app).get(`/api/companies/${companyId}/provider-quota/waits`)).body.count).toBe(0);
  }, 300_000);

  // ---- N3: quota and configuration failures keep their own paths

  it("N3: provider quota and configuration failures are not taken for connectivity and keep their own paths", async () => {
    // Quota prose (external adapter) -> provider_quota family, quota wait; a network word does not steal it.
    const quota = await seed(EXTERNAL_ADAPTER, 1);
    adapterState.mode = { kind: "omp_failure", message: "429 You have exceeded the 5-hour usage quota (after read ECONNRESET on a previous attempt)." };
    await wakeAssigned(quota.agentId, quota.issueId);
    let at = Date.now();
    for (let step = 0; step < 4; step += 1) {
      at += 61 * 60_000;
      await fullSweep(at);
    }
    const q = await snapshot(quota.companyId, quota.issueId);
    log("N3 quota", q);
    expect(q.runs.filter((run) => run.status === "failed").every((run) => run.errorFamily === "provider_quota")).toBe(true);
    // The quota wait owns it (armed at least once), never the connectivity wait.
    const quotaWaits = await monitorWaits(quota.issueId);
    expect(quotaWaits.length).toBeGreaterThanOrEqual(1);
    expect(quotaWaits.every((wait) => wait.source === "recovery.provider_quota")).toBe(true);
    expect([null, PROVIDER_QUOTA_MONITOR_SERVICE_NAME]).toContain(q.issue.monitorServiceName);
    expect(q.actions).toEqual([]);
    const app = await boardAppFor(quota.companyId);
    const waits = await request(app).get(`/api/companies/${quota.companyId}/provider-quota/waits`);
    expect(waits.body.waits).toEqual([expect.objectContaining({ issueId: quota.issueId, reason: "provider_quota" })]);

    // Configuration prose -> configuration_incomplete: blocked with a board action, no probing.
    const config = await seed(EXTERNAL_ADAPTER, 2, quota.companyId);
    adapterState.mode = { kind: "omp_failure", message: 'Model "provider/example-model" not found' };
    await wakeAssigned(config.agentId, config.issueId);
    for (let step = 0; step < 8; step += 1) {
      at += 30_000;
      await fullSweep(at);
    }
    const c = await snapshot(config.companyId, config.issueId);
    log("N3 config", c);
    expect(c.runs.filter((run) => run.status === "failed").every((run) => run.errorFamily === "configuration_incomplete")).toBe(true);
    expect(c.issue.status).toBe("blocked");
    expect(c.issue.monitorServiceName).toBeNull();
    expect(c.actions).toEqual([expect.objectContaining({ ownerType: "board", cause: "configuration_incomplete" })]);
    // No probing: at most the first failure and one retry of this seat ran.
    expect(c.runs.filter((run) => run.status === "failed").length).toBeLessThanOrEqual(2);
    expect(liveRuns(c)).toEqual([]);
  }, 300_000);

  // ---- N4: repeated failures never stack

  it("N4: an issue already waiting is not re-armed or stacked by sweeps, ticks or further failures; each probe is exactly one run", async () => {
    const { companyId, agentId, issueId } = await startTok227();
    let snap = await armConnectivityWait(companyId, issueId);
    const armed = snap;
    expect(armed.issue.monitorServiceName).toBe(PROVIDER_UNREACHABLE_MONITOR_SERVICE_NAME);
    const armedWaits = (await monitorWaits(issueId)).length;
    const armedRuns = armed.runs.length;

    // Many passes before it is due: nothing moves.
    const now = Date.now();
    for (let pass = 1; pass <= 6; pass += 1) {
      await fullSweep(Math.min(now + pass * 5_000, armed.issue.monitorNextCheckAt! - 1_000));
    }
    expect((await snapshot(companyId, issueId)).runs).toHaveLength(armedRuns);
    expect(await monitorWaits(issueId)).toHaveLength(armedWaits);
    // The wait is due, but the recovery sweep runs before the timer tick: it
    // must not re-arm (push out) the wait. Make it due on the wall clock.
    const dueAt = new Date(Date.now() - 1_000);
    await db.update(issues).set({ monitorNextCheckAt: dueAt }).where(eq(issues.id, issueId));
    await heartbeat.reconcileStrandedAssignedIssues();
    await heartbeat.reconcileStrandedAssignedIssues();
    const beforeTick = await snapshot(companyId, issueId);
    expect(beforeTick.issue.monitorNextCheckAt).toBe(dueAt.getTime());
    expect(beforeTick.runs).toHaveLength(armedRuns);
    expect(await monitorWaits(issueId)).toHaveLength(armedWaits);

    // The due probe starts exactly one run; its failure re-arms exactly one wait.
    let at = Date.now() + 1_000;
    await fullSweep(at);
    await fullSweep(at, { tick: false });
    await fullSweep(at, { tick: false });
    const afterProbe = await snapshot(companyId, issueId);
    log("N4 after one probe", afterProbe);
    expect(afterProbe.runs).toHaveLength(armedRuns + 1);
    expect(afterProbe.runs.at(-1)).toMatchObject({ status: "failed", errorFamily: "provider_unreachable" });
    expect(await monitorWaits(issueId)).toHaveLength(armedWaits + 1);
    expect(afterProbe.issue.monitorExternalRef).toBe(afterProbe.runs.at(-1)!.id);
    expectQuietWait(afterProbe);
    const queuedWakes = await db.select().from(agentWakeupRequests)
      .where(and(eq(agentWakeupRequests.agentId, agentId), eq(agentWakeupRequests.status, "queued")));
    expect(queuedWakes).toEqual([]);
  }, 300_000);

  // ---- N5: a recovery-only hold left from before this fix (external adapter,
  // connectivity failure held for reconciliation, then settled) must not wake
  // the seat as "recovery-only"; once a connectivity probe interval (10 min)
  // has passed it resumes the ordinary work.

  it("N5: a settled legacy hold on a connectivity failure waits, then resumes as an ordinary continuation (no recovery-only turn)", async () => {
    const seeded = await seed(EXTERNAL_ADAPTER);
    const runId = randomUUID();
    const finishedAt = new Date();
    const message = "request to https://api.provider.example/v1/messages failed, reason: getaddrinfo EAI_AGAIN api.provider.example";
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId: seeded.companyId,
      agentId: seeded.agentId,
      invocationSource: "automation",
      triggerDetail: "system",
      status: "running",
      runtimeMode: "legacy",
      startedAt: new Date(finishedAt.getTime() - 4_000),
      contextSnapshot: { issueId: seeded.issueId, taskId: seeded.issueId, wakeReason: "issue_reopened_via_comment" },
      runnerProfileJson: { adapterDispatch: { adapterType: EXTERNAL_ADAPTER } },
    });
    await db.update(issues).set({ executionRunId: runId }).where(eq(issues.id, seeded.issueId));
    const [running] = await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, runId));
    await terminalizeLegacyExecution({
      db,
      run: running!,
      status: "failed",
      fromStatuses: ["running"],
      patch: {
        error: message,
        errorCode: "adapter_failed",
        exitCode: 1,
        finishedAt,
        resultJson: { errors: [message], stopReason: "adapter_failed", toolCalls: [], errorFamily: "provider_unreachable" },
      },
    });
    await settleUnrecoverableExecutions(db, new Date());
    const [held] = await db.select().from(issueRecoveryActions).where(eq(issueRecoveryActions.sourceIssueId, seeded.issueId));
    expect(held).toMatchObject({ status: "resolved", cause: "legacy_execution_requires_reconciliation" });

    adapterState.mode = { kind: "success" };
    const deliverAndDrain = async () => {
      await deliverReconciledExecutions(db, heartbeat.wakeup);
      await drainHeartbeatRunsToQuiescence(db, heartbeat);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await drainHeartbeatRunsToQuiescence(db, heartbeat);
    };
    for (let pass = 0; pass < 4; pass += 1) await deliverAndDrain();
    expect(adapterState.calls).toHaveLength(0);

    // Ten minutes have passed since the failure: the next pass resumes the work.
    await db.update(heartbeatRuns).set({ finishedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(heartbeatRuns.id, runId));
    await deliverAndDrain();
    const end = await snapshot(seeded.companyId, seeded.issueId);
    log("N5 end", end);
    expect(adapterState.calls.map((call) => call.mode)).toEqual(["success"]);
    const resumed = end.runs.find((run) => run.id !== runId)!;
    expect(resumed.wakeReason).toBe("issue_recovery_action_restored");
    expect(end.runs.some((run) => run.wakeReason === "issue_recovery_only_continuation")).toBe(false);
    const [row] = await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.id, resumed.id));
    expect((row!.contextSnapshot as Record<string, any>).resourceFailureCleared).toMatchObject({
      cause: "provider_unreachable",
      resolvedBy: "connectivity_wait_elapsed",
      sourceRunId: runId,
    });
    expect(end.issue.status).toBe("done");
  }, 120_000);


  // ---- Scene A (TOK-229): any transient failure, not only the network

  async function startTok229() {
    const seeded = await seed(CLAUDE_ADAPTER);
    adapterState.mode = { kind: "acp_service_failure" };
    await wakeAssigned(seeded.agentId, seeded.issueId);
    return seeded;
  }

  it("A1: TOK-229 shape (claude_local, acpx_turn_failed x3): bounded retries, then the retry wait on the 1->2->5 min back-off, no board, listed for continue-now; recovers by itself", async () => {
    const { companyId, issueId } = await startTok229();
    const s1 = await snapshot(companyId, issueId);
    expect(s1.runs[0]).toMatchObject({ status: "failed", errorCode: "acpx_turn_failed", errorFamily: null, conversationContinuation: "continue_conversation_v1" });

    await driveOutage({ companyId, issueId, outageMs: 12 * 60_000 });
    const sOut = await snapshot(companyId, issueId);
    log("A1 after 12 minutes", { trace: outageTrace, sOut });
    const failed = sOut.runs.filter((run) => run.status === "failed");
    // 3 bounded + probes at ~+2, +4, +9 min.
    expect(failed.length).toBeGreaterThanOrEqual(5);
    expect(failed.length).toBeLessThanOrEqual(7);
    expect(failed.every((run) => run.errorCode === "acpx_turn_failed")).toBe(true);
    expect(failed.map((run) => run.scheduledRetryAttempt)).toEqual(failed.map((_, index) => index));
    const waits = await monitorWaits(issueId);
    expect(waits.every((wait) => wait.source === "recovery.transient_retry_wait")).toBe(true);
    expect(waits.slice(0, 3).map((wait) => Math.round(wait.waitMs / 60_000))).toEqual([1, 2, 5]);
    expect(sOut.issue.monitorServiceName).toBe(PROVIDER_TRANSIENT_RETRY_WAIT_MONITOR_SERVICE_NAME);
    expectQuietWait(sOut);

    const app = await boardAppFor(companyId);
    const listed = await request(app).get(`/api/companies/${companyId}/provider-quota/waits`);
    expect(listed.body.waits).toEqual([expect.objectContaining({ issueId, reason: "transient_failure" })]);

    adapterState.mode = { kind: "success" };
    const { end, tookMs } = await driveUntilDone(companyId, issueId, 12 * 60_000);
    log("A1 end", { tookMs, end });
    expect(end.issue.status).toBe("done");
    expect(tookMs).toBeLessThanOrEqual(10 * 60_000 + 60_000);
    expect(end.actions).toEqual([]);
    expect(end.runs.filter((run) => run.status === "succeeded")).toHaveLength(1);
  }, 300_000);

  it.each(["config_revision", "adapter_switch"] as const)(
    "A2: the seat is changed during a 10-minute wait (%s): probed on the next timer tick, not at the back-off step",
    async (change) => {
      const { companyId, agentId, issueId } = await startTok229();
      // Drive to the first 10-minute wait (probes at 1, 2, 5 minutes all fail).
      let snap = await snapshot(companyId, issueId);
      for (let guard = 0; guard < 12; guard += 1) {
        const waits = await monitorWaits(issueId);
        if (waits.length && waits.at(-1)!.waitMs >= 10 * 60_000 && snap.issue.monitorNextCheckAt) break;
        const due = nextDueAt(snap)!;
        await fullSweep(due + 1_000);
        await fullSweep(due + 1_000, { tick: false });
        snap = await snapshot(companyId, issueId);
      }
      const armed = snap;
      expect(armed.issue.monitorNextCheckAt! - Date.now()).toBeGreaterThan(9 * 60_000);
      const waitsBefore = (await monitorWaits(issueId)).length;
      const runsBefore = armed.runs.length;

      // TOK-229 11:21: the board switches the seat's engine (a config revision).
      if (change === "config_revision") {
        await agentService(db).update(agentId, { adapterConfig: { engine: "cli" } }, {
          recordRevision: { createdByUserId: "board-user", source: "patch" },
        });
      } else {
        await agentService(db).update(agentId, { adapterType: EXTERNAL_ADAPTER, adapterConfig: {} }, {
          recordRevision: { createdByUserId: "board-user", source: "patch" },
        });
      }
      adapterState.mode = { kind: "success" };
      const now = Date.now();
      await fullSweep(now);
      const pulled = await snapshot(companyId, issueId);
      log(`A2(${change}) after the seat change`, pulled);
      expect(pulled.issue.monitorNextCheckAt).not.toBeNull();
      expect(pulled.issue.monitorNextCheckAt!).toBeLessThanOrEqual(Date.now());
      // Same wait, only moved: no second wait armed.
      expect(await monitorWaits(issueId)).toHaveLength(waitsBefore);
      await fullSweep(Date.now() + 1_000);
      await fullSweep(Date.now() + 1_000, { tick: false });
      const end = await snapshot(companyId, issueId);
      log(`A2(${change}) end`, end);
      expect(end.issue.status).toBe("done");
      expect(end.runs).toHaveLength(runsBefore + 1);
      expect(end.actions).toEqual([]);
    },
    300_000,
  );

  it("A3: probing is capped: after the maximum probes the task is blocked for the board with the reason; a seat change then resumes it by itself", async () => {
    const { companyId, agentId, issueId } = await startTok229();
    // Keep failing; jump from one due instant to the next until the wait gives up.
    let snap = await snapshot(companyId, issueId);
    for (let guard = 0; guard < 60 && snap.issue.status !== "blocked"; guard += 1) {
      expect(snap.actions).toEqual([]);
      expect(liveRuns(snap).length).toBeLessThanOrEqual(1);
      const due = nextDueAt(snap);
      expect(due).not.toBeNull();
      await fullSweep(due! + 1_000);
      await fullSweep(due! + 1_000, { tick: false });
      snap = await snapshot(companyId, issueId);
    }
    const capped = snap;
    log("A3 after the cap", { runs: capped.runs.length, issue: capped.issue, actions: capped.actions });
    const failed = capped.runs.filter((run) => run.status === "failed");
    // 3 bounded runs + PROVIDER_RETRY_WAIT_MAX_PROBES probes, then nothing more.
    expect(failed).toHaveLength(3 + PROVIDER_RETRY_WAIT_MAX_PROBES);
    expect(capped.issue.status).toBe("blocked");
    expect(capped.actions).toEqual([expect.objectContaining({ ownerType: "board", status: "active", cause: "provider_retry_exhausted" })]);
    const [action] = await db.select().from(issueRecoveryActions).where(eq(issueRecoveryActions.sourceIssueId, issueId));
    expect(action!.nextAction).toMatch(/retries/);
    const [row] = await db.select().from(issues).where(eq(issues.id, issueId));
    expect(JSON.stringify(row!.unblockDescriptor)).toMatch(/kept failing/);
    // Nothing probes while it is blocked.
    for (let pass = 1; pass <= 4; pass += 1) await fullSweep(Date.now() + pass * 11 * 60_000);
    expect((await snapshot(companyId, issueId)).runs).toHaveLength(capped.runs.length);

    // The board changes the seat: restored and woken without pressing retry.
    await agentService(db).update(agentId, { adapterConfig: { engine: "cli" } }, {
      recordRevision: { createdByUserId: "board-user", source: "patch" },
    });
    adapterState.mode = { kind: "success" };
    await fullSweep(Date.now() + 30_000);
    await fullSweep(Date.now() + 60_000);
    const end = await snapshot(companyId, issueId);
    log("A3 end", { issue: end.issue, actions: end.actions, last: end.runs.at(-1) });
    expect(end.issue.status).toBe("done");
    expect(end.runs.at(-1)).toMatchObject({ status: "succeeded", wakeReason: "issue_recovery_action_restored" });
    expect(end.actions).toEqual([expect.objectContaining({ status: "resolved", cause: "provider_retry_exhausted" })]);
  }, 600_000);

  // ---- Scene B (TOK-227 11:18): a finished turn stopped by the platform's own cleanup

  it("B1: result success then SIGTERM by the terminal-result cleanup (exit 143) is a finished turn: no failure, no transient retry; the platform keeps the task moving", async () => {
    const seeded = await seed(CLAUDE_ADAPTER);
    adapterState.mode = { kind: "claude_background_result" };
    await wakeAssigned(seeded.agentId, seeded.issueId);
    const s1 = await snapshot(seeded.companyId, seeded.issueId);
    log("B1 after the first turns", s1);
    // The turn and the platform's own missing-comment follow-up (same shape) both finished.
    expect(s1.runs.map((run) => [run.status, run.errorCode, run.wakeReason])).toEqual([
      ["succeeded", null, "issue_assigned"],
      ["succeeded", null, "missing_issue_comment"],
    ]);
    expect(s1.runs.some((run) => run.scheduledRetryReason === "transient_failure")).toBe(false);
    expect(s1.issue.status).toBe("in_progress");
    expect(s1.actions).toEqual([]);

    // Two finished turns without visible progress: the existing anti-storm
    // rewake throttle (PAP-13775) holds the next continuation for a cooldown.
    adapterState.mode = { kind: "success" };
    await fullSweep(Date.now() + 30_000);
    expect((await snapshot(seeded.companyId, seeded.issueId)).runs).toHaveLength(2);
    // The cooldown (at most 30 minutes) passes; the periodic sweep continues the work.
    await db.update(heartbeatRuns)
      .set({ finishedAt: new Date(Date.now() - 31 * 60_000) })
      .where(eq(heartbeatRuns.agentId, seeded.agentId));
    await fullSweep(Date.now() + 60_000);
    await fullSweep(Date.now() + 90_000);
    const end = await snapshot(seeded.companyId, seeded.issueId);
    log("B1 end", end);
    expect(end.issue.status).toBe("done");
    expect(end.runs.at(-1)).toMatchObject({ status: "succeeded", wakeReason: "issue_continuation_needed" });
    expect(end.runs.every((run) => run.status === "succeeded")).toBe(true);
    expect(end.actions).toEqual([]);
  }, 300_000);

  it("B2: an orphaned process-group cleanup (no terminal result) with exit 143 is still a failed turn", async () => {
    const seeded = await seed(CLAUDE_ADAPTER);
    adapterState.mode = { kind: "orphan_cleanup" };
    await wakeAssigned(seeded.agentId, seeded.issueId);
    const s1 = await snapshot(seeded.companyId, seeded.issueId);
    log("B2", s1);
    expect(s1.runs[0]).toMatchObject({ status: "failed" });
  }, 120_000);

});
