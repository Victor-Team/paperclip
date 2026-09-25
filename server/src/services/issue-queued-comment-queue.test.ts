import { describe, expect, it } from "vitest";
import {
  buildQueuedCommentQueueSnapshot,
  decideQueuedCommentQueueSteering,
  queuedCommentIdsFromRunContext,
  queuedCommentIdsFromWakePayload,
} from "./issue-queued-comment-queue.js";

describe("decideQueuedCommentQueueSteering", () => {
  it("answers unsupported on the legacy protocol", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "deferred",
      queueRunRuntimeMode: null,
      activeRun: { id: "run-1", runtimeMode: "legacy" },
      assignedAgentAdapterType: "codex_local",
      queuedCommentCount: 1,
    });

    expect(decision).toEqual({ protocol: "legacy", kind: "unsupported" });
  });

  it("answers temporarily_unavailable for a promoted native queue with no deferred run", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "queued",
      queueRunRuntimeMode: "native",
      activeRun: null,
      assignedAgentAdapterType: "paperclip_runner",
      queuedCommentCount: 1,
    });

    expect(decision).toEqual({ protocol: "paperclip_runner_v1", kind: "temporarily_unavailable" });
  });

  it("answers temporarily_unavailable when the queue holds no live comments", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "deferred",
      queueRunRuntimeMode: null,
      activeRun: { id: "run-1", runtimeMode: "native" },
      assignedAgentAdapterType: "paperclip_runner",
      queuedCommentCount: 0,
    });

    expect(decision).toEqual({ protocol: "paperclip_runner_v1", kind: "temporarily_unavailable" });
  });

  it("tells the caller it may probe a running deferred turn on the native protocol", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "deferred",
      queueRunRuntimeMode: null,
      activeRun: { id: "run-1", runtimeMode: "native" },
      assignedAgentAdapterType: "paperclip_runner",
      queuedCommentCount: 1,
    });

    expect(decision).toEqual({ protocol: "paperclip_runner_v1", kind: "probe", steeringRunId: "run-1" });
  });

  // Acceptance-criterion fact pattern: a deferred queue whose active run
  // has not resolved a runtime mode yet, for an agent on the
  // `paperclip_runner` adapter. The protocol resolves to
  // `paperclip_runner_v1` through the adapter-type fallback, and the
  // decision hands the run to the caller to probe live — it never answers
  // the flat "unsupported" value a duplicated, unshared rule can drift to.
  it("resolves the protocol through the adapter-type fallback and asks the caller to probe", () => {
    const decision = decideQueuedCommentQueueSteering({
      state: "deferred",
      queueRunRuntimeMode: null,
      activeRun: { id: "run-1", runtimeMode: null },
      assignedAgentAdapterType: "paperclip_runner",
      queuedCommentCount: 1,
    });

    expect(decision).toEqual({ protocol: "paperclip_runner_v1", kind: "probe", steeringRunId: "run-1" });
  });
});

describe("buildQueuedCommentQueueSnapshot entry permissions", () => {
  const baseFacts = {
    issueId: "issue-1",
    queueId: "queue-1",
    state: "queued" as const,
    activeRunId: null,
    protocol: "legacy" as const,
    steeringDisposition: "unsupported" as const,
  };

  it("grants edit and discard to the user who authored the queued comment", () => {
    const queue = buildQueuedCommentQueueSnapshot({
      ...baseFacts,
      actorType: "user",
      actorId: "user-1",
      comments: [{ id: "comment-1", updatedAt: new Date(), authorUserId: "user-1" }],
    });

    expect(queue.entries[0]?.canEdit).toBe(true);
    expect(queue.entries[0]?.canDiscard).toBe(true);
  });

  it("denies edit and discard to a user who did not author the queued comment", () => {
    const queue = buildQueuedCommentQueueSnapshot({
      ...baseFacts,
      actorType: "user",
      actorId: "user-1",
      comments: [{ id: "comment-1", updatedAt: new Date(), authorUserId: "user-2" }],
    });

    expect(queue.entries[0]?.canEdit).toBe(false);
    expect(queue.entries[0]?.canDiscard).toBe(false);
  });

  it("denies edit and discard to an agent actor even when the comment carries a matching author id", () => {
    const queue = buildQueuedCommentQueueSnapshot({
      ...baseFacts,
      actorType: "agent",
      actorId: "user-1",
      comments: [{ id: "comment-1", updatedAt: new Date(), authorUserId: "user-1" }],
    });

    expect(queue.entries[0]?.canEdit).toBe(false);
    expect(queue.entries[0]?.canDiscard).toBe(false);
  });
});

describe("queued comment id extraction drops malformed ids", () => {
  // Regression for a live outage: a truncated comment id ("0422d095") sat in one
  // wake payload and took down every query that read this queue, because each
  // caller passes these ids straight to `inArray(issueComments.id, ...)` and
  // Postgres fails the whole statement on the first malformed uuid. One bad id
  // must never cost the good ones their dispatch.
  const good = "18a18072-3e89-4c1b-b622-934af641bf62";
  const alsoGood = "b2652bf9-ca3f-48c6-97e9-4bc7ce9e5c76";
  const truncated = "0422d095";

  it("keeps the well-formed ids in a wake payload and drops the truncated one", () => {
    const ids = queuedCommentIdsFromWakePayload({
      _paperclipWakeContext: { wakeCommentIds: [truncated, good, alsoGood] },
    });
    expect(ids).toEqual([good, alsoGood]);
  });

  it("returns an empty list when a wake payload holds nothing but a malformed id", () => {
    const ids = queuedCommentIdsFromWakePayload({
      _paperclipWakeContext: { wakeCommentIds: [truncated] },
    });
    expect(ids).toEqual([]);
  });

  it("applies the same guard to ids read back from a run context", () => {
    const ids = queuedCommentIdsFromRunContext({ wakeCommentIds: [good, truncated] });
    expect(ids).toEqual([good]);
  });

  it("still drops duplicates and non-strings alongside the malformed ids", () => {
    const ids = queuedCommentIdsFromWakePayload({
      _paperclipWakeContext: { wakeCommentIds: [good, good, null, "", truncated, alsoGood] },
    });
    expect(ids).toEqual([good, alsoGood]);
  });
});
