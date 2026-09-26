/**
 * Runs `callback` once the user has stopped scrolling/typing for `quietMs` and
 * the main thread is idle. Heavy optional work (the live WebGL character:
 * chunk import, context creation, shader compile) started right as a page
 * opened landed exactly when people start to scroll, holding the first scroll
 * back by one or two long tasks.
 *
 * Returns a cancel function; after cancel the callback never runs.
 */
export const INPUT_QUIET_MS = 500;
export const INPUT_IDLE_TIMEOUT_MS = 1000;
const INPUT_EVENTS = ["wheel", "scroll", "touchmove", "keydown", "pointerdown"] as const;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function whenInputIdle(
  callback: () => void,
  { quietMs = INPUT_QUIET_MS, idleTimeoutMs = INPUT_IDLE_TIMEOUT_MS } = {},
): () => void {
  const win = window as IdleWindow;
  let quietTimer: number | null = null;
  let idleHandle: number | null = null;
  let done = false;
  const listenerOptions = { capture: true, passive: true } as const;
  const stopListening = () => {
    for (const type of INPUT_EVENTS) win.removeEventListener(type, arm, listenerOptions);
  };
  const run = () => {
    idleHandle = null;
    if (done) return;
    done = true;
    callback();
  };
  const settle = () => {
    quietTimer = null;
    stopListening();
    if (win.requestIdleCallback) idleHandle = win.requestIdleCallback(run, { timeout: idleTimeoutMs });
    else idleHandle = win.setTimeout(run, 0);
  };
  function arm() {
    if (quietTimer !== null) win.clearTimeout(quietTimer);
    quietTimer = win.setTimeout(settle, quietMs);
  }
  for (const type of INPUT_EVENTS) win.addEventListener(type, arm, listenerOptions);
  arm();
  return () => {
    done = true;
    stopListening();
    if (quietTimer !== null) win.clearTimeout(quietTimer);
    if (idleHandle !== null) {
      if (win.cancelIdleCallback) win.cancelIdleCallback(idleHandle);
      else win.clearTimeout(idleHandle);
    }
  };
}
