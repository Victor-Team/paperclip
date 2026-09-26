/**
 * How many of the newest loaded comments the chat-style task thread renders
 * on open, and how many more each "Load earlier comments" reveals.
 *
 * A long task keeps hundreds of comments and runs. Rendering every loaded
 * comment — plus each run's transcript and every resource card around them —
 * built ~20k DOM nodes and read hundreds of run logs on open. The thread shows
 * only this window; earlier comments that are already loaded are revealed
 * before another page is fetched.
 */
export const TASK_CHAT_RENDER_WINDOW = 30;
export const TASK_CHAT_RENDER_WINDOW_STEP = 30;

/**
 * Picks the newest `size` comments (input is oldest-first). A linked comment
 * (`#comment-<id>`) that is loaded but older than the window widens the window
 * back to it, so jumping to it still finds it on the page.
 */
export function selectRenderedComments<T extends { id: string }>(
  comments: readonly T[],
  size: number,
  pinnedCommentId?: string | null,
): { rendered: readonly T[]; hiddenCount: number } {
  if (comments.length <= size) return { rendered: comments, hiddenCount: 0 };
  let start = comments.length - Math.max(0, size);
  if (pinnedCommentId) {
    const pinnedIndex = comments.findIndex((comment) => comment.id === pinnedCommentId);
    if (pinnedIndex >= 0 && pinnedIndex < start) start = pinnedIndex;
  }
  return { rendered: comments.slice(start), hiddenCount: start };
}
