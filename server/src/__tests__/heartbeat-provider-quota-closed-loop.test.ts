import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
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
import { issueRoutes } from "../routes/issues.js";
import { routeApp, type BoardActor } from "./helpers/route-test-harness.js";
import { ensureHumanRoleDefaultGrants } from "../services/principal-access-compatibility.js";

/**
 * Commercial closed-loop question: an assigned seat keeps hitting provider
 * quota on one in_progress issue. Once the quota is back (reset time reached,
 * or the operator tops up early), does the platform resume on its own with
 * zero human action, or does it give up / hand the issue to the board?
 *
 * Every step drives the default production entries only: a normal
 * `issue_assigned` wake, the real finalize path, and the same periodic sweep
 * the server runs (index.ts: promoteDueScheduledRetries -> resumeQueuedRuns ->
 * reconcileStrandedAssignedIssues, plus tickTimers for issue monitors).
 * Time is advanced by passing an explicit `now` to those entries.
 */

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
if (!embeddedPostgresSupport.supported) {
  // No module-level skip: this suite must run or fail loudly.
  throw new Error(
    `embedded Postgres unavailable for provider-quota closed-loop tests: ${embeddedPostgresSupport.reason ?? "unknown"}`,
  );
}

const ADAPTER = "provider_quota_closed_loop_test";
// A built-in conversation adapter type (conversation-continuation.ts
// CONVERSATION_ADAPTER_TYPES). Overriding its execute keeps every other
// platform path real: heartbeat finalize itself stamps
// `conversationContinuation: "continue_conversation_v1"` on failed runs of
// these adapter types (heartbeat.ts mergeRunStopMetadataForAgent), exactly as
// production does. registerServerAdapter restores the built-in on unregister.
const CONVERSATION_ADAPTER = "codex_local";

type AdapterMode =
  | {
      kind: "quota";
      retryNotBefore: string | null;
      // Real claude/codex ACP quota results carry no executionRecovery
      // evidence; the platform's own quota fixture does. Both are exercised.
      bootstrapEvidence: boolean;
    }
  | { kind: "success" }
  // Same shape as the 09-25 production Codex failures: generic ACP turn
  // failure, no errorFamily, no reset time.
  | { kind: "acpx_turn_failed" }
  // TOK-226 (opencode_local): quota reported only as prose in errorMessage,
  // no errorCode, no errorFamily, no retryNotBefore.
  | { kind: "prose_quota"; message: string };

const adapterState: {
  mode: AdapterMode;
  calls: Array<{ runId: string; mode: AdapterMode["kind"]; agentId?: string; issueId?: string }>;
  inFlight: Map<string, number>;
  maxInFlight: Map<string, number>;
  issueId: string | null;
  agentId: string | null;
  companyId: string | null;
} = {
  mode: { kind: "quota", retryNotBefore: null, bootstrapEvidence: true },
  calls: [],
  inFlight: new Map(),
  maxInFlight: new Map(),
  issueId: null,
  agentId: null,
  companyId: null,
};

describe("provider quota closed loop (default production entries)", () => {
  let db!: ReturnType<typeof createDb>;
  let heartbeat!: ReturnType<typeof heartbeatService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-quota-closed-loop-");
    db = createDb(tempDb.connectionString);
    heartbeat = heartbeatService(db);
    const execute = async (ctx: { runId: string; agent?: { id?: string }; context?: Record<string, unknown> }) => {
        const mode = adapterState.mode;
        const runAgentId = ctx.agent?.id ?? adapterState.agentId!;
        const runIssueId = (typeof ctx.context?.issueId === "string" ? ctx.context.issueId : null) ?? adapterState.issueId!;
        adapterState.calls.push({ runId: ctx.runId, mode: mode.kind, agentId: runAgentId, issueId: runIssueId });
        const inFlight = (adapterState.inFlight.get(runAgentId) ?? 0) + 1;
        adapterState.inFlight.set(runAgentId, inFlight);
        adapterState.maxInFlight.set(runAgentId, Math.max(adapterState.maxInFlight.get(runAgentId) ?? 0, inFlight));
        try {
        if (mode.kind === "prose_quota") {
          return { exitCode: 1, signal: null, timedOut: false, errorMessage: mode.message };
        }
        if (mode.kind === "acpx_turn_failed") {
          return {
            exitCode: 1,
            signal: null,
            timedOut: false,
            errorMessage: "ACP agent reported a terminal limit failure.",
            errorCode: "acpx_turn_failed",
            resultJson: { status: "failed" },
          };
        }
        if (mode.kind === "success") {
          // The agent finishes the task the way a real seat does: it posts a
          // run-linked comment and moves the issue to done through the API.
          // Hold the turn briefly so overlapping starts on one seat would be observed.
          await new Promise((resolve) => setTimeout(resolve, 300));
          await db.insert(issueComments).values({
            companyId: adapterState.companyId!,
            issueId: runIssueId,
            authorAgentId: runAgentId,
            authorType: "agent",
            createdByRunId: ctx.runId,
            body: "Task finished after quota recovered.",
          });
          await db
            .update(issues)
            .set({ status: "done", completedAt: new Date() })
            .where(eq(issues.id, runIssueId));
          return { exitCode: 0, signal: null, timedOut: false, errorMessage: null, summary: "done" };
        }
        const evidence = mode.bootstrapEvidence
          ? { executionRecovery: { kind: "bootstrap" as const, providerWorkStarted: false } }
          : {};
        return {
          exitCode: 1,
          signal: null,
          timedOut: false,
          errorMessage: mode.retryNotBefore
            ? `You've hit your session limit · resets ${mode.retryNotBefore}`
            : "ACP agent reported a terminal limit failure.",
          errorCode: "provider_quota",
          errorFamily: "provider_quota",
          ...evidence,
          ...(mode.retryNotBefore ? { retryNotBefore: mode.retryNotBefore } : {}),
          resultJson: {
            ...evidence,
            errorFamily: "provider_quota",
            ...(mode.retryNotBefore
              ? { retryNotBefore: mode.retryNotBefore, providerQuotaRetryNotBefore: mode.retryNotBefore }
              : {}),
          },
        };
        } finally {
          adapterState.inFlight.set(runAgentId, (adapterState.inFlight.get(runAgentId) ?? 1) - 1);
        }
    };
    for (const type of [ADAPTER, CONVERSATION_ADAPTER, "opencode_local"]) {
      registerServerAdapter({
        type,
        execute: execute as never,
        testEnvironment: async () => ({
          adapterType: type,
          status: "pass",
          checks: [],
          testedAt: new Date().toISOString(),
        }),
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
    adapterState.inFlight.clear();
    adapterState.maxInFlight.clear();
  });

  afterAll(async () => {
    unregisterServerAdapter(ADAPTER);
    unregisterServerAdapter(CONVERSATION_ADAPTER);
    unregisterServerAdapter("opencode_local");
    await tempDb?.cleanup();
  });

  async function seed(adapterType: string = ADAPTER) {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const issueId = randomUUID();
    const prefix = `Q${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    await db.insert(companies).values({
      id: companyId,
      name: "Quota Closed Loop Co",
      issuePrefix: prefix,
      requireBoardApprovalForNewAgents: false,
      defaultResponsibleUserId: "responsible-user",
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "QuotaSeat",
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
      title: "Assigned work that hits provider quota",
      status: "in_progress",
      priority: "medium",
      assigneeAgentId: agentId,
      issueNumber: 1,
      identifier: `${prefix}-1`,
    });
    adapterState.companyId = companyId;
    adapterState.agentId = agentId;
    adapterState.issueId = issueId;
    return { companyId, agentId, issueId };
  }

  async function wakeAssigned(agentId: string, issueId: string) {
    const run = await heartbeat.wakeup(agentId, {
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_assigned",
      payload: { issueId },
      contextSnapshot: { issueId, wakeReason: "issue_assigned" },
    });
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    return run;
  }

  /** One pass of the server's periodic scheduler at virtual time `now`. */
  async function sweep(now: Date) {
    const promotion = await heartbeat.promoteDueScheduledRetries(now);
    await heartbeat.resumeQueuedRuns();
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    const reconciled = await heartbeat.reconcileStrandedAssignedIssues();
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    const timers = await heartbeat.tickTimers(now);
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    return { promoted: promotion.promoted, reconciled, timers };
  }

  async function snapshot(companyId: string, issueId: string) {
    const [issue] = await db.select().from(issues).where(eq(issues.id, issueId));
    const runs = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.companyId, companyId))
      .orderBy(asc(heartbeatRuns.createdAt));
    const actions = await db
      .select()
      .from(issueRecoveryActions)
      .where(eq(issueRecoveryActions.sourceIssueId, issueId));
    const interactions = await db
      .select()
      .from(issueThreadInteractions)
      .where(eq(issueThreadInteractions.issueId, issueId));
    return {
      issue: {
        status: issue!.status,
        executionRunId: issue!.executionRunId,
        monitorNextCheckAt: issue!.monitorNextCheckAt?.toISOString() ?? null,
        assigneeAgentId: issue!.assigneeAgentId,
      },
      runs: runs.map((run) => ({
        id: run.id,
        status: run.status,
        errorCode: run.errorCode,
        retryOfRunId: run.retryOfRunId,
        scheduledRetryAttempt: run.scheduledRetryAttempt,
        scheduledRetryReason: run.scheduledRetryReason,
        scheduledRetryAt: run.scheduledRetryAt?.toISOString() ?? null,
        conversationContinuation: (run.resultJson as Record<string, unknown> | null)?.conversationContinuation ?? null,
        errorFamily: (run.resultJson as Record<string, unknown> | null)?.errorFamily ?? null,
        wakeReason: (run.contextSnapshot as Record<string, unknown> | null)?.wakeReason ?? null,
        invocationSource: run.invocationSource,
        wakeupRequestId: run.wakeupRequestId,
      })),
      actions: actions.map((action) => ({
        kind: action.kind,
        ownerType: action.ownerType,
        status: action.status,
        cause: action.cause,
      })),
      interactions: interactions.map((row) => ({ kind: row.kind, status: row.status })),
      activity: (
        await db.select({ action: activityLog.action }).from(activityLog).where(eq(activityLog.entityId, issueId))
      ).map((row) => row.action),
    };
  }

  function log(label: string, value: unknown) {
    console.log(`[quota-closed-loop] ${label}: ${JSON.stringify(value, null, 1)}`);
  }

  function failedRuns(snap: Awaited<ReturnType<typeof snapshot>>) {
    return snap.runs.filter((run) => run.status === "failed" && run.errorCode === "provider_quota");
  }
  function pendingRetries(snap: Awaited<ReturnType<typeof snapshot>>) {
    return snap.runs.filter((run) => run.status === "scheduled_retry");
  }

  it("A: resumes by itself when quota returns within the bounded retry budget (2 failures, then success)", async () => {
    const { companyId, agentId, issueId } = await seed();
    const reset = new Date(Date.now() + 10 * 60_000).toISOString();
    adapterState.mode = { kind: "quota", retryNotBefore: reset, bootstrapEvidence: true };

    await wakeAssigned(agentId, issueId);
    const s1 = await snapshot(companyId, issueId);
    log("A after run 1", s1);
    expect(failedRuns(s1)).toHaveLength(1);
    expect(pendingRetries(s1)).toEqual([
      expect.objectContaining({ scheduledRetryAttempt: 1, scheduledRetryReason: "transient_failure", scheduledRetryAt: reset }),
    ]);
    expect(s1.issue.status).toBe("in_progress");
    expect(s1.actions).toEqual([]);
    expect(s1.interactions).toEqual([]);

    // Before the reset instant nothing is promoted.
    expect((await sweep(new Date(Date.parse(reset) - 1_000))).promoted).toBe(0);

    await sweep(new Date(Date.parse(reset) + 60_000));
    const s2 = await snapshot(companyId, issueId);
    log("A after run 2", s2);
    expect(failedRuns(s2)).toHaveLength(2);
    expect(pendingRetries(s2)).toEqual([
      expect.objectContaining({ scheduledRetryAttempt: 2, scheduledRetryReason: "transient_failure" }),
    ]);
    expect(s2.actions).toEqual([]);

    // Quota is back before the second retry fires; no human action follows.
    adapterState.mode = { kind: "success" };
    await sweep(new Date(Date.parse(reset) + 2 * 60_000));
    const s3 = await snapshot(companyId, issueId);
    log("A after run 3", s3);

    expect(adapterState.calls.map((call) => call.mode)).toEqual(["quota", "quota", "success"]);
    expect(s3.runs.at(-1)).toMatchObject({ status: "succeeded", scheduledRetryAttempt: 2 });
    expect(s3.issue.status).toBe("done");
    expect(s3.actions.filter((action) => action.ownerType === "board")).toEqual([]);
    expect(s3.interactions).toEqual([]);
  }, 60_000);

  it("B: after the 3rd consecutive quota failure the issue is handed to the board and never resumes by itself", async () => {
    const { companyId, agentId, issueId } = await seed();
    const reset = new Date(Date.now() + 10 * 60_000).toISOString();
    adapterState.mode = { kind: "quota", retryNotBefore: reset, bootstrapEvidence: true };

    await wakeAssigned(agentId, issueId);
    await sweep(new Date(Date.parse(reset) + 60_000));
    const s2 = await snapshot(companyId, issueId);
    expect(s2.actions).toEqual([]);
    expect(pendingRetries(s2)).toHaveLength(1);

    // Third failure = the retry with scheduledRetryAttempt 2.
    await sweep(new Date(Date.parse(reset) + 2 * 60_000));
    const s3 = await snapshot(companyId, issueId);
    log("B after run 3", s3);
    expect(failedRuns(s3).map((run) => run.scheduledRetryAttempt)).toEqual([0, 1, 2]);
    expect(pendingRetries(s3)).toEqual([]);
    expect(s3.actions).toEqual([
      {
        kind: "active_run_watchdog",
        ownerType: "board",
        status: "active",
        cause: "legacy_execution_requires_reconciliation",
      },
    ]);
    // Not the system-owned provider quota wait, and no quota monitor either.
    expect(s3.actions.some((action) => action.cause === "provider_quota")).toBe(false);
    expect(s3.issue.monitorNextCheckAt).toBeNull();
    expect(s3.issue.status).toBe("in_progress");
    expect(s3.issue.executionRunId).toBeNull();

    // Quota recovers (reset passed long ago, or topped up). Nobody touches it.
    adapterState.mode = { kind: "success" };
    const later = [
      Date.parse(reset) + 60 * 60_000, // +1h (default quota backoff)
      Date.parse(reset) + 24 * 60 * 60_000, // +1 day
      Date.parse(reset) + 8 * 24 * 60 * 60_000, // +8 days (beyond a weekly limit)
    ];
    for (const at of later) {
      const result = await sweep(new Date(at));
      expect(result.promoted).toBe(0);
      expect(result.reconciled.providerQuotaMonitored).toBe(0);
    }
    const sEnd = await snapshot(companyId, issueId);
    log("B after 8 days of sweeps", sEnd);
    expect(adapterState.calls.map((call) => call.mode)).toEqual(["quota", "quota", "quota"]);
    expect(sEnd.runs).toHaveLength(3);
    expect(sEnd.issue.status).toBe("in_progress");
    expect(sEnd.actions).toEqual(s3.actions);
  }, 60_000);

  it("C: with no reset time the retries use the 30s transient delay (not the 1h quota backoff) and then hand over to the board", async () => {
    const { companyId, agentId, issueId } = await seed();
    adapterState.mode = { kind: "quota", retryNotBefore: null, bootstrapEvidence: true };

    await wakeAssigned(agentId, issueId);
    const s1 = await snapshot(companyId, issueId);
    log("C after run 1", s1);
    const [firstFailed] = await db
      .select({ finishedAt: heartbeatRuns.finishedAt })
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, failedRuns(s1)[0]!.id));
    const [retry1] = pendingRetries(s1);
    expect(retry1).toMatchObject({ scheduledRetryAttempt: 1, scheduledRetryReason: "transient_failure" });
    const delayMs = Date.parse(retry1!.scheduledRetryAt!) - firstFailed!.finishedAt!.getTime();
    expect(delayMs).toBeGreaterThanOrEqual(25_000);
    expect(delayMs).toBeLessThanOrEqual(35_000);
    expect(s1.issue.monitorNextCheckAt).toBeNull();

    await sweep(new Date(Date.now() + 60_000));
    await sweep(new Date(Date.now() + 2 * 60_000));
    const s3 = await snapshot(companyId, issueId);
    log("C after run 3", s3);
    expect(failedRuns(s3)).toHaveLength(3);
    expect(pendingRetries(s3)).toEqual([]);
    expect(s3.actions).toEqual([
      expect.objectContaining({ ownerType: "board", cause: "legacy_execution_requires_reconciliation" }),
    ]);
    expect(s3.issue.monitorNextCheckAt).toBeNull();

    adapterState.mode = { kind: "success" };
    for (const hours of [1, 2, 24]) {
      expect((await sweep(new Date(Date.now() + hours * 60 * 60_000))).promoted).toBe(0);
    }
    const sEnd = await snapshot(companyId, issueId);
    expect(adapterState.calls).toHaveLength(3);
    expect(sEnd.issue.status).toBe("in_progress");
  }, 60_000);

  it("D: early top-up (reset 7 days away) is probed within 1 hour and resumes without anyone (quota wait cap)", async () => {
    const { companyId, agentId, issueId } = await seed();
    const reset = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    adapterState.mode = { kind: "quota", retryNotBefore: reset, bootstrapEvidence: true };

    const before = Date.now();
    await wakeAssigned(agentId, issueId);
    const s1 = await snapshot(companyId, issueId);
    const [retry1] = pendingRetries(s1);
    expect(retry1).toMatchObject({ scheduledRetryAttempt: 1, scheduledRetryReason: "transient_failure" });
    // capProviderQuotaWait: never later than 1h, far earlier than the 7-day reset
    expect(Date.parse(retry1!.scheduledRetryAt!) - before).toBeLessThanOrEqual(61 * 60_000);

    // Operator tops up right away.
    adapterState.mode = { kind: "success" };
    expect((await sweep(new Date(Date.now() + 60_000))).promoted).toBe(0);
    expect((await sweep(new Date(before + 61 * 60_000))).promoted).toBe(1);
    const sEnd = await snapshot(companyId, issueId);
    log("D end", sEnd);
    expect(adapterState.calls.map((call) => call.mode)).toEqual(["quota", "success"]);
    expect(sEnd.issue.status).toBe("done");
    expect(sEnd.actions).toEqual([]);
  }, 60_000);

  it("E: with the real claude/codex ACP quota result shape (no executionRecovery evidence) the FIRST quota failure goes to the board with zero retries", async () => {
    const { companyId, agentId, issueId } = await seed();
    const reset = new Date(Date.now() + 10 * 60_000).toISOString();
    adapterState.mode = { kind: "quota", retryNotBefore: reset, bootstrapEvidence: false };

    await wakeAssigned(agentId, issueId);
    const s1 = await snapshot(companyId, issueId);
    log("E after run 1", s1);
    expect(failedRuns(s1)).toHaveLength(1);
    expect(pendingRetries(s1)).toEqual([]);
    expect(s1.actions).toEqual([
      {
        kind: "active_run_watchdog",
        ownerType: "board",
        status: "active",
        cause: "legacy_execution_requires_reconciliation",
      },
    ]);
    expect(s1.issue.monitorNextCheckAt).toBeNull();

    adapterState.mode = { kind: "success" };
    for (const offsetMs of [60_000, 60 * 60_000, 24 * 60 * 60_000, 8 * 24 * 60 * 60_000]) {
      const result = await sweep(new Date(Date.parse(reset) + offsetMs));
      expect(result.promoted).toBe(0);
      expect(result.reconciled.providerQuotaMonitored).toBe(0);
    }
    const sEnd = await snapshot(companyId, issueId);
    expect(adapterState.calls.map((call) => call.mode)).toEqual(["quota"]);
    expect(sEnd.runs).toHaveLength(1);
    expect(sEnd.issue.status).toBe("in_progress");
  }, 60_000);
  // ---- F-I: production shape. Conversation adapters get
  // `conversationContinuation: "continue_conversation_v1"` stamped by heartbeat
  // finalize, which exempts them from legacy reconciliation
  // (legacy-execution-recovery.ts:25). This is what production runs carry.

  async function exhaustedRetryEventCount(runId: string) {
    const rows = await db
      .select({ message: heartbeatRunEvents.message })
      .from(heartbeatRunEvents)
      .where(eq(heartbeatRunEvents.runId, runId));
    return rows.filter((row) => (row.message ?? "").includes("Bounded retry exhausted")).length;
  }

  async function monitorWaits(issueId: string) {
    const rows = await db
      .select({ action: activityLog.action, details: activityLog.details, createdAt: activityLog.createdAt })
      .from(activityLog)
      .where(eq(activityLog.entityId, issueId))
      .orderBy(asc(activityLog.createdAt));
    return rows
      .filter((row) => row.action === "issue.monitor_scheduled")
      .map((row) => ({
        waitMs: Date.parse(String((row.details as Record<string, unknown>).nextCheckAt)) - row.createdAt.getTime(),
        parsedResetTime: (row.details as Record<string, unknown>).parsedResetTime,
      }));
  }

  function expectNoDuplicateRuns(snap: Awaited<ReturnType<typeof snapshot>>) {
    const successors = snap.runs.map((run) => run.retryOfRunId).filter((id): id is string => Boolean(id));
    expect(new Set(successors).size).toBe(successors.length);
    expect(snap.runs.filter((run) => ["scheduled_retry", "queued", "running"].includes(run.status)).length)
      .toBeLessThanOrEqual(1);
  }

  /**
   * Drives the production-shape loop: keep failing on quota, sweep every
   * `stepMs` of virtual time, until `waitRuns` runs have been started by the
   * provider-quota wait (i.e. beyond the 3 bounded-retry runs).
   */
  async function driveQuotaLoop(input: { companyId: string; issueId: string; startAt: number; stepMs: number; waitRuns: number }) {
    let at = input.startAt;
    for (let sweepIndex = 0; sweepIndex < 20; sweepIndex += 1) {
      at += input.stepMs;
      await sweep(new Date(at));
      const snap = await snapshot(input.companyId, input.issueId);
      expectNoDuplicateRuns(snap);
      expect(snap.actions).toEqual([]);
      expect(snap.interactions).toEqual([]);
      expect(snap.issue.status).toBe("in_progress");
      if (adapterState.calls.length >= 3 + input.waitRuns) return { at, snap };
    }
    throw new Error(`quota wait did not start ${input.waitRuns} runs; calls=${adapterState.calls.length}`);
  }

  it("F: production shape, quota with reset time: 2 bounded retries, then the quota wait really starts runs (loop), then resumes by itself", async () => {
    const { companyId, agentId, issueId } = await seed(CONVERSATION_ADAPTER);
    const reset = new Date(Date.now() + 10 * 60_000).toISOString();
    adapterState.mode = { kind: "quota", retryNotBefore: reset, bootstrapEvidence: false };

    await wakeAssigned(agentId, issueId);
    const s1 = await snapshot(companyId, issueId);
    expect(failedRuns(s1)[0]).toMatchObject({ conversationContinuation: "continue_conversation_v1", errorFamily: "provider_quota" });
    expect(pendingRetries(s1)).toEqual([
      expect.objectContaining({ scheduledRetryAttempt: 1, scheduledRetryReason: "transient_failure", scheduledRetryAt: reset }),
    ]);

    const { at, snap } = await driveQuotaLoop({ companyId, issueId, startAt: Date.parse(reset), stepMs: 60_000, waitRuns: 2 });
    log("F after 2 quota-wait runs", snap);
    // 3 bounded runs + at least 2 runs started by the quota wait, all quota-failed
    expect(failedRuns(snap).map((run) => run.scheduledRetryAttempt).slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
    const waits = await monitorWaits(issueId);
    log("F waits", waits);
    expect(waits.length).toBeGreaterThanOrEqual(2);
    for (const wait of waits) expect(wait.waitMs).toBeLessThanOrEqual(60 * 60_000 + 5_000);
    expect(snap.activity.filter((action) => action === "issue.monitor_triggered").length).toBeGreaterThanOrEqual(2);

    // Quota recovers; nobody acts.
    adapterState.mode = { kind: "success" };
    let end = snap;
    for (let step = 1; step <= 3 && end.issue.status !== "done"; step += 1) {
      await sweep(new Date(at + step * 61 * 60_000));
      end = await snapshot(companyId, issueId);
    }
    log("F end", end);
    expect(adapterState.calls.at(-1)?.mode).toBe("success");
    expect(adapterState.calls.filter((call) => call.mode === "success")).toHaveLength(1);
    expect(end.runs.at(-1)).toMatchObject({ status: "succeeded" });
    expect(end.issue.status).toBe("done");
    expect(end.actions).toEqual([]);
    expect(end.interactions).toEqual([]);
    expectNoDuplicateRuns(end);
  }, 180_000);

  it("G: production shape, quota without reset time: quota wait uses the 1h default, really starts runs every cycle, then resumes by itself", async () => {
    const { companyId, agentId, issueId } = await seed(CONVERSATION_ADAPTER);
    adapterState.mode = { kind: "quota", retryNotBefore: null, bootstrapEvidence: false };

    await wakeAssigned(agentId, issueId);
    const s1 = await snapshot(companyId, issueId);
    const [retry1] = pendingRetries(s1);
    expect(retry1).toMatchObject({ scheduledRetryAttempt: 1, scheduledRetryReason: "transient_failure" });
    expect(Date.parse(retry1!.scheduledRetryAt!) - Date.now()).toBeLessThanOrEqual(35_000);

    const { at, snap } = await driveQuotaLoop({ companyId, issueId, startAt: Date.now(), stepMs: 61 * 60_000, waitRuns: 2 });
    log("G after 2 quota-wait runs", snap);
    const waits = await monitorWaits(issueId);
    log("G waits", waits);
    expect(waits.length).toBeGreaterThanOrEqual(2);
    for (const wait of waits) {
      expect(wait.parsedResetTime).toBe(false);
      expect(wait.waitMs).toBeGreaterThanOrEqual(59 * 60_000);
      expect(wait.waitMs).toBeLessThanOrEqual(60 * 60_000 + 5_000);
    }

    adapterState.mode = { kind: "success" };
    let end = snap;
    for (let step = 1; step <= 3 && end.issue.status !== "done"; step += 1) {
      await sweep(new Date(at + step * 61 * 60_000));
      end = await snapshot(companyId, issueId);
    }
    log("G end", end);
    expect(adapterState.calls.at(-1)?.mode).toBe("success");
    expect(end.issue.status).toBe("done");
    expect(end.actions).toEqual([]);
    expect(end.interactions).toEqual([]);
    expectNoDuplicateRuns(end);
  }, 180_000);

  it("H: production shape, early top-up (reset 7 days away) resumes by itself within 1 hour", async () => {
    const { companyId, agentId, issueId } = await seed(CONVERSATION_ADAPTER);
    const reset = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    adapterState.mode = { kind: "quota", retryNotBefore: reset, bootstrapEvidence: false };
    const before = Date.now();
    await wakeAssigned(agentId, issueId);
    const [retry1] = pendingRetries(await snapshot(companyId, issueId));
    expect(Date.parse(retry1!.scheduledRetryAt!) - before).toBeLessThanOrEqual(61 * 60_000);

    adapterState.mode = { kind: "success" };
    expect((await sweep(new Date(Date.now() + 60_000))).promoted).toBe(0);
    expect((await sweep(new Date(before + 61 * 60_000))).promoted).toBe(1);
    const sEnd = await snapshot(companyId, issueId);
    log("H end", sEnd);
    expect(adapterState.calls.map((call) => call.mode)).toEqual(["quota", "success"]);
    expect(sEnd.issue.status).toBe("done");
    expect(sEnd.actions).toEqual([]);
  }, 120_000);

  it("F2: production shape, 7-day reset and quota keeps failing: every quota wait is capped at 1h and really starts a run; a top-up resumes by itself within ~61 minutes", async () => {
    const { companyId, agentId, issueId } = await seed(CONVERSATION_ADAPTER);
    const reset = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    adapterState.mode = { kind: "quota", retryNotBefore: reset, bootstrapEvidence: false };
    const before = Date.now();
    await wakeAssigned(agentId, issueId);
    const [retry1] = pendingRetries(await snapshot(companyId, issueId));
    expect(Date.parse(retry1!.scheduledRetryAt!) - before).toBeLessThanOrEqual(61 * 60_000);

    const { at, snap } = await driveQuotaLoop({ companyId, issueId, startAt: Date.now(), stepMs: 61 * 60_000, waitRuns: 2 });
    log("F2 after 2 quota-wait runs", snap);
    expect(failedRuns(snap).map((run) => run.scheduledRetryAttempt).slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
    const waits = await monitorWaits(issueId);
    log("F2 waits", waits);
    expect(waits.length).toBeGreaterThanOrEqual(2);
    for (const wait of waits) {
      expect(wait.parsedResetTime).toBe(true);
      expect(wait.waitMs).toBeLessThanOrEqual(60 * 60_000 + 5_000);
    }

    // Operator tops up now; nobody acts.
    adapterState.mode = { kind: "success" };
    await sweep(new Date(at + 61 * 60_000));
    let end = await snapshot(companyId, issueId);
    if (end.issue.status !== "done") {
      // a wait that fired in the last tick is promoted by the next scheduler pass
      await sweep(new Date(at + 62 * 60_000));
      end = await snapshot(companyId, issueId);
    }
    log("F2 end", end);
    expect(adapterState.calls.at(-1)?.mode).toBe("success");
    expect(adapterState.calls.filter((call) => call.mode === "success")).toHaveLength(1);
    expect(end.runs.at(-1)).toMatchObject({ status: "succeeded" });
    expect(end.issue.status).toBe("done");
    expect(end.actions).toEqual([]);
    expect(end.interactions).toEqual([]);
    expectNoDuplicateRuns(end);
  }, 180_000);

  it("I: production 09-25 shape (acpx_turn_failed, no errorFamily): 2 transient retries then stops silently until someone acts", async () => {
    const { companyId, agentId, issueId } = await seed(CONVERSATION_ADAPTER);
    adapterState.mode = { kind: "acpx_turn_failed" };
    await wakeAssigned(agentId, issueId);
    const s1 = await snapshot(companyId, issueId);
    expect(s1.runs[0]).toMatchObject({ status: "failed", errorCode: "acpx_turn_failed", errorFamily: null,
      conversationContinuation: "continue_conversation_v1" });
    expect(pendingRetries(s1)).toEqual([
      expect.objectContaining({ scheduledRetryAttempt: 1, scheduledRetryReason: "transient_failure" }),
    ]);
    await sweep(new Date(Date.now() + 60_000));
    await sweep(new Date(Date.now() + 2 * 60_000));
    const s3 = await snapshot(companyId, issueId);
    log("I after run 3", s3);
    expect(s3.runs.map((run) => [run.status, run.scheduledRetryAttempt])).toEqual([
      ["failed", 0], ["failed", 1], ["failed", 2],
    ]);

    adapterState.mode = { kind: "success" };
    for (const offsetMs of [3 * 60_000, 60 * 60_000, 24 * 60 * 60_000]) {
      const result = await sweep(new Date(Date.now() + offsetMs));
      expect(result.promoted).toBe(0);
      expect(result.reconciled.providerQuotaMonitored).toBe(0);
    }
    const sEnd = await snapshot(companyId, issueId);
    expect(adapterState.calls).toHaveLength(3);
    expect(sEnd.runs).toHaveLength(3);
    expect(sEnd.actions).toEqual([]);
    expect(sEnd.interactions).toEqual([]);
    expect(sEnd.issue.monitorNextCheckAt).toBeNull();
    expect(sEnd.issue.status).toBe("in_progress");
  }, 120_000);
  // ---- Operator "resume now" entries after an early top-up (production shape).

  type Entry = "comment" | "mention" | "retry_now" | "check_now";
  type Phase = "transient_wait" | "quota_monitor";

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

  /** Scheduler pass without the monitor tick. */
  async function sweepNoTick(now: Date) {
    const promotion = await heartbeat.promoteDueScheduledRetries(now);
    await heartbeat.resumeQueuedRuns();
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    const reconciled = await heartbeat.reconcileStrandedAssignedIssues();
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    return { promoted: promotion.promoted, reconciled };
  }

  async function preparePhase(phase: Phase) {
    const seeded = await seed(CONVERSATION_ADAPTER);
    const reset = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    adapterState.mode = { kind: "quota", retryNotBefore: reset, bootstrapEvidence: false };
    await wakeAssigned(seeded.agentId, seeded.issueId);
    if (phase === "quota_monitor") {
      let at = Date.now();
      for (let step = 1; step <= 2; step += 1) {
        at += 61 * 60_000;
        await sweepNoTick(new Date(at));
      }
    }
    return { ...seeded, reset };
  }

  async function fireEntry(entry: Entry, app: ReturnType<typeof routeApp>, input: { issueId: string; agentId: string }) {
    if (entry === "comment" || entry === "mention") {
      const body = entry === "mention"
        ? `[@QuotaSeat](agent://${input.agentId}) 额度已充值，请继续。`
        : "额度已充值，请继续。";
      return request(app).post(`/api/issues/${input.issueId}/comments`).send({ body });
    }
    if (entry === "retry_now") return request(app).post(`/api/issues/${input.issueId}/scheduled-retry/retry-now`).send({});
    return request(app).post(`/api/issues/${input.issueId}/monitor/check-now`).send({});
  }

  type EntryExpectation = {
    status: number;
    body?: Record<string, unknown>;
    // started a run within 5s with no scheduler pass at all
    selfStart: boolean;
    // started after exactly one scheduler pass (promote + resumeQueuedRuns + reconcile, clock +5s)
    startsAfterOneDispatch: boolean;
    // successful provider turns in total, after also sweeping +2h and +8d
    totalSuccessRuns: number;
    // for entries that only re-arm a timer: the new retry is due this far out
    retryDueAfterMs?: [number, number];
  };

  const RESUME_NOW_MATRIX: Array<[Phase, Entry, EntryExpectation]> = [
    ["transient_wait", "comment", { status: 201, selfStart: true, startsAfterOneDispatch: true, totalSuccessRuns: 1 }],
    ["transient_wait", "mention", { status: 201, selfStart: true, startsAfterOneDispatch: true, totalSuccessRuns: 1 }],
    ["transient_wait", "retry_now", { status: 200, body: { outcome: "promoted" }, selfStart: false, startsAfterOneDispatch: true, totalSuccessRuns: 1 }],
    ["transient_wait", "check_now", { status: 409, body: { error: "Issue has no scheduled monitor" }, selfStart: false, startsAfterOneDispatch: false, totalSuccessRuns: 1 }],
    ["quota_monitor", "comment", { status: 201, selfStart: true, startsAfterOneDispatch: true, totalSuccessRuns: 1 }],
    ["quota_monitor", "mention", { status: 201, selfStart: true, startsAfterOneDispatch: true, totalSuccessRuns: 1 }],
    ["quota_monitor", "retry_now", { status: 200, body: { outcome: "no_scheduled_retry" }, selfStart: false, startsAfterOneDispatch: false, totalSuccessRuns: 1 }],
    ["quota_monitor", "check_now", { status: 200, body: { ok: true }, selfStart: false, startsAfterOneDispatch: true, totalSuccessRuns: 1,
      retryDueAfterMs: [0, 1_000] }],
  ];

  it.each(RESUME_NOW_MATRIX)("resume-now after early top-up: phase=%s entry=%s", async (phase, entry, expected) => {
    const { companyId, agentId, issueId } = await preparePhase(phase);
    const before = await snapshot(companyId, issueId);
    if (phase === "transient_wait") {
      expect(pendingRetries(before)).toHaveLength(1);
      expect(before.issue.monitorNextCheckAt).toBeNull();
    } else {
      expect(failedRuns(before)).toHaveLength(3);
      expect(pendingRetries(before)).toEqual([]);
      expect(before.issue.monitorNextCheckAt).not.toBeNull();
    }
    const app = await boardAppFor(companyId);
    adapterState.mode = { kind: "success" };
    const callsBefore = adapterState.calls.length;
    const successCalls = () => adapterState.calls.slice(callsBefore).filter((call) => call.mode === "success").length;

    const firedAt = Date.now();
    const response = await fireEntry(entry, app, { issueId, agentId });
    log(`${phase}/${entry} response`, { status: response.status, body: response.body });
    expect(response.status).toBe(expected.status);
    if (expected.body) expect(response.body).toMatchObject(expected.body);

    // 1) no scheduler at all, up to 5s
    const pollStart = Date.now();
    while (Date.now() - pollStart < 5_000 && successCalls() === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await drainHeartbeatRunsToQuiescence(db, heartbeat);
    }
    const selfStarted = successCalls() > 0;
    const afterPoll = await snapshot(companyId, issueId);
    log(`${phase}/${entry} after 5s without scheduler`, { selfStarted, ms: Date.now() - firedAt, snap: afterPoll });
    expect(selfStarted).toBe(expected.selfStart);
    if (expected.retryDueAfterMs) {
      const [retry] = pendingRetries(afterPoll);
      const dueIn = Date.parse(retry!.scheduledRetryAt!) - firedAt;
      expect(dueIn).toBeGreaterThanOrEqual(expected.retryDueAfterMs[0]);
      expect(dueIn).toBeLessThanOrEqual(expected.retryDueAfterMs[1]);
    }

    // 2) one scheduler pass, clock +5s (production passes run every 30s)
    await sweepNoTick(new Date(Date.now() + 5_000));
    expect(successCalls() > 0).toBe(expected.startsAfterOneDispatch);

    // 3) leave it alone: does the original retry / monitor fire again later?
    for (const offsetMs of [2 * 60 * 60_000, 8 * 24 * 60 * 60_000]) await sweep(new Date(Date.now() + offsetMs));
    const end = await snapshot(companyId, issueId);
    log(`${phase}/${entry} end`, end);
    expect(end.issue.status).toBe("done");
    expect(successCalls()).toBe(expected.totalSuccessRuns);
    expect(end.runs.filter((run) => run.status === "succeeded")).toHaveLength(expected.totalSuccessRuns);
    expect(end.actions).toEqual([]);
    expect(end.interactions).toEqual([]);
    expect(end.runs.filter((run) => ["scheduled_retry", "queued", "running"].includes(run.status))).toEqual([]);
    if (phase === "transient_wait" && (entry === "comment" || entry === "mention")) {
      // the comment cancels the scheduled retry and its own wake is the only successor
      expect(end.runs.filter((run) => run.status === "succeeded").map((run) => run.wakeReason))
        .toEqual(["issue_commented"]);
      expect(end.runs.some((run) => run.wakeReason === "issue_continuation_needed")).toBe(false);
      expect(end.runs.filter((run) => run.status === "cancelled")).toHaveLength(1);
    }
  }, 180_000);

  it("J: when the quota wait fires on schedule, the retry it creates is due immediately (no second wait from the source run's retry-not-before)", async () => {
    const { companyId, issueId } = await preparePhase("quota_monitor");
    const armed = await snapshot(companyId, issueId);
    const monitorAt = new Date(armed.issue.monitorNextCheckAt!);
    const result = await heartbeat.tickTimers(monitorAt);
    expect(result.enqueued).toBe(1);
    const fired = await snapshot(companyId, issueId);
    log("J after monitor fired", fired);
    const [retry] = pendingRetries(fired);
    expect(retry).toMatchObject({ scheduledRetryAttempt: 3, scheduledRetryReason: "transient_failure" });
    const extraWait = Date.parse(retry!.scheduledRetryAt!) - monitorAt.getTime();
    expect(extraWait).toBe(0);
    // ...and the next scheduler pass at that instant starts it
    adapterState.mode = { kind: "success" };
    expect((await heartbeat.promoteDueScheduledRetries(monitorAt)).promoted).toBe(1);
    await heartbeat.resumeQueuedRuns();
    await drainHeartbeatRunsToQuiescence(db, heartbeat);
    expect((await snapshot(companyId, issueId)).issue.status).toBe("done");
  }, 120_000);
  // ---- Company-wide "quota is back, continue now" (POST provider-quota/resume-now)

  async function addSeatWithIssues(companyId: string, name: string, issueCount: number, firstNumber: number) {
    const agentId = randomUUID();
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name,
      role: "engineer",
      status: "idle",
      adapterType: CONVERSATION_ADAPTER,
      adapterConfig: {},
      runtimeConfig: { heartbeat: { wakeOnDemand: true, maxConcurrentRuns: 1 } },
      permissions: {},
    });
    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
    const issueIds: string[] = [];
    for (let index = 0; index < issueCount; index += 1) {
      const issueId = randomUUID();
      await db.insert(issues).values({
        id: issueId,
        companyId,
        title: `${name} quota work ${index + 1}`,
        status: "in_progress",
        priority: "medium",
        assigneeAgentId: agentId,
        issueNumber: firstNumber + index,
        identifier: `${company!.issuePrefix}-${firstNumber + index}`,
      });
      issueIds.push(issueId);
    }
    return { agentId, issueIds };
  }

  async function seedQuotaFleet() {
    const { companyId, agentId: seatA, issueId: a1 } = await seed(CONVERSATION_ADAPTER);
    const { agentId: seatB, issueIds: [b1, b2] } = await addSeatWithIssues(companyId, "QuotaSeatB", 2, 10);
    const reset = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    adapterState.mode = { kind: "quota", retryNotBefore: reset, bootstrapEvidence: false };
    // A1 and B1 go all the way to the provider-quota wait monitor (phase two).
    await wakeAssigned(seatA, a1);
    await wakeAssigned(seatB, b1!);
    let at = Date.now();
    for (let step = 1; step <= 2; step += 1) {
      at += 61 * 60_000;
      await sweepNoTick(new Date(at));
    }
    // A2 and B2 hit quota once and wait on a scheduled retry (phase one).
    const { issueIds: [a2] } = await (async () => {
      const issueId = randomUUID();
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      await db.insert(issues).values({
        id: issueId, companyId, title: "QuotaSeat quota work 2", status: "in_progress", priority: "medium",
        assigneeAgentId: seatA, issueNumber: 20, identifier: `${company!.issuePrefix}-20`,
      });
      return { issueIds: [issueId] };
    })();
    await wakeAssigned(seatA, a2!);
    await wakeAssigned(seatB, b2!);
    return { companyId, seatA, seatB, phaseTwo: [a1, b1!], phaseOne: [a2!, b2!], all: [a1, a2!, b1!, b2!] };
  }

  async function issueStatuses(issueIds: string[]) {
    const rows = await db.select({ id: issues.id, status: issues.status, monitorNextCheckAt: issues.monitorNextCheckAt }).from(issues);
    return Object.fromEntries(rows.filter((row) => issueIds.includes(row.id)).map((row) => [row.id, row]));
  }

  it("K: company resume-now releases every quota-parked issue across seats and both phases, immediately, idempotently, one run per seat at a time", async () => {
    const fleet = await seedQuotaFleet();
    const app = await boardAppFor(fleet.companyId);

    // Read-only count used by the dashboard banner.
    const listed = await request(app).get(`/api/companies/${fleet.companyId}/provider-quota/waits`);
    expect(listed.status).toBe(200);
    expect(listed.body.count).toBe(4);
    const kinds = Object.fromEntries((listed.body.waits as Array<{ issueId: string; kind: string }>).map((wait) => [wait.issueId, wait.kind]));
    for (const issueId of fleet.phaseOne) expect(kinds[issueId]).toBe("scheduled_retry");
    for (const issueId of fleet.phaseTwo) expect(kinds[issueId]).toBe("quota_monitor");

    // Operator topped up; one click, no scheduler pass, clock not advanced.
    adapterState.mode = { kind: "success" };
    const callsBefore = adapterState.calls.length;
    const firstClick = await request(app).post(`/api/companies/${fleet.companyId}/provider-quota/resume-now`).send({});
    log("K first click", firstClick.body);
    expect(firstClick.status).toBe(200);
    const outcomes = Object.fromEntries((firstClick.body.results as Array<{ issueId: string; outcome: string; phase: string }>)
      .map((item) => [item.issueId, `${item.phase}:${item.outcome}`]));
    expect(outcomes).toEqual({
      [fleet.phaseOne[0]!]: "scheduled_retry:released",
      [fleet.phaseOne[1]!]: "scheduled_retry:released",
      [fleet.phaseTwo[0]!]: "quota_monitor:released",
      [fleet.phaseTwo[1]!]: "quota_monitor:released",
    });

    // Repeated clicks while the work runs: nothing new is released.
    const secondClick = await request(app).post(`/api/companies/${fleet.companyId}/provider-quota/resume-now`).send({});
    expect(secondClick.status).toBe(200);
    expect((secondClick.body.results as Array<{ outcome: string }>).filter((item) => item.outcome === "released")).toEqual([]);

    // Wait for the seats to work through their queues on their own (no scheduler pass).
    const deadline = Date.now() + 20_000;
    let statuses = await issueStatuses(fleet.all);
    while (Date.now() < deadline && Object.values(statuses).some((row) => row.status !== "done")) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await drainHeartbeatRunsToQuiescence(db, heartbeat);
      statuses = await issueStatuses(fleet.all);
    }
    log("K statuses after click", statuses);
    log("K calls after click", adapterState.calls.slice(callsBefore));
    for (const issueId of fleet.all) expect(statuses[issueId]!.status).toBe("done");

    // One-seat-one-window: never two turns at once on the same seat.
    expect(adapterState.maxInFlight.get(fleet.seatA)).toBe(1);
    expect(adapterState.maxInFlight.get(fleet.seatB)).toBe(1);

    // Later scheduler passes and an extra click add nothing: exactly one success turn per issue.
    const thirdClick = await request(app).post(`/api/companies/${fleet.companyId}/provider-quota/resume-now`).send({});
    expect(thirdClick.body.results).toEqual([]);
    for (const offsetMs of [2 * 60 * 60_000, 8 * 24 * 60 * 60_000]) await sweep(new Date(Date.now() + offsetMs));
    const successByIssue = adapterState.calls.slice(callsBefore).filter((call) => call.mode === "success")
      .map((call) => call.issueId).sort();
    expect(successByIssue).toEqual([...fleet.all].sort());
    const [recoveryActions, interactions] = await Promise.all([
      db.select().from(issueRecoveryActions),
      db.select().from(issueThreadInteractions),
    ]);
    expect(recoveryActions).toEqual([]);
    expect(interactions).toEqual([]);
    const after = await request(app).get(`/api/companies/${fleet.companyId}/provider-quota/waits`);
    expect(after.body.count).toBe(0);

    const activity = await db.select().from(activityLog).where(eq(activityLog.action, "company.provider_quota_resume_now"));
    expect(activity).toHaveLength(3);
  }, 180_000);

  it("K2: resume-now clears a provider-quota wait monitor left behind on a finished issue", async () => {
    const { companyId, agentId, issueId } = await preparePhase("quota_monitor");
    const app = await boardAppFor(companyId);
    adapterState.mode = { kind: "success" };
    // The seat finishes through another path (a board comment wake).
    await request(app).post(`/api/issues/${issueId}/comments`).send({ body: "继续" });
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && (await snapshot(companyId, issueId)).issue.status !== "done") {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await drainHeartbeatRunsToQuiescence(db, heartbeat);
    }
    const leftover = await snapshot(companyId, issueId);
    expect(leftover.issue.status).toBe("done");
    expect(leftover.issue.monitorNextCheckAt).not.toBeNull();
    const listed = await request(app).get(`/api/companies/${companyId}/provider-quota/waits`);
    expect(listed.body.count).toBe(0);

    const click = await request(app).post(`/api/companies/${companyId}/provider-quota/resume-now`).send({});
    expect(click.body.results).toEqual([
      expect.objectContaining({ issueId, agentId, phase: "stale_monitor", outcome: "stale_monitor_cleared" }),
    ]);
    expect((await snapshot(companyId, issueId)).issue.monitorNextCheckAt).toBeNull();
    expect(adapterState.calls.filter((call) => call.mode === "success")).toHaveLength(1);
  }, 120_000);
  it("L: TOK-226 built-in adapter shape (quota only as prose in errorMessage) is classified as provider_quota on the FIRST failure and not relaunched within the hour", async () => {
    const { companyId, agentId, issueId } = await seed("opencode_local");
    // Same wording as TOK-226, with a reset instant kept in the future.
    const resetAt = new Date(Math.floor((Date.now() + 5 * 60 * 60_000) / 1000) * 1000);
    const cst = new Date(resetAt.getTime() + 8 * 60 * 60_000).toISOString().replace("T", " ").slice(0, 19);
    const message = `You have exceeded the 5-hour usage quota. It will reset at ${cst} +0800 CST. We recommend upgrading your plan for higher limits.`;
    adapterState.mode = { kind: "prose_quota", message };

    await wakeAssigned(agentId, issueId);
    const [firstRun] = await db.select().from(heartbeatRuns)
      .where(and(eq(heartbeatRuns.companyId, companyId), isNull(heartbeatRuns.retryOfRunId)));
    const resultJson = firstRun!.resultJson as Record<string, unknown>;
    log("L first run", { errorCode: firstRun!.errorCode, resultJson });
    expect(firstRun).toMatchObject({ status: "failed", errorCode: "adapter_failed", error: message });
    expect(resultJson.errorFamily).toBe("provider_quota");
    expect(resultJson.retryNotBefore).toBe(resetAt.toISOString());
    expect(resultJson.providerQuotaRetryNotBefore).toBe(resetAt.toISOString());

    const s1 = await snapshot(companyId, issueId);
    const [retry1] = pendingRetries(s1);
    expect(retry1).toMatchObject({ scheduledRetryAttempt: 1, scheduledRetryReason: "transient_failure" });
    const delayMs = Date.parse(retry1!.scheduledRetryAt!) - firstRun!.finishedAt!.getTime();
    expect(delayMs).toBeGreaterThanOrEqual(59 * 60_000); // not the 30s transient delay
    expect(delayMs).toBeLessThanOrEqual(61 * 60_000); // capped, not the 5h reset

    for (const offsetMs of [30_000, 60_000, 30 * 60_000, 58 * 60_000]) {
      expect((await sweep(new Date(Date.now() + offsetMs))).promoted).toBe(0);
    }
    expect(adapterState.calls).toHaveLength(1);
    const sEnd = await snapshot(companyId, issueId);
    expect(sEnd.actions).toEqual([]);
    expect(sEnd.issue.status).toBe("in_progress");
  }, 120_000);
});
