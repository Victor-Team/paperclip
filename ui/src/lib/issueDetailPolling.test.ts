import { describe, expect, it } from "vitest";
import {
  EMAIL_THREAD_ACTIVE_POLL_MS,
  EMAIL_THREAD_IDLE_POLL_MS,
  ISSUE_LIVE_RUNS_ACTIVE_POLL_MS,
  ISSUE_LIVE_RUNS_IDLE_POLL_MS,
  emailThreadRefetchInterval,
  issueLiveRunsRefetchInterval,
} from "./issueDetailPolling";

describe("open-task fallback polling", () => {
  it("polls live runs slowly, and slowest when nothing is running or queued", () => {
    expect(ISSUE_LIVE_RUNS_ACTIVE_POLL_MS).toBeGreaterThanOrEqual(10_000);
    expect(ISSUE_LIVE_RUNS_IDLE_POLL_MS).toBeGreaterThanOrEqual(30_000);
    expect(issueLiveRunsRefetchInterval(undefined)).toBe(ISSUE_LIVE_RUNS_IDLE_POLL_MS);
    expect(issueLiveRunsRefetchInterval([])).toBe(ISSUE_LIVE_RUNS_IDLE_POLL_MS);
    expect(issueLiveRunsRefetchInterval([{ status: "succeeded" }])).toBe(ISSUE_LIVE_RUNS_IDLE_POLL_MS);
    expect(issueLiveRunsRefetchInterval([{ status: "running" }])).toBe(ISSUE_LIVE_RUNS_ACTIVE_POLL_MS);
    expect(issueLiveRunsRefetchInterval([{ status: "queued" }])).toBe(ISSUE_LIVE_RUNS_ACTIVE_POLL_MS);
  });

  it("polls the email thread quickly only for a task that has mail", () => {
    expect(emailThreadRefetchInterval(undefined)).toBe(EMAIL_THREAD_IDLE_POLL_MS);
    expect(emailThreadRefetchInterval({ messages: [], publications: [] })).toBe(EMAIL_THREAD_IDLE_POLL_MS);
    expect(emailThreadRefetchInterval({ messages: [{}], publications: [] })).toBe(EMAIL_THREAD_ACTIVE_POLL_MS);
    expect(emailThreadRefetchInterval({ messages: [], publications: [{}] })).toBe(EMAIL_THREAD_ACTIVE_POLL_MS);
    expect(EMAIL_THREAD_IDLE_POLL_MS).toBeGreaterThan(EMAIL_THREAD_ACTIVE_POLL_MS);
  });
});
