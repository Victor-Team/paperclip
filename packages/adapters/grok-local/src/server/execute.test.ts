import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

// Bundles the remote-lane mock state and every mocked execution-target
// function behind one hoisted object, so the `vi.mock` factory below (which
// runs before the top-level `import`s) can close over it. `state.isRemote`
// lets a test force the remote lane on; `state.prepareRuntimeResult` lets a
// test override what `prepareAdapterExecutionTargetRuntime` hands back
// (`workspaceRemoteDir` / `assetDirs`) without a fresh `vi.mock` per case.
const mocks = vi.hoisted(() => {
  const state: {
    isRemote: boolean;
    prepareRuntimeResult: { workspaceRemoteDir?: string | null; assetDirs?: Record<string, string> } | null;
  } = { isRemote: false, prepareRuntimeResult: null };
  return {
    state,
    ensureRuntimeInstalledMock: vi.fn(async () => {}),
    ensureCommandMock: vi.fn(async () => {}),
    resolveCommandForLogsMock: vi.fn(async () => "grok"),
    runProcessMock: vi.fn(),
    prepareRuntimeMock: vi.fn(
      async (input: { assets?: Array<{ key: string; localDir: string; followSymlinks?: boolean }> }) => {
        const override = state.prepareRuntimeResult;
        const assetDirs =
          override?.assetDirs ??
          Object.fromEntries(
            (input.assets ?? []).map((asset) => [asset.key, `/remote/workspace/.paperclip-runtime/grok/${asset.key}`]),
          );
        const workspaceRemoteDir = override && "workspaceRemoteDir" in override
          ? override.workspaceRemoteDir
          : "/remote/workspace";
        return { workspaceRemoteDir, assetDirs, restoreWorkspace: async () => {} };
      },
    ),
  };
});

const {
  state: remoteState,
  ensureRuntimeInstalledMock,
  ensureCommandMock,
  resolveCommandForLogsMock,
  runProcessMock,
  prepareRuntimeMock,
} = mocks;

vi.mock("@paperclipai/adapter-utils/execution-target", () => ({
  adapterExecutionTargetIsRemote: () => mocks.state.isRemote,
  adapterExecutionTargetRemoteCwd: (_target: unknown, cwd: string) =>
    mocks.state.isRemote ? "/remote/workspace" : cwd,
  overrideAdapterExecutionTargetRemoteCwd: (target: unknown, _cwd: string) => target,
  adapterExecutionTargetSessionIdentity: () => ({ kind: mocks.state.isRemote ? "remote" : "local" }),
  adapterExecutionTargetSessionMatches: () => true,
  describeAdapterExecutionTarget: () => (mocks.state.isRemote ? "remote" : "local"),
  ensureAdapterExecutionTargetCommandResolvable: (...args: unknown[]) =>
    (mocks.ensureCommandMock as (...args: unknown[]) => unknown)(...args),
  ensureAdapterExecutionTargetRuntimeCommandInstalled: (...args: unknown[]) =>
    (mocks.ensureRuntimeInstalledMock as (...args: unknown[]) => unknown)(...args),
  prepareAdapterExecutionTargetRuntime: (...args: unknown[]) =>
    (mocks.prepareRuntimeMock as (...args: unknown[]) => unknown)(...args),
  readAdapterExecutionTarget: () =>
    mocks.state.isRemote ? { kind: "remote", transport: "ssh" } : { kind: "local" },
  resolveAdapterExecutionTargetCommandForLogs: (...args: unknown[]) =>
    (mocks.resolveCommandForLogsMock as (...args: unknown[]) => unknown)(...args),
  resolveAdapterExecutionTargetTimeoutSec: (_target: unknown, timeoutSec: number) => timeoutSec,
  runAdapterExecutionTargetProcess: (...args: unknown[]) =>
    (mocks.runProcessMock as (...args: unknown[]) => unknown)(...args),
}));

import { execute, GROK_RULES_ARG_MAX_BYTES, readGrokInstructionsRules } from "./execute.js";
import { resolveManagedGrokHomeDir } from "./grok-home.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-grok-local-"));
  tempRoots.push(root);
  return root;
}

async function pathExists(candidate: string): Promise<boolean> {
  return fs.access(candidate).then(() => true).catch(() => false);
}

const GROK_IDENTITY = "https://auth.x.ai::11111111-1111-1111-1111-111111111111";
const NOW = Date.now();
const NEWER_EXPIRY = new Date(NOW + 2 * 60_000).toISOString();
const OLDER_EXPIRY = new Date(NOW + 60_000).toISOString();

function grokAuth(input: { key: string; expiresAt: string }): string {
  return JSON.stringify({
    [GROK_IDENTITY]: { key: input.key, refresh_token: `${input.key}-refresh`, expires_at: input.expiresAt },
  });
}

// Captures the sandbox `auth.json` bytes a mocked remote teardown hands back
// to the `home` asset's `restore` contribution — mirrors the sandbox core's
// own restore closure without needing a live sandbox. `error`, when set, makes
// the injected `readFile` reject instead of resolving.
const sandboxAuthFixture: { bytes: Buffer | null; error: (Error & { code?: string }) | null } = {
  bytes: null,
  error: null,
};

function makeRestoreWorkspace(
  assets: Array<{ restore?: (ctx: { assetDir: string; readFile: (path: string) => Promise<Buffer> }) => Promise<void> }>,
) {
  return async () => {
    for (const asset of assets) {
      if (!asset.restore) continue;
      await asset.restore({
        assetDir: "/remote/workspace/.paperclip-runtime/grok/home",
        readFile: async () => {
          if (sandboxAuthFixture.error) throw sandboxAuthFixture.error;
          if (sandboxAuthFixture.bytes === null) {
            throw Object.assign(new Error("ENOENT: no such file or directory, open 'auth.json'"), { code: "ENOENT" });
          }
          return sandboxAuthFixture.bytes;
        },
      });
    }
  };
}

function makeSuccessfulRunResult(overrides: Partial<{ sessionId: string }> = {}) {
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    stdout: JSON.stringify({
      type: "end",
      stopReason: "EndTurn",
      sessionId: overrides.sessionId ?? "sess-1",
      requestId: "req-1",
    }),
    stderr: "",
  };
}

async function makeCtx(runId: string, cwd: string): Promise<AdapterExecutionContext> {
  return {
    runId,
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Grok Agent",
      adapterType: "grok_local",
      adapterConfig: {},
    },
    runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
    config: { cwd },
    context: {},
    authToken: "run-token",
    onLog: async () => {},
  };
}

describe("grok_local execute", () => {
  it.each(["grok-4.7", "grok-4.6"])("forwards the explicit %s model and xhigh effort", async (model) => {
    const root = await makeTempRoot();
    const ctx = await makeCtx("model-selection", root);
    ctx.config = { cwd: root, model, reasoningEffort: "xhigh" };
    runProcessMock.mockResolvedValue(makeSuccessfulRunResult());

    await execute(ctx);

    const args = runProcessMock.mock.calls[0][3] as string[];
    expect(args[args.indexOf("--model") + 1]).toBe(model);
    expect(args[args.indexOf("--reasoning-effort") + 1]).toBe("xhigh");
  });

  beforeEach(() => {
    mocks.state.isRemote = false;
    mocks.state.prepareRuntimeResult = null;
    ensureRuntimeInstalledMock.mockClear();
    ensureCommandMock.mockClear();
    prepareRuntimeMock.mockClear();
    resolveCommandForLogsMock.mockClear();
    runProcessMock.mockReset();
  });

  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it("passes the instructions file content via --rules and writes nothing into the workspace", async () => {
    const root = await makeTempRoot();
    const instructionsPath = path.join(root, "managed", "AGENTS.md");
    await fs.mkdir(path.dirname(instructionsPath), { recursive: true });
    await fs.writeFile(instructionsPath, "You are Grok.\n岗位标记句-7f3a\n", "utf8");
    runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
      await options.onLog?.("stdout", '{"type":"text","data":"done"}\n');
      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: [
          JSON.stringify({ type: "text", data: "done" }),
          JSON.stringify({ type: "end", stopReason: "EndTurn", sessionId: "sess-1", requestId: "req-1" }),
        ].join("\n"),
        stderr: "",
      };
    });
    const metas: Array<{ commandArgs?: string[]; commandNotes?: string[] }> = [];
    const ctx = await makeCtx("run-1", root);
    ctx.config = { cwd: root, instructionsFilePath: instructionsPath };
    ctx.onMeta = async (meta) => {
      metas.push(meta as { commandArgs?: string[]; commandNotes?: string[] });
    };

    const result = await execute(ctx);

    expect(result).toMatchObject({ exitCode: 0, errorMessage: null, summary: "done", sessionId: "sess-1" });
    const args = runProcessMock.mock.calls[0][3] as string[];
    expect(args).toEqual(expect.arrayContaining(["--output-format", "streaming-json", "--always-approve"]));
    // Grok >= 1.0 enforces `dontAsk` as deny-by-default over --always-approve,
    // so no permission mode may be passed unless explicitly configured.
    expect(args).not.toContain("--permission-mode");
    // Folder trust must stay off: it would also trust workspace hooks and MCP config.
    expect(args).not.toContain("--trust");
    const rules = args[args.indexOf("--rules") + 1];
    expect(rules).toContain("You are Grok.\n岗位标记句-7f3a");
    expect(rules).toContain(`loaded from ${instructionsPath}`);
    expect(args.filter((arg) => arg.startsWith("@"))).toEqual([]);
    expect(await pathExists(path.join(root, "Agents.md"))).toBe(false);
    expect(await pathExists(path.join(root, ".claude"))).toBe(false);
    const loggedArgs = metas[0].commandArgs ?? [];
    expect(loggedArgs[loggedArgs.indexOf("--rules") + 1]).toBe(`<rules ${rules.length} chars>`);
    expect(JSON.stringify(loggedArgs)).not.toContain("岗位标记句-7f3a");
  });

  describe("resume against the instructions a session was started with", () => {
    async function setup(savedDigest: "current" | "other" | "none") {
      const root = await makeTempRoot();
      const instructionsPath = path.join(root, "AGENTS.md");
      await fs.writeFile(instructionsPath, "resume-marker-91c2\n", "utf8");
      const rules = await readGrokInstructionsRules({ cwd: root, instructionsFilePath: instructionsPath });
      const currentDigest = createHash("sha256").update(rules!.text).digest("hex");
      const sessionParams: Record<string, unknown> = { sessionId: "sess-saved", cwd: root };
      if (savedDigest === "current") sessionParams.instructionsDigest = currentDigest;
      if (savedDigest === "other") sessionParams.instructionsDigest = "0".repeat(64);
      const logs: string[] = [];
      const ctx = await makeCtx("run-resume", root);
      ctx.config = { cwd: root, instructionsFilePath: instructionsPath };
      ctx.runtime = { sessionId: "sess-saved", sessionParams, sessionDisplayId: null, taskKey: null };
      ctx.onLog = async (_stream, chunk) => {
        logs.push(chunk);
      };
      return { ctx, logs, currentDigest };
    }

    it("resumes and still passes the instructions when the saved digest matches", async () => {
      const { ctx, currentDigest } = await setup("current");
      runProcessMock.mockResolvedValue(makeSuccessfulRunResult({ sessionId: "sess-saved" }));

      const result = await execute(ctx);

      const args = runProcessMock.mock.calls[0][3] as string[];
      expect(args[args.indexOf("--resume") + 1]).toBe("sess-saved");
      expect(args[args.indexOf("--rules") + 1]).toContain("resume-marker-91c2");
      expect(result.sessionParams?.instructionsDigest).toBe(currentDigest);
    });

    it.each(["none", "other"] as const)(
      "starts a fresh session when the saved session has %s instructions digest",
      async (savedDigest) => {
        const { ctx, logs, currentDigest } = await setup(savedDigest);
        runProcessMock.mockResolvedValue(makeSuccessfulRunResult({ sessionId: "sess-new" }));

        const result = await execute(ctx);

        const args = runProcessMock.mock.calls[0][3] as string[];
        expect(args).not.toContain("--resume");
        expect(args[args.indexOf("--rules") + 1]).toContain("resume-marker-91c2");
        expect(logs.join("")).toContain("was started with different agent instructions");
        expect(result.sessionId).toBe("sess-new");
        expect(result.sessionParams?.instructionsDigest).toBe(currentDigest);
      },
    );

    it("does not relabel the old session with the new digest when the fresh run reports no session", async () => {
      const { ctx } = await setup("none");
      runProcessMock.mockResolvedValue({ exitCode: 1, signal: null, timedOut: false, stdout: "", stderr: "boom" });

      const result = await execute(ctx);

      expect(result.sessionId).toBeNull();
      expect(result.sessionParams).toBeNull();
    });

    it("keeps resuming sessions when no instructions file is configured", async () => {
      const root = await makeTempRoot();
      runProcessMock.mockResolvedValue(makeSuccessfulRunResult({ sessionId: "sess-saved" }));
      const ctx = await makeCtx("run-resume-no-instructions", root);
      ctx.runtime = { sessionId: "sess-saved", sessionParams: { sessionId: "sess-saved", cwd: root }, sessionDisplayId: null, taskKey: null };

      await execute(ctx);

      const args = runProcessMock.mock.calls[0][3] as string[];
      expect(args[args.indexOf("--resume") + 1]).toBe("sess-saved");
    });
  });

  it("resolves a relative instructions path against the run cwd", async () => {
    const root = await makeTempRoot();
    await fs.writeFile(path.join(root, "ROLE.md"), "relative-marker-5d10\n", "utf8");
    runProcessMock.mockResolvedValue(makeSuccessfulRunResult());
    const ctx = await makeCtx("run-relative", root);
    ctx.config = { cwd: root, instructionsFilePath: "ROLE.md" };

    await execute(ctx);

    const args = runProcessMock.mock.calls[0][3] as string[];
    expect(args[args.indexOf("--rules") + 1]).toContain("relative-marker-5d10");
  });

  it("passes no --rules when no instructions file is configured", async () => {
    const root = await makeTempRoot();
    await fs.writeFile(path.join(root, "AGENTS.md"), "workspace file\n", "utf8");
    runProcessMock.mockResolvedValue(makeSuccessfulRunResult());

    await execute(await makeCtx("run-no-instructions", root));

    const args = runProcessMock.mock.calls[0][3] as string[];
    expect(args).not.toContain("--rules");
    expect(await pathExists(path.join(root, "Agents.md"))).toBe(false);
  });

  it("refuses to start when the configured instructions file is missing", async () => {
    const root = await makeTempRoot();
    const ctx = await makeCtx("run-missing-instructions", root);
    ctx.config = { cwd: root, instructionsFilePath: path.join(root, "gone", "AGENTS.md") };

    await expect(execute(ctx)).rejects.toThrow(/could not be read/);
    expect(runProcessMock).not.toHaveBeenCalled();
  });

  it("measures the --rules limit in UTF-8 bytes, not characters", async () => {
    const root = await makeTempRoot();
    const instructionsPath = path.join(root, "AGENTS.md");
    await fs.writeFile(instructionsPath, "", "utf8");
    const probe = await readGrokInstructionsRules({ cwd: root, instructionsFilePath: instructionsPath });
    const overheadBytes = Buffer.byteLength(probe!.text, "utf8");
    // Fill exactly up to the limit with 3-byte characters plus ASCII padding.
    const room = GROK_RULES_ARG_MAX_BYTES - overheadBytes;
    const atLimit = "中".repeat(Math.floor(room / 3)) + "x".repeat(room % 3);
    await fs.writeFile(instructionsPath, atLimit, "utf8");
    const accepted = await readGrokInstructionsRules({ cwd: root, instructionsFilePath: instructionsPath });
    expect(Buffer.byteLength(accepted!.text, "utf8")).toBe(GROK_RULES_ARG_MAX_BYTES);
    // One more byte fails, although the text is far below the limit in characters.
    await fs.writeFile(instructionsPath, `${atLimit}x`, "utf8");
    expect(atLimit.length + 1 + overheadBytes).toBeLessThan(GROK_RULES_ARG_MAX_BYTES);
    await expect(
      readGrokInstructionsRules({ cwd: root, instructionsFilePath: instructionsPath }),
    ).rejects.toThrow(`${GROK_RULES_ARG_MAX_BYTES + 1} bytes`);

    const ctx = await makeCtx("run-oversized-instructions", root);
    ctx.config = { cwd: root, instructionsFilePath: instructionsPath };
    await expect(execute(ctx)).rejects.toThrow(/single-argument limit/);
    expect(runProcessMock).not.toHaveBeenCalled();
  });

  it("reports real per-run token usage, marks it as per_run, and only surfaces cost for API billing", async () => {
    runProcessMock.mockImplementation(async () => ({
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: [
        JSON.stringify({ type: "text", data: "done" }),
        JSON.stringify({
          type: "end",
          stopReason: "EndTurn",
          sessionId: "sess-1",
          requestId: "req-1",
          usage: { input_tokens: 2384, output_tokens: 261, cache_read_input_tokens: 23040 },
          total_cost_usd: 0.013246,
        }),
      ].join("\n"),
      stderr: "",
    }));

    const previousApiKey = process.env.XAI_API_KEY;
    try {
      // Subscription billing (no XAI_API_KEY): token usage is populated, but
      // there is no marginal dollar cost so costUsd stays null. Clear the key
      // explicitly so the ambient environment (dev machine or CI with provider
      // secrets) cannot flip this branch to API billing.
      delete process.env.XAI_API_KEY;
      const subscriptionResult = await execute(await makeCtx("run-subscription", await makeTempRoot()));
      expect(subscriptionResult).toMatchObject({
        usage: { inputTokens: 2384, outputTokens: 261, cachedInputTokens: 23040 },
        usageBasis: "per_run",
        billingType: "subscription",
        costUsd: null,
      });

      // API-key billing: same token usage, plus the real dollar cost.
      process.env.XAI_API_KEY = "test-key";
      const apiResult = await execute(await makeCtx("run-api", await makeTempRoot()));
      expect(apiResult).toMatchObject({
        usage: { inputTokens: 2384, outputTokens: 261, cachedInputTokens: 23040 },
        usageBasis: "per_run",
        billingType: "api",
        costUsd: 0.013246,
      });
    } finally {
      if (previousApiKey === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previousApiKey;
    }
  });

  describe("local lane GROK_HOME", () => {
    let previousApiKey: string | undefined;
    let previousPaperclipHome: string | undefined;
    let previousGrokHome: string | undefined;

    beforeEach(async () => {
      previousApiKey = process.env.XAI_API_KEY;
      previousPaperclipHome = process.env.PAPERCLIP_HOME;
      previousGrokHome = process.env.GROK_HOME;
      process.env.PAPERCLIP_HOME = await makeTempRoot();
      delete process.env.XAI_API_KEY;
      delete process.env.GROK_HOME;
    });

    afterEach(() => {
      if (previousApiKey === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previousApiKey;
      if (previousPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
      else process.env.PAPERCLIP_HOME = previousPaperclipHome;
      if (previousGrokHome === undefined) delete process.env.GROK_HOME;
      else process.env.GROK_HOME = previousGrokHome;
    });

    it("leaves GROK_HOME unset when the company home has no usable auth", async () => {
      let seenEnv: Record<string, string> = {};
      runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
        seenEnv = options.env;
        return makeSuccessfulRunResult();
      });

      await execute(await makeCtx("run-subscription-home-empty", await makeTempRoot()));
      expect(seenEnv.GROK_HOME).toBeUndefined();
    });

    it("lets a local child read the host login when the company home is empty", async () => {
      const hostRoot = await makeTempRoot();
      const hostHome = path.join(hostRoot, ".grok");
      await fs.mkdir(hostHome);
      const auth = grokAuth({ key: "fixture-host-key", expiresAt: NEWER_EXPIRY });
      await fs.writeFile(path.join(hostHome, "auth.json"), auth);
      const companyHome = resolveManagedGrokHomeDir(process.env, "company-1");
      await fs.mkdir(companyHome, { recursive: true });
      const ctx = await makeCtx("run-host-login-child", await makeTempRoot());
      ctx.config.env = { HOME: hostRoot };
      runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
        // A real subprocess with Grok's home lookup contract, using only
        // disposable fixture credentials. No provider request is made.
        const stdout = execFileSync(process.execPath, ["-e", `
          const fs = require("node:fs");
          const path = require("node:path");
          const home = process.env.GROK_HOME || path.join(process.env.HOME, ".grok");
          const auth = JSON.parse(fs.readFileSync(path.join(home, "auth.json"), "utf8"));
          if (Object.values(auth)[0].key !== "fixture-host-key") process.exit(1);
          console.log(JSON.stringify({ type: "end", stopReason: "EndTurn", sessionId: "host-login" }));
        `], { env: { ...process.env, ...options.env }, encoding: "utf8" });
        return { ...makeSuccessfulRunResult(), stdout };
      });

      const result = await execute(ctx);

      expect(result.exitCode).toBe(0);
      expect(result.sessionId).toBe("host-login");
      expect(await fs.readdir(companyHome)).toEqual([]);
      expect(await fs.readFile(path.join(hostHome, "auth.json"), "utf8")).toBe(auth);
    });

    it("pins GROK_HOME to the company home when that home has usable auth", async () => {
      const companyHome = resolveManagedGrokHomeDir(process.env, "company-1");
      await fs.mkdir(companyHome, { recursive: true });
      await fs.writeFile(
        path.join(companyHome, "auth.json"),
        grokAuth({ key: "local-key", expiresAt: NEWER_EXPIRY }),
        "utf8",
      );

      let seenEnv: Record<string, string> = {};
      runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
        seenEnv = options.env;
        return makeSuccessfulRunResult();
      });

      await execute(await makeCtx("run-subscription-home-seeded", await makeTempRoot()));
      expect(seenEnv.GROK_HOME).toBe(companyHome);
    });

    async function makeSkillConfig(root: string) {
      const skillSource = path.join(root, "runtime-skills", "paperclip");
      await fs.mkdir(skillSource, { recursive: true });
      await fs.writeFile(path.join(skillSource, "SKILL.md"), "---\nname: paperclip\ndescription: test\n---\n", "utf8");
      return {
        skillSource,
        config: {
          paperclipRuntimeSkills: [{ key: "paperclip", runtimeName: "paperclip", source: skillSource, required: false }],
          paperclipSkillSync: { desiredSkills: ["paperclip"] },
        },
      };
    }

    it("links desired skills into the pinned company GROK_HOME, not the workspace, and keeps them after the run", async () => {
      const companyHome = resolveManagedGrokHomeDir(process.env, "company-1");
      await fs.mkdir(companyHome, { recursive: true });
      await fs.writeFile(path.join(companyHome, "auth.json"), grokAuth({ key: "local-key", expiresAt: NEWER_EXPIRY }));
      const root = await makeTempRoot();
      const { skillSource, config } = await makeSkillConfig(root);
      const target = path.join(companyHome, "skills", "paperclip");
      let linkedDuringRun = "";
      runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
        expect(options.env.GROK_HOME).toBe(companyHome);
        linkedDuringRun = await fs.readlink(target);
        return makeSuccessfulRunResult();
      });
      const ctx = await makeCtx("run-skills-pinned", root);
      ctx.config = { cwd: root, ...config };

      await execute(ctx);

      expect(runProcessMock).toHaveBeenCalledTimes(1);
      expect(linkedDuringRun).toBe(skillSource);
      expect((await fs.lstat(target)).isSymbolicLink()).toBe(true);
      expect(await pathExists(path.join(target, "SKILL.md"))).toBe(true);
      expect(await pathExists(path.join(root, ".claude"))).toBe(false);
    });

    it("links skills into an explicitly configured GROK_HOME", async () => {
      const configuredHome = await makeTempRoot();
      const root = await makeTempRoot();
      const { skillSource, config } = await makeSkillConfig(root);
      runProcessMock.mockResolvedValue(makeSuccessfulRunResult());
      const ctx = await makeCtx("run-skills-configured", root);
      ctx.config = { cwd: root, ...config, env: { GROK_HOME: configuredHome } };

      await execute(ctx);

      expect(runProcessMock.mock.calls[0][4].env.GROK_HOME).toBe(configuredHome);
      expect(await fs.readlink(path.join(configuredHome, "skills", "paperclip"))).toBe(skillSource);
    });

    it("writes no skills anywhere when the run has no dedicated GROK_HOME", async () => {
      const hostRoot = await makeTempRoot();
      const companyHome = resolveManagedGrokHomeDir(process.env, "company-1");
      const root = await makeTempRoot();
      const { config } = await makeSkillConfig(root);
      const logs: string[] = [];
      runProcessMock.mockResolvedValue(makeSuccessfulRunResult());
      const ctx = await makeCtx("run-skills-no-home", root);
      ctx.config = { cwd: root, ...config, env: { HOME: hostRoot } };
      ctx.onLog = async (_stream, chunk) => {
        logs.push(chunk);
      };

      await execute(ctx);

      expect(runProcessMock.mock.calls[0][4].env.GROK_HOME).toBeUndefined();
      expect(await pathExists(path.join(hostRoot, ".grok"))).toBe(false);
      expect(await pathExists(path.join(companyHome, "skills"))).toBe(false);
      expect(await pathExists(path.join(root, ".claude"))).toBe(false);
      expect(logs.join("")).toContain("Grok skills were not injected: no dedicated GROK_HOME");
    });

    it.each(["{invalid", "{}", JSON.stringify({ [GROK_IDENTITY]: { key: "incomplete" } })])(
      "uses host login when company auth is unusable (%s)",
      async (contents) => {
        const companyHome = resolveManagedGrokHomeDir(process.env, "company-1");
        await fs.mkdir(companyHome, { recursive: true });
        await fs.writeFile(path.join(companyHome, "auth.json"), contents);
        runProcessMock.mockResolvedValue(makeSuccessfulRunResult());

        await execute(await makeCtx("run-unusable-company-auth", await makeTempRoot()));

        expect(runProcessMock.mock.calls[0][4].env.GROK_HOME).toBeUndefined();
        expect(await fs.readFile(path.join(companyHome, "auth.json"), "utf8")).toBe(contents);
      },
    );

    it.each(["inherited", "configured"])("preserves the %s host GROK_HOME fallback", async (source) => {
      const hostHome = await makeTempRoot();
      const ctx = await makeCtx("run-custom-host-home", await makeTempRoot());
      if (source === "inherited") process.env.GROK_HOME = hostHome;
      else ctx.config.env = { GROK_HOME: hostHome };
      runProcessMock.mockResolvedValue(makeSuccessfulRunResult());

      await execute(ctx);

      // Command resolution receives the merged child environment, including
      // inherited values that are absent from the explicit spawn overrides.
      const commandCall = ensureCommandMock.mock.calls[0] as unknown as [unknown, unknown, unknown, Record<string, string>];
      expect(commandCall[3].GROK_HOME).toBe(hostHome);
    });

    it("uses company login when an explicit empty API key overrides an inherited key", async () => {
      process.env.XAI_API_KEY = "host-api-key";
      process.env.GROK_HOME = await makeTempRoot();
      const companyHome = resolveManagedGrokHomeDir(process.env, "company-1");
      await fs.mkdir(companyHome, { recursive: true });
      await fs.writeFile(path.join(companyHome, "auth.json"), grokAuth({ key: "company-key", expiresAt: NEWER_EXPIRY }));
      const ctx = await makeCtx("run-cleared-host-api-key", await makeTempRoot());
      ctx.config.env = { XAI_API_KEY: "" };
      runProcessMock.mockResolvedValue(makeSuccessfulRunResult());

      const result = await execute(ctx);

      expect(runProcessMock.mock.calls[0][4].env.GROK_HOME).toBe(companyHome);
      expect(result.billingType).toBe("subscription");
    });

    it("leaves GROK_HOME unset when XAI_API_KEY exists", async () => {
      let seenEnv: Record<string, string> = {};
      runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
        seenEnv = options.env;
        return makeSuccessfulRunResult();
      });

      process.env.XAI_API_KEY = "test-key";
      await execute(await makeCtx("run-api-home", await makeTempRoot()));
      expect(seenEnv.GROK_HOME).toBeUndefined();
    });

    it("pins GROK_HOME for a managed AI connection even when the home has no usable auth", async () => {
      process.env.GROK_HOME = await makeTempRoot();
      process.env.XAI_API_KEY = "inherited-host-key";
      let seenEnv: Record<string, string> = {};
      runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
        seenEnv = options.env;
        return makeSuccessfulRunResult();
      });

      const ctx = await makeCtx("run-connection-home", await makeTempRoot());
      ctx.config = {
        ...ctx.config,
        managedAiConnection: true,
        env: { GROK_HOME: "/connection/grok-home" },
      };
      await execute(ctx);
      expect(seenEnv.GROK_HOME).toBe("/connection/grok-home");
    });
  });

  it("passes an explicitly configured permissionMode through to the CLI", async () => {
    let seenArgs: string[] = [];
    runProcessMock.mockImplementation(async (_runId, _target, _command, args) => {
      seenArgs = args;
      return makeSuccessfulRunResult();
    });

    const ctx: AdapterExecutionContext = {
      runId: "run-permission-mode",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Grok Agent",
        adapterType: "grok_local",
        adapterConfig: {},
      },
      runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
      config: { cwd: await makeTempRoot(), permissionMode: "bypassPermissions" },
      context: {},
      authToken: "run-token",
      onLog: async () => {},
    };

    await execute(ctx);

    const flagIndex = seenArgs.indexOf("--permission-mode");
    expect(flagIndex).toBeGreaterThan(-1);
    expect(seenArgs[flagIndex + 1]).toBe("bypassPermissions");
  });

  it("leaves the workspace untouched when setup fails before the Grok process starts", async () => {
    const root = await makeTempRoot();
    const instructionsPath = path.join(root, "managed", "AGENTS.md");
    await fs.mkdir(path.dirname(instructionsPath), { recursive: true });
    await fs.writeFile(instructionsPath, "You are Grok.\n", "utf8");
    ensureCommandMock.mockRejectedValueOnce(new Error("grok not installed"));
    const ctx = await makeCtx("run-setup-fail", root);
    ctx.config = { cwd: root, instructionsFilePath: instructionsPath };

    await expect(execute(ctx)).rejects.toThrow("grok not installed");
    expect(runProcessMock).not.toHaveBeenCalled();
    expect((await fs.readdir(root)).sort()).toEqual(["managed"]);
  });

  describe("remote lane credential staging", () => {
    let previousApiKey: string | undefined;
    let previousPaperclipHome: string | undefined;
    let paperclipHomeRoot: string;

    beforeEach(async () => {
      previousApiKey = process.env.XAI_API_KEY;
      previousPaperclipHome = process.env.PAPERCLIP_HOME;
      // Point the managed Grok home at a private tmp root, so staging never
      // touches a real developer or CI-host `~/.paperclip` tree.
      paperclipHomeRoot = await makeTempRoot();
      process.env.PAPERCLIP_HOME = paperclipHomeRoot;
      sandboxAuthFixture.bytes = null;
      sandboxAuthFixture.error = null;
    });

    afterEach(() => {
      if (previousApiKey === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previousApiKey;
      if (previousPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
      else process.env.PAPERCLIP_HOME = previousPaperclipHome;
    });

    async function seedHostGrokAuth(contents: string): Promise<string> {
      const hostGrokHome = resolveManagedGrokHomeDir(process.env, "company-1");
      await fs.mkdir(hostGrokHome, { recursive: true });
      await fs.writeFile(path.join(hostGrokHome, "auth.json"), contents, "utf8");
      return hostGrokHome;
    }

    it("passes one home asset that carries the staged directory in a remote subscription run", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      await seedHostGrokAuth(JSON.stringify({ live: "token" }));
      runProcessMock.mockImplementation(async () => makeSuccessfulRunResult());

      // Read the staged asset while `prepareAdapterExecutionTargetRuntime` still
      // holds it — the run's `finally` removes the staged dir once `execute()`
      // returns, so any read after that point sees it already gone.
      let stagedAuthContents = "";
      let homeAssetShape: { key: string; followSymlinks?: boolean; provision?: unknown; restore?: unknown } | null = null;
      let assetCount = -1;
      prepareRuntimeMock.mockImplementationOnce(
        async (input: { assets?: Array<{ key: string; localDir: string; followSymlinks?: boolean; provision?: unknown; restore?: unknown }> }) => {
          const assets = input.assets ?? [];
          assetCount = assets.length;
          const [homeAsset] = assets;
          homeAssetShape = homeAsset
            ? { key: homeAsset.key, followSymlinks: homeAsset.followSymlinks, provision: homeAsset.provision, restore: homeAsset.restore }
            : null;
          if (homeAsset) {
            stagedAuthContents = await fs.readFile(path.join(homeAsset.localDir, "auth.json"), "utf8");
          }
          return {
            workspaceRemoteDir: "/remote/workspace",
            assetDirs: { home: "/remote/workspace/.paperclip-runtime/grok/home" },
            restoreWorkspace: async () => {},
          };
        },
      );

      await execute(await makeCtx("run-remote-subscription-asset", await makeTempRoot()));

      expect(assetCount).toBe(1);
      expect(homeAssetShape).toMatchObject({ key: "home", followSymlinks: true });
      expect((homeAssetShape as { provision?: unknown } | null)?.provision).toBeUndefined();
      expect(typeof (homeAssetShape as { restore?: unknown } | null)?.restore).toBe("function");
      expect(stagedAuthContents).toBe(JSON.stringify({ live: "token" }));
    });

    it("sets GROK_HOME from assetDirs.home in a remote subscription run", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      await seedHostGrokAuth("{}");
      let seenEnv: Record<string, string> = {};
      runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
        seenEnv = options.env;
        return makeSuccessfulRunResult();
      });

      await execute(await makeCtx("run-remote-subscription-home", await makeTempRoot()));

      expect(seenEnv.GROK_HOME).toBe("/remote/workspace/.paperclip-runtime/grok/home");
    });

    it("stages an empty company home instead of a configured host login for remote runs", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      const hostHome = await makeTempRoot();
      await fs.writeFile(path.join(hostHome, "auth.json"), grokAuth({ key: "host-only", expiresAt: NEWER_EXPIRY }));
      const ctx = await makeCtx("run-remote-empty-company", await makeTempRoot());
      ctx.config.env = { GROK_HOME: hostHome };
      let stagedEntries: string[] | undefined;
      prepareRuntimeMock.mockImplementationOnce(async (input) => {
        stagedEntries = await fs.readdir(input.assets![0].localDir);
        return {
          workspaceRemoteDir: "/remote/workspace",
          assetDirs: { home: "/remote/workspace/.paperclip-runtime/grok/home" },
          restoreWorkspace: async () => {},
        };
      });
      runProcessMock.mockResolvedValue(makeSuccessfulRunResult());

      await execute(ctx);

      expect(stagedEntries).toEqual([]);
      expect(runProcessMock.mock.calls[0][4].env.GROK_HOME).toBe("/remote/workspace/.paperclip-runtime/grok/home");
    });

    it("uses the fallback remote path when assetDirs.home is absent", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      mocks.state.prepareRuntimeResult = { workspaceRemoteDir: "/remote/fallback-workspace", assetDirs: {} };
      await seedHostGrokAuth("{}");
      let seenEnv: Record<string, string> = {};
      runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
        seenEnv = options.env;
        return makeSuccessfulRunResult();
      });

      await execute(await makeCtx("run-remote-subscription-fallback", await makeTempRoot()));

      expect(seenEnv.GROK_HOME).toBe(
        "/remote/fallback-workspace/.paperclip-runtime/grok/home",
      );
    });

    it("passes no home asset and sets no GROK_HOME in a remote API-key run", async () => {
      process.env.XAI_API_KEY = "test-key";
      mocks.state.isRemote = true;
      let seenEnv: Record<string, string> = {};
      runProcessMock.mockImplementation(async (_runId, _target, _command, _args, options) => {
        seenEnv = options.env;
        return makeSuccessfulRunResult();
      });

      await execute(await makeCtx("run-remote-api-key", await makeTempRoot()));

      expect(prepareRuntimeMock).toHaveBeenCalledTimes(1);
      const { assets } = prepareRuntimeMock.mock.calls[0][0] as { assets?: unknown[] };
      expect(assets).toBeUndefined();
      expect(seenEnv.GROK_HOME).toBeUndefined();
    });

    it("passes no home asset in a local run", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = false;
      runProcessMock.mockImplementation(async () => makeSuccessfulRunResult());

      await execute(await makeCtx("run-local-no-asset", await makeTempRoot()));

      expect(prepareRuntimeMock).not.toHaveBeenCalled();
    });

    it("removes the staged home after a successful remote subscription run", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      await seedHostGrokAuth("{}");
      let stagedDir = "";
      runProcessMock.mockImplementation(async () => makeSuccessfulRunResult());
      prepareRuntimeMock.mockImplementationOnce(async (input: { assets?: Array<{ localDir: string }> }) => {
        stagedDir = input.assets?.[0]?.localDir ?? "";
        return {
          workspaceRemoteDir: "/remote/workspace",
          assetDirs: { home: "/remote/workspace/.paperclip-runtime/grok/home" },
          restoreWorkspace: async () => {},
        };
      });

      await execute(await makeCtx("run-remote-cleanup-success", await makeTempRoot()));

      expect(stagedDir).not.toBe("");
      expect(await pathExists(stagedDir)).toBe(false);
    });

    it("removes the staged home after a setup failure in a remote subscription run", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      await seedHostGrokAuth("{}");
      let stagedDir = "";
      prepareRuntimeMock.mockImplementationOnce(async (input: { assets?: Array<{ localDir: string }> }) => {
        stagedDir = input.assets?.[0]?.localDir ?? "";
        return {
          workspaceRemoteDir: "/remote/workspace",
          assetDirs: { home: "/remote/workspace/.paperclip-runtime/grok/home" },
          restoreWorkspace: async () => {},
        };
      });
      ensureCommandMock.mockRejectedValueOnce(new Error("grok not installed remotely"));

      await expect(execute(await makeCtx("run-remote-cleanup-fail", await makeTempRoot()))).rejects.toThrow(
        "grok not installed remotely",
      );

      expect(stagedDir).not.toBe("");
      expect(await pathExists(stagedDir)).toBe(false);
    });

    it("removes the staged home when the workspace restore rejects during teardown", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      await seedHostGrokAuth("{}");
      let stagedDir = "";
      runProcessMock.mockImplementation(async () => makeSuccessfulRunResult());
      prepareRuntimeMock.mockImplementationOnce(async (input: { assets?: Array<{ localDir: string }> }) => {
        stagedDir = input.assets?.[0]?.localDir ?? "";
        return {
          workspaceRemoteDir: "/remote/workspace",
          assetDirs: { home: "/remote/workspace/.paperclip-runtime/grok/home" },
          restoreWorkspace: async () => {
            throw new Error("restore failed");
          },
        };
      });

      await expect(execute(await makeCtx("run-remote-teardown-restore-reject", await makeTempRoot()))).rejects.toThrow(
        "restore failed",
      );

      expect(stagedDir).not.toBe("");
      expect(await pathExists(stagedDir)).toBe(false);
    });

    it("a remote run copies the refreshed sandbox credential to the company Grok home", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      const hostGrokHome = await seedHostGrokAuth(grokAuth({ key: "host-key", expiresAt: OLDER_EXPIRY }));
      const refreshedAuth = grokAuth({ key: "refreshed-key", expiresAt: NEWER_EXPIRY });
      sandboxAuthFixture.bytes = Buffer.from(refreshedAuth, "utf8");
      runProcessMock.mockImplementation(async () => makeSuccessfulRunResult());
      prepareRuntimeMock.mockImplementationOnce(async (input: {
        assets?: Array<{ key: string; localDir: string; followSymlinks?: boolean; provision?: unknown; restore?: unknown }>;
      }) => {
        const assets = (input.assets ?? []) as Array<{
          restore?: (ctx: { assetDir: string; readFile: (path: string) => Promise<Buffer> }) => Promise<void>;
        }>;
        return {
          workspaceRemoteDir: "/remote/workspace",
          assetDirs: { home: "/remote/workspace/.paperclip-runtime/grok/home" },
          restoreWorkspace: makeRestoreWorkspace(assets),
        };
      });

      await execute(await makeCtx("run-copyout-e2e", await makeTempRoot()));

      expect(await fs.readFile(path.join(hostGrokHome, "auth.json"), "utf8")).toBe(refreshedAuth);
    });

    it("the copy-out installs to the resolver directory when env.GROK_HOME names a different directory, and the named directory stays empty", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      const resolverDir = await seedHostGrokAuth(grokAuth({ key: "host-key", expiresAt: OLDER_EXPIRY }));
      const attackerDir = await makeTempRoot();
      const refreshedAuth = grokAuth({ key: "refreshed-key", expiresAt: NEWER_EXPIRY });
      sandboxAuthFixture.bytes = Buffer.from(refreshedAuth, "utf8");
      runProcessMock.mockImplementation(async () => makeSuccessfulRunResult());
      prepareRuntimeMock.mockImplementationOnce(async (input: {
        assets?: Array<{ key: string; localDir: string; followSymlinks?: boolean; provision?: unknown; restore?: unknown }>;
      }) => {
        const assets = (input.assets ?? []) as Array<{
          restore?: (ctx: { assetDir: string; readFile: (path: string) => Promise<Buffer> }) => Promise<void>;
        }>;
        return {
          workspaceRemoteDir: "/remote/workspace",
          assetDirs: { home: "/remote/workspace/.paperclip-runtime/grok/home" },
          restoreWorkspace: makeRestoreWorkspace(assets),
        };
      });

      const ctx = await makeCtx("run-copyout-pinning", await makeTempRoot());
      ctx.config = { ...ctx.config, env: { GROK_HOME: attackerDir } };
      await execute(ctx);

      expect(await fs.readFile(path.join(resolverDir, "auth.json"), "utf8")).toBe(refreshedAuth);
      await expect(fs.readFile(path.join(attackerDir, "auth.json"), "utf8")).rejects.toThrow();
    });

    it("a copy-out failure does not fail the run", async () => {
      delete process.env.XAI_API_KEY;
      mocks.state.isRemote = true;
      const hostGrokHome = await seedHostGrokAuth(grokAuth({ key: "host-key", expiresAt: OLDER_EXPIRY }));
      sandboxAuthFixture.error = Object.assign(new Error("sandbox read boom"), { code: "EIO" });
      runProcessMock.mockImplementation(async () => makeSuccessfulRunResult());
      prepareRuntimeMock.mockImplementationOnce(async (input: {
        assets?: Array<{ key: string; localDir: string; followSymlinks?: boolean; provision?: unknown; restore?: unknown }>;
      }) => {
        const assets = (input.assets ?? []) as Array<{
          restore?: (ctx: { assetDir: string; readFile: (path: string) => Promise<Buffer> }) => Promise<void>;
        }>;
        return {
          workspaceRemoteDir: "/remote/workspace",
          assetDirs: { home: "/remote/workspace/.paperclip-runtime/grok/home" },
          restoreWorkspace: makeRestoreWorkspace(assets),
        };
      });

      const result = await execute(await makeCtx("run-copyout-failure", await makeTempRoot()));

      expect(result.exitCode).toBe(0);
      // The host credential is untouched by the failed copy-out.
      expect(await fs.readFile(path.join(hostGrokHome, "auth.json"), "utf8")).toBe(
        grokAuth({ key: "host-key", expiresAt: OLDER_EXPIRY }),
      );
    });
  });
});
