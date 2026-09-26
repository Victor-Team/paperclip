// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { SETTLED_RUN_LOG_GC_MS, useLiveRunTranscripts } from "./useLiveRunTranscripts";
import { TRANSCRIPT_REQUEST_TIMEOUT_MS } from "./read-transcript-request";

const { useQueryMock, logMock, buildTranscriptMock, queryCache, queryDefaults } = vi.hoisted(() => ({
  queryCache: new Map<string, unknown>(),
  queryDefaults: new Map<string, unknown>(),
  useQueryMock: vi.fn(() => ({ data: { censorUsernameInLogs: false } })),
  logMock: vi.fn(async () => ({ runId: "run-1", store: "memory", logRef: "log-1", content: "", nextOffset: 0 })),
  buildTranscriptMock: vi.fn((chunks: unknown[]) => chunks),
}));

const fakeQueryClient = {
  getQueryData: (key: readonly unknown[]) => queryCache.get(JSON.stringify(key)),
  setQueryData: (key: readonly unknown[], value: unknown) => {
    queryCache.set(JSON.stringify(key), value);
    return value;
  },
  setQueryDefaults: (key: readonly unknown[], options: unknown) => {
    queryDefaults.set(JSON.stringify(key), options);
  },
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
  useQueryClient: () => fakeQueryClient,
}));

vi.mock("../../api/instanceSettings", () => ({
  instanceSettingsApi: {
    getGeneral: vi.fn(),
  },
}));

vi.mock("../../api/heartbeats", () => ({
  heartbeatsApi: {
    log: logMock,
  },
}));

vi.mock("../../adapters", () => ({
  buildTranscript: buildTranscriptMock,
  getUIAdapter: () => null,
  onAdapterChange: () => () => {},
}));

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  closeCalls: Array<{ code?: number; reason?: string }> = [];

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close(code?: number, reason?: string) {
    this.closeCalls.push({ code, reason });
    this.readyState = FakeWebSocket.CLOSING;
  }

  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  triggerClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close"));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("useLiveRunTranscripts", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    FakeWebSocket.instances = [];
    queryCache.clear();
    queryDefaults.clear();
    useQueryMock.mockClear();
    logMock.mockReset();
    logMock.mockImplementation(async () => ({ runId: "run-1", store: "memory", logRef: "log-1", content: "", nextOffset: 0 }));
    buildTranscriptMock.mockClear();
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("pauses hidden-tab reads and resumes at the retained log offset", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    // The log's current end is at 42: a read below it reports the next page.
    (logMock as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_runId: string, offset: number) =>
      offset < 42
        ? { runId: "run-1", store: "memory", logRef: "log-1", content: "", nextOffset: 42 }
        : { runId: "run-1", store: "memory", logRef: "log-1", content: "" },
    );
    const runs = [{ id: "run-1", status: "running", adapterType: "codex_local" }];
    function Harness() {
      useLiveRunTranscripts({ companyId: "company-1", runs, enableRealtimeUpdates: false });
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => root.render(<Harness />));
      await act(async () => vi.advanceTimersByTimeAsync(10_000));
      expect(logMock).not.toHaveBeenCalled();
      expect(FakeWebSocket.instances).toHaveLength(0);
      await act(async () => {
        visibility.mockReturnValue("visible");
        document.dispatchEvent(new Event("visibilitychange"));
      });
      // The first page and the read on to the log's current end.
      expect(logMock).toHaveBeenCalledTimes(2);
      await act(async () => {
        visibility.mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await act(async () => vi.advanceTimersByTimeAsync(10_000));
      expect(logMock).toHaveBeenCalledTimes(2);
      await act(async () => {
        visibility.mockReturnValue("visible");
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(logMock).toHaveBeenLastCalledWith("run-1", 42, 256_000, expect.anything());
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("waits for a connecting socket to open before closing it during cleanup", async () => {
    function Harness() {
      useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-1", status: "running", adapterType: "codex_local" }],
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    const socket = FakeWebSocket.instances[0];
    expect(socket.closeCalls).toHaveLength(0);

    act(() => {
      root.unmount();
    });

    expect(socket.closeCalls).toHaveLength(0);

    act(() => {
      socket.triggerOpen();
    });

    expect(socket.closeCalls).toEqual([{ code: 1000, reason: "live_run_transcripts_unmount" }]);
    container.remove();
  });

  it("treats stored run output as available before transcript chunks finish loading", async () => {
    let latestHasOutput = false;

    function Harness() {
      const { hasOutputForRun } = useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-1", status: "succeeded", adapterType: "codex_local", hasStoredOutput: true }],
      });
      latestHasOutput = hasOutputForRun("run-1");
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(latestHasOutput).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("reports initial hydration until the first persisted-log read completes", async () => {
    let latestIsInitialHydrating = false;
    type RunLogResult = { runId: string; store: string; logRef: string; content: string; nextOffset: number };
    let resolveLog: ((value: RunLogResult | PromiseLike<RunLogResult>) => void) | null = null;
    logMock.mockImplementationOnce(
      () =>
        new Promise<RunLogResult>((resolve) => {
          resolveLog = resolve;
        }),
    );

    function Harness() {
      const { isInitialHydrating } = useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-1", status: "succeeded", adapterType: "codex_local" }],
      });
      latestIsInitialHydrating = isInitialHydrating;
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(latestIsInitialHydrating).toBe(true);

    await act(async () => {
      resolveLog?.({ runId: "run-1", store: "memory", logRef: "log-1", content: "", nextOffset: 0 });
      await Promise.resolve();
    });

    expect(latestIsInitialHydrating).toBe(false);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("releases stalled log hydration and permits a fresh retry without accepting late data", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const root = createRoot(container);
    let latest!: ReturnType<typeof useLiveRunTranscripts>;
    let resolveLate!: (result: Awaited<ReturnType<typeof logMock>>) => void;
    const empty = { runId: "run-1", store: "memory", logRef: "log-1", content: "", nextOffset: 0 };
    logMock.mockImplementationOnce(() => new Promise((resolve) => { resolveLate = resolve; }));
    function Harness() {
      latest = useLiveRunTranscripts({ companyId: "company-1", runs: [{ id: "run-1", status: "succeeded", adapterType: "codex_local" }] });
      return null;
    }
    try {
      await act(async () => { root.render(<Harness />); });
      expect(latest.isInitialHydrating).toBe(true);
      await act(async () => { await vi.advanceTimersByTimeAsync(TRANSCRIPT_REQUEST_TIMEOUT_MS); });
      expect(latest.isInitialHydrating).toBe(false);
      expect(latest.errorsByRun.get("run-1")?.message).toContain("too long");
      await act(async () => { resolveLate(empty); });
      expect(latest.errorsByRun.has("run-1")).toBe(true);
      logMock.mockResolvedValue(empty);
      await act(async () => { latest.retry(); });
      expect(latest.errorsByRun.size).toBe(0);
      expect(logMock).toHaveBeenCalledTimes(2);
    } finally {
      act(() => root.unmount());
      vi.useRealTimers();
    }
  });

  it("stops retrying terminal runs whose persisted log never existed", async () => {
    logMock.mockReset();
    logMock.mockRejectedValue(new ApiError("Run log not found", 404, { error: "Run log not found" }));

    function Harness() {
      useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-404", status: "failed", adapterType: "codex_local" }],
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(logMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(logMock).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does not request persisted logs until a queued run starts", async () => {
    function Harness({ status }: { status: "queued" | "running" }) {
      useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-queued", status, adapterType: "codex_local" }],
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness status="queued" />);
      await Promise.resolve();
    });

    expect(logMock).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances).toHaveLength(0);

    await act(async () => {
      root.render(<Harness status="running" />);
      await Promise.resolve();
    });

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith("run-queued", 0, 256_000, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("can hydrate active runs without opening the live event socket", async () => {
    function Harness() {
      useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-1", status: "running", adapterType: "codex_local" }],
        enableRealtimeUpdates: false,
        logReadLimitBytes: 64_000,
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(logMock).toHaveBeenCalledWith("run-1", 0, 64_000, expect.objectContaining({ signal: expect.any(AbortSignal) }));

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("starts persisted-log hydration from the newest bytes when the visible window is truncated", async () => {
    function Harness() {
      useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-1", status: "running", adapterType: "codex_local", lastOutputBytes: 100_000 }],
        enableRealtimeUpdates: false,
        logReadLimitBytes: 64_000,
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(logMock).toHaveBeenCalledWith("run-1", 36_000, 64_000, expect.objectContaining({ signal: expect.any(AbortSignal) }));

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps identical same-timestamp log records that carry distinct seq values", async () => {
    const ts = "2026-04-20T00:00:00.000Z";
    const tokenRow = (seq: number) =>
      JSON.stringify({ ts, stream: "stdout", chunk: '{"type":"acpx.text_delta","text":" the"}\n', seq });
    logMock.mockImplementationOnce(async () => ({
      runId: "run-1",
      store: "memory",
      logRef: "log-1",
      content: `${tokenRow(1)}\n${tokenRow(2)}\n${tokenRow(3)}\n`,
      nextOffset: 300,
    }));

    function Harness() {
      useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-1", status: "running", adapterType: "gemini_local" }],
        enableRealtimeUpdates: false,
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    const lastCall = buildTranscriptMock.mock.calls.at(-1) as unknown[] | undefined;
    expect(lastCall?.[0]).toEqual([
      { ts, stream: "stdout", chunk: '{"type":"acpx.text_delta","text":" the"}\n', seq: 1 },
      { ts, stream: "stdout", chunk: '{"type":"acpx.text_delta","text":" the"}\n', seq: 2 },
      { ts, stream: "stdout", chunk: '{"type":"acpx.text_delta","text":" the"}\n', seq: 3 },
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps repeated unsequenced structured text deltas instead of content-deduping tokens", async () => {
    const ts = "2026-04-20T00:00:00.000Z";
    const tokenRow = JSON.stringify({
      ts,
      stream: "stdout",
      chunk: '{"type":"acpx.text_delta","text":" the"}\n',
    });
    logMock.mockImplementationOnce(async () => ({
      runId: "run-1",
      store: "memory",
      logRef: "log-1",
      content: `${tokenRow}\n${tokenRow}\n${tokenRow}\n`,
      nextOffset: 300,
    }));

    function Harness() {
      useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-1", status: "running", adapterType: "gemini_local" }],
        enableRealtimeUpdates: false,
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    const lastCall = buildTranscriptMock.mock.calls.at(-1) as unknown[] | undefined;
    expect(lastCall?.[0]).toEqual([
      { ts, stream: "stdout", chunk: '{"type":"acpx.text_delta","text":" the"}\n', seq: undefined },
      { ts, stream: "stdout", chunk: '{"type":"acpx.text_delta","text":" the"}\n', seq: undefined },
      { ts, stream: "stdout", chunk: '{"type":"acpx.text_delta","text":" the"}\n', seq: undefined },
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("orders and dedupes sequenced chunks across websocket and persisted-log delivery", async () => {
    type RunLogResult = { runId: string; store: string; logRef: string; content: string; nextOffset: number };
    let resolveLog: ((value: RunLogResult) => void) | null = null;
    logMock.mockImplementationOnce(
      () =>
        new Promise<RunLogResult>((resolve) => {
          resolveLog = resolve;
        }),
    );

    function Harness() {
      useLiveRunTranscripts({
        companyId: "company-1",
        runs: [{ id: "run-1", status: "running", adapterType: "gemini_local" }],
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    const socket = FakeWebSocket.instances[0]!;

    const sendLogEvent = (seq: number, chunk: string) => {
      socket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            companyId: "company-1",
            type: "heartbeat.run.log",
            createdAt: "2026-04-20T00:00:01.000Z",
            payload: {
              runId: "run-1",
              ts: "2026-04-20T00:00:01.000Z",
              stream: "stdout",
              chunk,
              seq,
            },
          }),
        }),
      );
    };

    // The websocket races ahead of the poller and its seq-2 chunk arrives
    // tail-truncated.
    await act(async () => {
      sendLogEvent(2, "rld\n");
      sendLogEvent(3, "!\n");
      await Promise.resolve();
    });

    const persistedRow = (seq: number, chunk: string) =>
      JSON.stringify({ ts: "2026-04-20T00:00:00.500Z", stream: "stdout", chunk, seq });
    await act(async () => {
      resolveLog?.({
        runId: "run-1",
        store: "memory",
        logRef: "log-1",
        content: `${persistedRow(1, "hello\n")}\n${persistedRow(2, "world\n")}\n${persistedRow(3, "!\n")}\n`,
        nextOffset: 300,
      });
      await Promise.resolve();
    });

    const lastCall = buildTranscriptMock.mock.calls.at(-1) as unknown[] | undefined;
    expect(lastCall?.[0]).toEqual([
      { ts: "2026-04-20T00:00:00.500Z", stream: "stdout", chunk: "hello\n", seq: 1 },
      { ts: "2026-04-20T00:00:00.500Z", stream: "stdout", chunk: "world\n", seq: 2 },
      { ts: "2026-04-20T00:00:01.000Z", stream: "stdout", chunk: "!\n", seq: 3 },
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("rebuilds only the transcript for the run that receives live output", async () => {
    function Harness() {
      useLiveRunTranscripts({
        companyId: "company-1",
        runs: [
          { id: "run-1", status: "running", adapterType: "codex_local" },
          { id: "run-2", status: "running", adapterType: "codex_local" },
        ],
      });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(buildTranscriptMock).toHaveBeenCalledTimes(2);
    buildTranscriptMock.mockClear();

    await act(async () => {
      FakeWebSocket.instances[0]!.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            companyId: "company-1",
            type: "heartbeat.run.log",
            createdAt: "2026-04-20T00:00:00.000Z",
            payload: {
              runId: "run-1",
              ts: "2026-04-20T00:00:00.000Z",
              stream: "stdout",
              chunk: "hello from run 1\n",
            },
          }),
        }),
      );
      await Promise.resolve();
    });

    expect(buildTranscriptMock).toHaveBeenCalledTimes(1);
    expect(buildTranscriptMock).toHaveBeenCalledWith(
      [{ ts: "2026-04-20T00:00:00.000Z", stream: "stdout", chunk: "hello from run 1\n" }],
      null,
      { censorUsernameInLogs: false },
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("retains an accumulated buffer through a transient empty poll (PAP-462 B3)", async () => {
    const ts = "2026-08-08T00:00:00.000Z";
    const row = JSON.stringify({
      ts,
      stream: "stdout",
      chunk: '{"type":"acpx.text_delta","text":"hello"}\n',
      seq: 1,
    });
    // Serve the buffered chunk on the FIRST persisted-log read only; every later
    // read (including after the run reappears) returns nothing new. So the chunk
    // can only be present the second time if the buffer survived the gap.
    logMock.mockResolvedValue({ runId: "run-1", store: "memory", logRef: "log-1", content: "", nextOffset: 100 });
    logMock.mockResolvedValueOnce({ runId: "run-1", store: "memory", logRef: "log-1", content: `${row}\n`, nextOffset: 100 });

    const captured: { value: ReturnType<typeof useLiveRunTranscripts> | null } = { value: null };
    function Harness({ runs }: { runs: Array<{ id: string; status: string; adapterType: string }> }) {
      captured.value = useLiveRunTranscripts({ companyId: "company-1", runs, enableRealtimeUpdates: false });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const runList = [{ id: "run-1", status: "running", adapterType: "gemini_local" }];

    await act(async () => {
      root.render(<Harness runs={runList} />);
      await Promise.resolve();
    });
    expect(captured.value?.transcriptByRun.get("run-1")).toHaveLength(1);

    // Transient empty poll: run momentarily absent from the list.
    await act(async () => {
      root.render(<Harness runs={[]} />);
      await Promise.resolve();
    });

    // Run reappears within the grace window — the buffer must survive rather than
    // re-hydrate from a (now empty) truncated read.
    await act(async () => {
      root.render(<Harness runs={runList} />);
      await Promise.resolve();
    });
    expect(captured.value?.transcriptByRun.get("run-1")).toHaveLength(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("prunes a buffer once a run stays absent past the grace window (PAP-462 B3)", async () => {
    vi.useFakeTimers();
    try {
      const ts = "2026-08-08T00:00:00.000Z";
      const row = JSON.stringify({
        ts,
        stream: "stdout",
        chunk: '{"type":"acpx.text_delta","text":"hello"}\n',
        seq: 1,
      });
      logMock.mockResolvedValue({ runId: "run-1", store: "memory", logRef: "log-1", content: "", nextOffset: 100 });
      logMock.mockResolvedValueOnce({ runId: "run-1", store: "memory", logRef: "log-1", content: `${row}\n`, nextOffset: 100 });

      const captured: { value: ReturnType<typeof useLiveRunTranscripts> | null } = { value: null };
      function Harness({ runs }: { runs: Array<{ id: string; status: string; adapterType: string }> }) {
        captured.value = useLiveRunTranscripts({ companyId: "company-1", runs, enableRealtimeUpdates: false });
        return null;
      }

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      const runList = [{ id: "run-1", status: "running", adapterType: "gemini_local" }];

      await act(async () => {
        root.render(<Harness runs={runList} />);
        await Promise.resolve();
      });
      expect(captured.value?.transcriptByRun.get("run-1")).toHaveLength(1);

      await act(async () => {
        root.render(<Harness runs={[]} />);
        await Promise.resolve();
      });

      // Stay absent long enough for the grace window to lapse and the deferred
      // prune to fire.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(25_000);
      });

      // On reappear the buffer is gone, so the (now empty) read rebuilds nothing.
      await act(async () => {
        root.render(<Harness runs={runList} />);
        await Promise.resolve();
      });
      expect(captured.value?.transcriptByRun.get("run-1") ?? []).toHaveLength(0);

      act(() => {
        root.unmount();
      });
      container.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps HTTP log polling when the socket constructor fails and retries later", async () => {
    vi.useFakeTimers();
    globalThis.WebSocket = class {
      constructor() { throw new TypeError("WebSocket is not a constructor"); }
    } as unknown as typeof WebSocket;
    const runs = [{ id: "run-1", status: "running", adapterType: "codex_local" }];
    function Harness() {
      useLiveRunTranscripts({ companyId: "company-1", runs });
      return null;
    }
    const root = createRoot(document.createElement("div"));
    try {
      await act(async () => root.render(<Harness />));
      expect(logMock).toHaveBeenCalledTimes(1);
      await act(async () => vi.advanceTimersByTimeAsync(30_000));
      expect(logMock.mock.calls.length).toBeGreaterThan(1);
      globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
      await act(async () => vi.advanceTimersByTimeAsync(15_000));
      expect(FakeWebSocket.instances).toHaveLength(1);
      await act(async () => FakeWebSocket.instances[0].triggerOpen());
      // Cleanup must not depend on the global constructor remaining available.
      globalThis.WebSocket = undefined as unknown as typeof WebSocket;
    } finally {
      await act(async () => root.unmount());
    }
    const calls = logMock.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(logMock).toHaveBeenCalledTimes(calls);
    expect(FakeWebSocket.instances[0].closeCalls).toHaveLength(1);
  });

  it("backs off exponentially when the live event socket keeps failing", async () => {
    vi.useFakeTimers();
    try {
      function Harness({ lastOutputBytes }: { lastOutputBytes?: number }) {
        useLiveRunTranscripts({
          companyId: "company-1",
          runs: [{ id: "run-1", status: "running", adapterType: "codex_local", lastOutputBytes }],
        });
        return null;
      }

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<Harness />);
        await Promise.resolve();
      });
      expect(FakeWebSocket.instances).toHaveLength(1);

      // Cold backend: every handshake fails. Delays must grow 1.5s → 3s → 6s
      // instead of hammering a flat interval.
      await act(async () => {
        FakeWebSocket.instances[0].triggerClose();
        await vi.advanceTimersByTimeAsync(1_499);
      });
      expect(FakeWebSocket.instances).toHaveLength(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(FakeWebSocket.instances).toHaveLength(2);

      await act(async () => {
        FakeWebSocket.instances[1].triggerClose();
        await vi.advanceTimersByTimeAsync(2_999);
      });
      expect(FakeWebSocket.instances).toHaveLength(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(FakeWebSocket.instances).toHaveLength(3);

      await act(async () => {
        FakeWebSocket.instances[2].triggerClose();
        await vi.advanceTimersByTimeAsync(5_999);
      });
      expect(FakeWebSocket.instances).toHaveLength(3);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(FakeWebSocket.instances).toHaveLength(4);

      // Run-metadata changes restart the socket effect; the progressed delay
      // must survive the restart instead of resetting to the base delay.
      await act(async () => {
        root.render(<Harness lastOutputBytes={512} />);
        await Promise.resolve();
      });
      expect(FakeWebSocket.instances).toHaveLength(5);
      await act(async () => {
        FakeWebSocket.instances[4].triggerClose();
        await vi.advanceTimersByTimeAsync(11_999);
      });
      expect(FakeWebSocket.instances).toHaveLength(5);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(FakeWebSocket.instances).toHaveLength(6);

      // A successful connection resets the backoff to the base delay.
      await act(async () => {
        FakeWebSocket.instances[5].triggerOpen();
        FakeWebSocket.instances[5].triggerClose();
        await vi.advanceTimersByTimeAsync(1_500);
      });
      expect(FakeWebSocket.instances).toHaveLength(7);

      act(() => {
        root.unmount();
      });
      container.remove();
    } finally {
      vi.useRealTimers();
    }
  });
  describe("settled run logs", () => {
    // Untyped view of the shared log mock: these cases vary content per run id.
    const log = logMock as unknown as ReturnType<typeof vi.fn>;
    type HookResult = ReturnType<typeof useLiveRunTranscripts>;
    function renderHookHarness() {
      const latest: { current: HookResult | null } = { current: null };
      function Harness({ runs }: { runs: Parameters<typeof useLiveRunTranscripts>[0]["runs"] }) {
        latest.current = useLiveRunTranscripts({ companyId: "company-1", runs, enableRealtimeUpdates: false });
        return null;
      }
      return { Harness, latest };
    }
    const settledLog = (runId: string) => ({
      runId,
      store: "memory",
      logRef: `log-${runId}`,
      content: `${JSON.stringify({ ts: "2026-01-01T00:00:00.000Z", stream: "stdout", chunk: `done ${runId}` })}\n`,
    });

    it("reads a settled run once and does not re-read it when a live run's byte counters tick", async () => {
      log.mockImplementation(async (runId: string) =>
        runId === "live" ? { ...settledLog("live"), content: "", nextOffset: 0 } : settledLog(runId),
      );
      const { Harness } = renderHookHarness();
      const root = createRoot(document.createElement("div"));
      try {
        await act(async () =>
          root.render(<Harness runs={[
            { id: "old", status: "succeeded", adapterType: "codex_local", logBytes: 10 },
            { id: "live", status: "running", adapterType: "codex_local", lastOutputBytes: 1 },
          ]} />),
        );
        const callsFor = (runId: string) => log.mock.calls.filter((call) => call[0] === runId).length;
        expect(callsFor("old")).toBe(1);
        expect(callsFor("live")).toBe(1);
        for (const bytes of [2, 3, 4]) {
          await act(async () =>
            root.render(<Harness runs={[
              { id: "old", status: "succeeded", adapterType: "codex_local", logBytes: 10 },
              { id: "live", status: "running", adapterType: "codex_local", lastOutputBytes: bytes },
            ]} />),
          );
        }
        expect(callsFor("old")).toBe(1);
        expect(callsFor("live")).toBe(1);
        // A status change still restarts reads, but the settled run stays read.
        await act(async () =>
          root.render(<Harness runs={[
            { id: "old", status: "succeeded", adapterType: "codex_local", logBytes: 10 },
            { id: "live", status: "succeeded", adapterType: "codex_local", lastOutputBytes: 4 },
          ]} />),
        );
        expect(callsFor("old")).toBe(1);
        expect(callsFor("live")).toBe(2);
      } finally {
        await act(async () => root.unmount());
      }
    });

    it("reuses a settled run's log after the thread remounts instead of downloading it again", async () => {
      log.mockImplementation(async (runId: string) => settledLog(runId));
      const runs = [{ id: "old", status: "succeeded", adapterType: "codex_local", logBytes: 10 }];
      const first = renderHookHarness();
      const rootA = createRoot(document.createElement("div"));
      await act(async () => rootA.render(<first.Harness runs={runs} />));
      expect(log).toHaveBeenCalledTimes(1);
      const firstTranscript = first.latest.current!.transcriptByRun.get("old");
      expect(firstTranscript?.length).toBe(1);
      await act(async () => rootA.unmount());

      const second = renderHookHarness();
      const rootB = createRoot(document.createElement("div"));
      try {
        await act(async () => rootB.render(<second.Harness runs={runs} />));
        expect(log).toHaveBeenCalledTimes(1);
        expect(second.latest.current!.hydratedRunIds.has("old")).toBe(true);
        expect(second.latest.current!.isInitialHydrating).toBe(false);
        expect(second.latest.current!.transcriptByRun.get("old")).toEqual(firstTranscript);
        // Kept for the session's return visits, not the client's default five minutes.
        expect(queryDefaults.get(JSON.stringify(["run-log-settled"]))).toEqual({ gcTime: SETTLED_RUN_LOG_GC_MS });
        expect(SETTLED_RUN_LOG_GC_MS).toBeGreaterThanOrEqual(30 * 60_000);
      } finally {
        await act(async () => rootB.unmount());
      }
    });

    it("keeps reading a settled run until the log reports no further offset", async () => {
      log
        .mockImplementationOnce(async () => ({ ...settledLog("old"), nextOffset: 100 }))
        .mockImplementationOnce(async () => settledLog("old"));
      const { Harness } = renderHookHarness();
      const root = createRoot(document.createElement("div"));
      try {
        await act(async () =>
          root.render(<Harness runs={[{ id: "old", status: "succeeded", adapterType: "codex_local" }]} />),
        );
        expect(log).toHaveBeenCalledTimes(2);
        expect(log.mock.calls[1][1]).toBe(100);
      } finally {
        await act(async () => root.unmount());
      }
    });

    it("reads a running run on to the log's current end when the first page stops short", async () => {
      log.mockImplementation(async (runId: string, offset: number) =>
        offset < 200 ? { ...settledLog(runId), nextOffset: offset + 100 } : { ...settledLog(runId), content: "" },
      );
      const { Harness } = renderHookHarness();
      const root = createRoot(document.createElement("div"));
      try {
        await act(async () =>
          root.render(<Harness runs={[{ id: "live", status: "running", adapterType: "codex_local" }]} />),
        );
        expect(log.mock.calls.map((call) => call[1])).toEqual([0, 100, 200]);
      } finally {
        await act(async () => root.unmount());
      }
    });

    it("sends no further reads for a running run at its end until the slow fallback poll; live output arrives over the socket", async () => {
      vi.useFakeTimers();
      log.mockImplementation(async (runId: string) => ({ ...settledLog(runId), content: "" }));
      const latest: { current: HookResult | null } = { current: null };
      function LiveHarness({ bytes }: { bytes: number }) {
        latest.current = useLiveRunTranscripts({
          companyId: "company-1",
          runs: [{ id: "live", status: "running", adapterType: "codex_local", lastOutputBytes: bytes }],
        });
        return null;
      }
      const root = createRoot(document.createElement("div"));
      try {
        await act(async () => root.render(<LiveHarness bytes={1} />));
        expect(log).toHaveBeenCalledTimes(1);
        for (const bytes of [2, 3, 4]) {
          await act(async () => root.render(<LiveHarness bytes={bytes} />));
        }
        await act(async () => vi.advanceTimersByTimeAsync(29_000));
        expect(log).toHaveBeenCalledTimes(1);
        const socket = FakeWebSocket.instances.at(-1)!;
        await act(async () => {
          socket.triggerOpen();
          socket.onmessage?.(
            new MessageEvent("message", {
              data: JSON.stringify({
                companyId: "company-1",
                type: "heartbeat.run.log",
                createdAt: "2026-04-20T00:00:00.000Z",
                payload: { runId: "live", ts: "2026-04-20T00:00:00.000Z", stream: "stdout", chunk: "new output\n" },
              }),
            }),
          );
        });
        expect(log).toHaveBeenCalledTimes(1);
        expect(buildTranscriptMock).toHaveBeenLastCalledWith(
          [expect.objectContaining({ chunk: "new output\n" })],
          null,
          { censorUsernameInLogs: false },
        );
      } finally {
        await act(async () => root.unmount());
        vi.useRealTimers();
      }
    });
  });
});
