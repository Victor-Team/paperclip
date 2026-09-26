// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INPUT_QUIET_MS, whenInputIdle } from "./whenInputIdle";

describe("whenInputIdle", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("runs once input has been quiet for the quiet period", () => {
    const callback = vi.fn();
    whenInputIdle(callback);
    vi.advanceTimersByTime(INPUT_QUIET_MS - 1);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(INPUT_QUIET_MS * 4);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting while wheel, scroll or key input continues", () => {
    const callback = vi.fn();
    whenInputIdle(callback);
    for (const type of ["wheel", "scroll", "keydown", "wheel", "touchmove", "pointerdown"]) {
      vi.advanceTimersByTime(INPUT_QUIET_MS - 100);
      window.dispatchEvent(new Event(type));
    }
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(INPUT_QUIET_MS + 10);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("never runs after cancel and stops listening", () => {
    const callback = vi.fn();
    const remove = vi.spyOn(window, "removeEventListener");
    const cancel = whenInputIdle(callback);
    vi.advanceTimersByTime(INPUT_QUIET_MS / 2);
    cancel();
    vi.advanceTimersByTime(INPUT_QUIET_MS * 4);
    expect(callback).not.toHaveBeenCalled();
    expect(remove.mock.calls.some(([type]) => type === "wheel")).toBe(true);
  });

  it("hands the work to an idle callback when the browser offers one", () => {
    const callback = vi.fn();
    const idle = vi.fn((run: () => void) => { setTimeout(run, 200); return 7; });
    vi.stubGlobal("requestIdleCallback", idle);
    whenInputIdle(callback);
    vi.advanceTimersByTime(INPUT_QUIET_MS + 10);
    expect(idle).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
