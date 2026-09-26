import { describe, expect, it } from "vitest";
import type { LiveRunForIssue } from "../api/heartbeats";
import type { IssueChatLinkedRun } from "./issue-chat-messages";
import {
  filterRunsToLoadedCommentWindow,
  MAX_ISSUE_CHAT_TRANSCRIPT_RUNS,
  resolveIssueChatTranscriptRuns,
} from "./issueChatTranscriptRuns";

function linkedRun(n: number, isoDate: string): IssueChatLinkedRun {
  return {
    runId: `run-${n}`,
    status: "succeeded",
    agentId: "agent-1",
    adapterType: "codex_local",
    createdAt: isoDate,
    startedAt: isoDate,
    finishedAt: isoDate,
    hasStoredOutput: true,
  } as IssueChatLinkedRun;
}

describe("resolveIssueChatTranscriptRuns", () => {
  it("uses adapterType from linked runs without requiring agent metadata", () => {
    const runs = resolveIssueChatTranscriptRuns({
      linkedRuns: [
        {
          runId: "run-1",
          status: "succeeded",
          agentId: "agent-1",
          adapterType: "codex_local",
          createdAt: "2026-04-09T12:00:00.000Z",
          startedAt: "2026-04-09T12:00:00.000Z",
          finishedAt: "2026-04-09T12:01:00.000Z",
          hasStoredOutput: true,
        },
      ],
    });

    expect(runs).toEqual([
      {
        id: "run-1",
        status: "succeeded",
        adapterType: "codex_local",
        hasStoredOutput: true,
      },
    ]);
  });

  it("caps linked runs to the limit, keeping the most recent by createdAt", () => {
    // 30 runs, run-0 oldest … run-29 newest.
    const linkedRuns = Array.from({ length: 30 }, (_, i) =>
      linkedRun(i, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()),
    );

    const runs = resolveIssueChatTranscriptRuns({ linkedRuns });

    expect(runs.length).toBe(MAX_ISSUE_CHAT_TRANSCRIPT_RUNS);
    // Newest run retained, oldest dropped.
    const ids = runs.map((r) => r.id);
    expect(ids).toContain("run-29");
    expect(ids).not.toContain("run-0");
  });

  it("respects a custom limit", () => {
    const linkedRuns = Array.from({ length: 10 }, (_, i) =>
      linkedRun(i, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()),
    );

    const runs = resolveIssueChatTranscriptRuns({ linkedRuns, limit: 3 });

    expect(runs.length).toBe(3);
    expect(runs.map((r) => r.id)).toEqual(["run-9", "run-8", "run-7"]);
  });

  it("always retains live/active runs even beyond the limit", () => {
    const linkedRuns = Array.from({ length: 25 }, (_, i) =>
      linkedRun(i, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()),
    );
    const liveRuns = [
      { id: "live-1", status: "running", adapterType: "claude_local", logBytes: null, lastOutputBytes: 10 },
    ] as unknown as LiveRunForIssue[];

    const runs = resolveIssueChatTranscriptRuns({ linkedRuns, liveRuns, limit: 5 });

    const ids = runs.map((r) => r.id);
    // The live run is always present; linked runs fill the remaining slots.
    expect(ids).toContain("live-1");
    expect(runs.length).toBe(5);
  });
});

describe("filterRunsToLoadedCommentWindow", () => {
  const minute = (n: number) => new Date(Date.UTC(2026, 8, 25, 0, n)).toISOString();
  // 400 finished runs, one per minute; the loaded page holds the newest 50 comments.
  const history = Array.from({ length: 400 }, (_, n) => ({ ...linkedRun(n, minute(n)) }));
  const loadedComments = Array.from({ length: 50 }, (_, n) => ({
    id: `comment-${n}`,
    createdAt: minute(350 + n),
  }));

  it("keeps only runs inside the loaded comment window while older comments remain", () => {
    const kept = filterRunsToLoadedCommentWindow(history, loadedComments, true);
    expect(kept.map((run) => run.runId)).toEqual(
      Array.from({ length: 50 }, (_, n) => `run-${350 + n}`),
    );
  });

  it("passes every run through once all comments are loaded", () => {
    expect(filterRunsToLoadedCommentWindow(history, loadedComments, false)).toBe(history);
  });

  it("keeps older runs that are unfinished or tied to a loaded comment", () => {
    const older = [
      { ...linkedRun(1, minute(1)), status: "running" },
      { ...linkedRun(2, minute(2)) },
      { ...linkedRun(3, minute(3)), wakeCommentIds: ["comment-0"] },
      { ...linkedRun(4, minute(4)) },
    ];
    const comments = [
      { ...loadedComments[0] },
      { id: "comment-x", createdAt: minute(360), createdByRunId: "run-2" },
    ];
    expect(
      filterRunsToLoadedCommentWindow(older, comments, true).map((run) => run.runId),
    ).toEqual(["run-1", "run-2", "run-3"]);
  });
});

describe("filterRunsToLoadedCommentWindow before the first comment page arrives", () => {
  it("keeps only unfinished runs while comments are still loading", () => {
    const runs = [
      { ...linkedRun(1, "2026-09-25T00:01:00.000Z") },
      { ...linkedRun(2, "2026-09-25T00:02:00.000Z"), status: "queued" },
    ];
    expect(filterRunsToLoadedCommentWindow(runs, [], true).map((run) => run.runId)).toEqual(["run-2"]);
  });
});
