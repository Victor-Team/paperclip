/**
 * Fallback poll intervals for an open task.
 *
 * Run lifecycle, run output, issue activity and comments already arrive over
 * the live-updates socket (LiveUpdatesProvider patches and invalidates these
 * queries for the visible task). Polling only has to catch what a missed or
 * unmatched event leaves behind, so it stays slow — and slower still when the
 * task has nothing running. The previous one-second polls made an idle,
 * finished task issue ~60 requests a minute and a running one ~200.
 */
export const ISSUE_LIVE_RUNS_ACTIVE_POLL_MS = 10_000;
export const ISSUE_LIVE_RUNS_IDLE_POLL_MS = 30_000;
export const ISSUE_ACTIVE_RUN_POLL_MS = 10_000;
export const ISSUE_RUNS_FALLBACK_POLL_MS = 15_000;
export const ISSUE_QUEUED_COMMENTS_POLL_MS = 10_000;
export const EMAIL_THREAD_ACTIVE_POLL_MS = 10_000;
export const EMAIL_THREAD_IDLE_POLL_MS = 60_000;

export function issueLiveRunsRefetchInterval(
  runs: ReadonlyArray<{ status: string }> | undefined,
): number {
  return runs?.some((run) => run.status === "running" || run.status === "queued")
    ? ISSUE_LIVE_RUNS_ACTIVE_POLL_MS
    : ISSUE_LIVE_RUNS_IDLE_POLL_MS;
}

/**
 * An email-backed task (messages or unsent publications) keeps the quicker
 * poll; every other task only checks now and then whether mail has arrived.
 */
export function emailThreadRefetchInterval(
  thread:
    | { messages?: ReadonlyArray<unknown> | null; publications?: ReadonlyArray<unknown> | null }
    | null
    | undefined,
): number {
  return (thread?.messages?.length ?? 0) > 0 || (thread?.publications?.length ?? 0) > 0
    ? EMAIL_THREAD_ACTIVE_POLL_MS
    : EMAIL_THREAD_IDLE_POLL_MS;
}
