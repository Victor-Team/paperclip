import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerAdapterModule } from "../adapters/index.js";

// Ledger #19: switching an agent's adapter must not carry the leaving
// adapter's env (HOME, GROK_HOME, CLAUDE_CONFIG_DIR, tokens) into the new
// adapter. Each adapter keeps its own saved config per agent; a company
// default covers the first switch; only a portable env allowlist carries over.

const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_AGENT_ID = "22222222-2222-4222-8222-222222222222";
const REDACTED = "***REDACTED***";

type AgentRow = Record<string, unknown> & {
  id: string;
  companyId: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
};

const agentRows = vi.hoisted(() => new Map<string, Record<string, unknown>>());

const mockAgentService = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(async (id: string) => {
    const row = agentRows.get(id);
    return row ? JSON.parse(JSON.stringify(row)) : null;
  }),
  getConfigRevision: vi.fn(),
  rollbackConfigRevision: vi.fn(),
  update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
    const row = agentRows.get(id);
    if (!row) return null;
    const next = { ...row, ...JSON.parse(JSON.stringify(patch)) };
    agentRows.set(id, next);
    return JSON.parse(JSON.stringify(next));
  }),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(async () => true),
  decide: vi.fn(async () => ({ allowed: true, reason: "allow_explicit_grant", explanation: "Allowed" })),
  hasPermission: vi.fn(async () => true),
  ensureMembership: vi.fn(),
  setPrincipalPermission: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(async (_companyId: string, config: Record<string, unknown>) => config),
  resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({ config })),
  syncEnvBindingsForTarget: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

const mockAdapterConfigProfiles = vi.hoisted(() => {
  const agentProfiles = new Map<string, Record<string, unknown>>();
  const companyDefaults = new Map<string, Record<string, unknown>>();
  const clone = (value: Record<string, unknown>) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  return {
    agentProfiles,
    companyDefaults,
    reset() {
      agentProfiles.clear();
      companyDefaults.clear();
    },
    service: {
      getAgentProfile: vi.fn(async (agentId: string, adapterType: string) => {
        const value = agentProfiles.get(`${agentId}:${adapterType}`);
        return value ? clone(value) : null;
      }),
      saveAgentProfile: vi.fn(async (input: { agentId: string; adapterType: string; adapterConfig: Record<string, unknown> }) => {
        agentProfiles.set(`${input.agentId}:${input.adapterType}`, clone(input.adapterConfig));
      }),
      getCompanyDefault: vi.fn(async (companyId: string, adapterType: string) => {
        const value = companyDefaults.get(`${companyId}:${adapterType}`);
        return value ? clone(value) : null;
      }),
      saveCompanyDefault: vi.fn(async (input: { companyId: string; adapterType: string; adapterConfig: Record<string, unknown> }) => {
        companyDefaults.set(`${input.companyId}:${input.adapterType}`, clone(input.adapterConfig));
      }),
    },
  };
});

const actorState = vi.hoisted(() => ({ type: "board" as "board" | "agent" }));

function registerModuleMocks() {
  vi.doMock("../services/index.js", () => ({
    agentService: () => mockAgentService,
    agentInstructionsService: () => ({
      materializeManagedBundle: vi.fn(async (agent: { adapterConfig: unknown }) => ({ adapterConfig: agent.adapterConfig })),
    }),
    accessService: () => mockAccessService,
    approvalService: () => ({}),
    builtInAgentService: () => ({ ensureCompanyDefaultAgentGrants: vi.fn() }),
    companySkillService: () => ({
      listRuntimeSkillEntries: vi.fn(async () => []),
      resolveRequestedSkillKeys: vi.fn(async () => []),
    }),
    budgetService: () => ({ upsertPolicy: vi.fn() }),
    heartbeatService: () => ({ cancelActiveForAgent: vi.fn() }),
    issueApprovalService: () => ({}),
    issueService: () => ({}),
    logActivity: mockLogActivity,
    secretService: () => mockSecretService,
    syncInstructionsBundleConfigFromFilePath: vi.fn((_agent: unknown, config: unknown) => config),
    workspaceOperationService: () => ({}),
  }));
  vi.doMock("../services/secrets.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/secrets.js")>()),
    secretService: () => mockSecretService,
  }));
  vi.doMock("../services/instance-settings.js", () => ({
    instanceSettingsService: () => ({
      get: vi.fn(async () => ({ defaultEnvironmentId: null })),
      getGeneral: vi.fn(async () => ({ censorUsernameInLogs: false })),
      getExperimental: vi.fn(async () => ({ enableNativeRunner: false })),
    }),
  }));
  vi.doMock("../services/adapter-config-profiles.js", () => ({
    adapterConfigProfileService: () => mockAdapterConfigProfiles.service,
  }));
  vi.doMock("../services/adapter-plugin-store.js", () => ({
    getDisabledAdapterTypes: () => [],
    isAdapterDisabled: () => false,
    listAdapterPlugins: () => [],
    getAdapterPluginByType: () => undefined,
    setAdapterDisabled: vi.fn(),
  }));
}

const probeSpy = vi.fn();
const probeAdapter: ServerAdapterModule = {
  type: "switch_probe_test",
  execute: async () => ({ exitCode: 0, signal: null, timedOut: false }),
  testEnvironment: probeSpy,
};

async function createApp() {
  const [{ agentRoutes }, { errorHandler }] = await Promise.all([
    import("../routes/agents.js"),
    import("../middleware/index.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actorState.type === "board"
      ? { type: "board", userId: "local-board", companyIds: ["company-1"], source: "local_implicit", isInstanceAdmin: false }
      : { type: "agent", agentId: OTHER_AGENT_ID, companyId: "company-1", source: "agent_key" };
    next();
  });
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{ id: "company-1", requireBoardApprovalForNewAgents: false }]),
      })),
    })),
  };
  app.use("/api", agentRoutes(db as any));
  app.use(errorHandler);
  return app;
}

function seedAgent(row: Partial<AgentRow> & { id: string; adapterType: string; adapterConfig: Record<string, unknown> }) {
  agentRows.set(row.id, {
    companyId: "company-1",
    name: `Agent ${row.id.slice(0, 4)}`,
    urlKey: `agent-${row.id.slice(0, 4)}`,
    role: "engineer",
    title: null,
    icon: null,
    status: "idle",
    reportsTo: null,
    capabilities: null,
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    defaultEnvironmentId: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...row,
  });
}

function storedConfig(id: string): Record<string, unknown> {
  return (agentRows.get(id)!.adapterConfig ?? {}) as Record<string, unknown>;
}

function storedEnv(id: string): Record<string, unknown> {
  return (storedConfig(id).env ?? {}) as Record<string, unknown>;
}

const plain = (value: string) => ({ type: "plain", value });
// Production shape (agents table, 2026-09-26): Claude tokens are company
// secret references with secretId + version; homes/config dirs are plain.
const claudeTokenRef = { type: "secret_ref", secretId: "33333333-3333-4333-8333-333333333333", version: "latest" };
const fixedClaudeOAuthBinding = { type: "user_secret_ref", key: "CLAUDE_CODE_OAUTH_TOKEN" };

const bundleKeys = {
  instructionsBundleMode: "external",
  instructionsRootPath: "/run/company/instructions/backend",
  instructionsEntryFile: "AGENTS.md",
  instructionsFilePath: "/run/company/instructions/backend/AGENTS.md",
};
const skillSync = { desiredSkills: ["company/c1/company-operating-rules", "paperclipai/bundled/quality/qa-acceptance"] };

function grokSeatConfig() {
  return {
    env: {
      HOME: plain("/home/op/grok-work"),
      GROK_HOME: plain("/home/op/.grok"),
      HTTPS_PROXY: plain("http://127.0.0.1:7890"),
      http_proxy: plain("http://127.0.0.1:7890"),
      NO_PROXY: plain("localhost,127.0.0.1"),
    },
    mode: "",
    model: "grok-4.6",
    effort: "",
    variant: "",
    modelReasoningEffort: "",
    permissionMode: "bypass",
    paperclipSkillSync: skillSync,
    ...bundleKeys,
  };
}

// The UI switch patch: blanks model/effort/... and sends replaceAdapterConfig.
function uiSwitchBody(adapterType: string) {
  return {
    adapterType,
    adapterConfig: { model: "", effort: "", modelReasoningEffort: "", variant: "", mode: "" },
    replaceAdapterConfig: true,
  };
}

async function patchAgent(app: express.Express, id: string, body: Record<string, unknown>) {
  return request(app).patch(`/api/agents/${id}`).send(body);
}

describe("agent adapter switch profiles (ledger #19)", () => {
  beforeEach(async () => {
    vi.resetModules();
    registerModuleMocks();
    vi.clearAllMocks();
    agentRows.clear();
    mockAdapterConfigProfiles.reset();
    actorState.type = "board";
    mockAccessService.decide.mockImplementation(async () => ({ allowed: true, reason: "allow_explicit_grant", explanation: "Allowed" }));
    probeSpy.mockImplementation(async () => ({
      adapterType: "switch_probe_test",
      status: "pass",
      checks: [],
      testedAt: new Date(0).toISOString(),
    }));
    const { registerServerAdapter, unregisterServerAdapter } = await import("../adapters/index.js");
    unregisterServerAdapter("switch_probe_test");
    registerServerAdapter(probeAdapter);
  });

  afterEach(async () => {
    const { unregisterServerAdapter } = await import("../adapters/index.js");
    unregisterServerAdapter("switch_probe_test");
  });

  it("A: grok -> claude_local drops HOME/GROK_HOME, keeps proxy variables and seat-owned keys", async () => {
    seedAgent({ id: AGENT_ID, adapterType: "grok_local", adapterConfig: grokSeatConfig() });
    const app = await createApp();

    const res = await patchAgent(app, AGENT_ID, uiSwitchBody("claude_local"));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(agentRows.get(AGENT_ID)!.adapterType).toBe("claude_local");
    expect(storedEnv(AGENT_ID)).toEqual({
      HTTPS_PROXY: plain("http://127.0.0.1:7890"),
      http_proxy: plain("http://127.0.0.1:7890"),
      NO_PROXY: plain("localhost,127.0.0.1"),
    });
    expect(storedEnv(AGENT_ID)).not.toHaveProperty("HOME");
    expect(storedEnv(AGENT_ID)).not.toHaveProperty("GROK_HOME");
    // grok-only keys and the UI's blanked fields do not reach the Claude config.
    expect(storedConfig(AGENT_ID)).not.toHaveProperty("permissionMode");
    expect(storedConfig(AGENT_ID).model).not.toBe("grok-4.6");
    // Seat-owned keys survive the switch.
    expect(storedConfig(AGENT_ID).paperclipSkillSync).toEqual(skillSync);
    expect(storedConfig(AGENT_ID)).toMatchObject(bundleKeys);
    // The leaving adapter's full config is saved as this agent's grok profile.
    expect(mockAdapterConfigProfiles.agentProfiles.get(`${AGENT_ID}:grok_local`)).toEqual(grokSeatConfig());
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "agent.updated",
        details: expect.objectContaining({ adapterSwitchConfigSource: "none" }),
      }),
    );
  });

  it("B: switching back restores each adapter's own env and model exactly (secret refs untouched)", async () => {
    seedAgent({ id: AGENT_ID, adapterType: "grok_local", adapterConfig: grokSeatConfig() });
    const app = await createApp();

    expect((await patchAgent(app, AGENT_ID, uiSwitchBody("claude_local"))).status).toBe(200);
    // Configure Claude on the Claude adapter (same-adapter PATCH, merge).
    const claudeEnv = {
      ...storedEnv(AGENT_ID),
      HOME: plain("/home/op/claude-work"),
      CLAUDE_CONFIG_DIR: plain("/home/op/.claude-seat"),
      CLAUDE_CODE_OAUTH_TOKEN: claudeTokenRef,
    };
    expect((await patchAgent(app, AGENT_ID, { adapterConfig: { env: claudeEnv, model: "claude-model-x" } })).status).toBe(200);

    const toGrok = await patchAgent(app, AGENT_ID, uiSwitchBody("grok_local"));
    expect(toGrok.status, JSON.stringify(toGrok.body)).toBe(200);
    expect(storedEnv(AGENT_ID).HOME).toEqual(plain("/home/op/grok-work"));
    expect(storedEnv(AGENT_ID).GROK_HOME).toEqual(plain("/home/op/.grok"));
    expect(storedEnv(AGENT_ID)).not.toHaveProperty("CLAUDE_CONFIG_DIR");
    expect(storedEnv(AGENT_ID)).not.toHaveProperty("CLAUDE_CODE_OAUTH_TOKEN");
    expect(storedConfig(AGENT_ID).model).toBe("grok-4.6");
    expect(storedConfig(AGENT_ID).permissionMode).toBe("bypass");

    const toClaude = await patchAgent(app, AGENT_ID, uiSwitchBody("claude_local"));
    expect(toClaude.status, JSON.stringify(toClaude.body)).toBe(200);
    expect(storedEnv(AGENT_ID).CLAUDE_CODE_OAUTH_TOKEN).toEqual(claudeTokenRef);
    expect(storedEnv(AGENT_ID).CLAUDE_CONFIG_DIR).toEqual(plain("/home/op/.claude-seat"));
    expect(storedEnv(AGENT_ID).HOME).toEqual(plain("/home/op/claude-work"));
    expect(storedEnv(AGENT_ID)).not.toHaveProperty("GROK_HOME");
    expect(storedConfig(AGENT_ID).model).toBe("claude-model-x");
    expect(storedConfig(AGENT_ID)).toMatchObject(bundleKeys);
    expect(mockLogActivity).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ details: expect.objectContaining({ adapterSwitchConfigSource: "agent_profile" }) }),
    );
  });

  it("C: 'save as company default' stores real values server-side and a first switch applies it", async () => {
    seedAgent({
      id: OTHER_AGENT_ID,
      adapterType: "claude_local",
      adapterConfig: {
        env: {
          HOME: plain("/home/op/claude-work"),
          CLAUDE_CONFIG_DIR: plain("/home/op/.claude-seat"),
          CLAUDE_CODE_OAUTH_TOKEN: claudeTokenRef,
        },
        model: "claude-model-x",
        cwd: "/work/other-seat",
        paperclipSkillSync: { desiredSkills: ["other-seat-skill"] },
        instructionsFilePath: "/run/other/AGENTS.md",
        instructionsRootPath: "/run/other",
        instructionsEntryFile: "AGENTS.md",
        instructionsBundleMode: "external",
      },
    });
    seedAgent({ id: AGENT_ID, adapterType: "grok_local", adapterConfig: { ...grokSeatConfig(), cwd: "/work/this-seat" } });
    const app = await createApp();

    const saved = await request(app).post(`/api/agents/${OTHER_AGENT_ID}/adapter-config/save-as-company-default`).send({});
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const stored = mockAdapterConfigProfiles.companyDefaults.get("company-1:claude_local")!;
    expect(stored.env).toEqual({
      HOME: plain("/home/op/claude-work"),
      CLAUDE_CONFIG_DIR: plain("/home/op/.claude-seat"),
      CLAUDE_CODE_OAUTH_TOKEN: claudeTokenRef,
    });
    expect(JSON.stringify(stored)).not.toContain(REDACTED);
    // Seat-owned keys are not part of a company default.
    expect(stored).not.toHaveProperty("cwd");
    expect(stored).not.toHaveProperty("paperclipSkillSync");
    expect(stored).not.toHaveProperty("instructionsFilePath");
    // The response carries key names only.
    expect(saved.body).toEqual({
      adapterType: "claude_local",
      savedKeys: ["env", "model"],
      envKeys: ["CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CONFIG_DIR", "HOME"],
    });
    expect(JSON.stringify(saved.body)).not.toContain("/home/op");

    const res = await patchAgent(app, AGENT_ID, uiSwitchBody("claude_local"));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(storedEnv(AGENT_ID)).toEqual({
      HTTPS_PROXY: plain("http://127.0.0.1:7890"),
      http_proxy: plain("http://127.0.0.1:7890"),
      NO_PROXY: plain("localhost,127.0.0.1"),
      HOME: plain("/home/op/claude-work"),
      CLAUDE_CONFIG_DIR: plain("/home/op/.claude-seat"),
      CLAUDE_CODE_OAUTH_TOKEN: claudeTokenRef,
    });
    expect(storedConfig(AGENT_ID).model).toBe("claude-model-x");
    expect(storedConfig(AGENT_ID).cwd).toBe("/work/this-seat");
    expect(storedConfig(AGENT_ID).paperclipSkillSync).toEqual(skillSync);
    expect(storedConfig(AGENT_ID)).toMatchObject(bundleKeys);
    expect(mockLogActivity).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ details: expect.objectContaining({ adapterSwitchConfigSource: "company_default" }) }),
    );
  });

  it("C2: only a board user can save a company default", async () => {
    seedAgent({ id: OTHER_AGENT_ID, adapterType: "claude_local", adapterConfig: { env: { HOME: plain("/h") } } });
    actorState.type = "agent";
    const app = await createApp();
    const res = await request(app).post(`/api/agents/${OTHER_AGENT_ID}/adapter-config/save-as-company-default`).send({});
    expect(res.status).toBe(403);
    expect(mockAdapterConfigProfiles.companyDefaults.size).toBe(0);
  });

  it("an unauthorized switch writes no profile and changes nothing", async () => {
    // No external instructions bundle, so the request reaches the switch
    // branch and is denied only by the update authorization.
    const { instructionsBundleMode: _m, instructionsRootPath: _r, instructionsEntryFile: _e, instructionsFilePath: _f, ...seat } = grokSeatConfig();
    seedAgent({ id: AGENT_ID, adapterType: "grok_local", adapterConfig: seat });
    mockAccessService.decide.mockImplementation(async ({ action }: { action: string }) => ({
      allowed: action !== "agent_config:update",
      reason: "test",
      explanation: "Update denied",
    }));
    const app = await createApp();

    const res = await patchAgent(app, AGENT_ID, uiSwitchBody("claude_local"));

    expect(res.status).toBe(403);
    expect(mockAdapterConfigProfiles.service.saveAgentProfile).not.toHaveBeenCalled();
    expect(mockAdapterConfigProfiles.agentProfiles.size).toBe(0);
    expect(agentRows.get(AGENT_ID)!.adapterType).toBe("grok_local");
  });

  it("D: with no profile and no company default, env keeps only the portable allowlist", async () => {
    seedAgent({
      id: AGENT_ID,
      adapterType: "grok_local",
      adapterConfig: {
        ...grokSeatConfig(),
        env: {
          HOME: plain("/home/op/grok-work"),
          GROK_HOME: plain("/home/op/.grok"),
          CLAUDE_CODE_OAUTH_TOKEN: claudeTokenRef,
          FOO_TOKEN: plain("not-portable"),
          HTTP_PROXY: plain("http://127.0.0.1:7890"),
          HTTPS_PROXY: plain("http://127.0.0.1:7890"),
          https_proxy: plain("http://127.0.0.1:7890"),
          NO_PROXY: plain("localhost"),
          no_proxy: plain("localhost"),
          ALL_PROXY: plain("socks5://127.0.0.1:7891"),
          LANG: plain("zh_CN.UTF-8"),
          TZ: plain("Asia/Shanghai"),
        },
      },
    });
    const app = await createApp();

    const res = await patchAgent(app, AGENT_ID, uiSwitchBody("codex_local"));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(Object.keys(storedEnv(AGENT_ID)).sort()).toEqual([
      "ALL_PROXY",
      "HTTPS_PROXY",
      "HTTP_PROXY",
      "LANG",
      "NO_PROXY",
      "TZ",
      "https_proxy",
      "no_proxy",
    ]);
  });

  it("D2: explicit env keys in a switch request win; echoed old values and redacted placeholders do not", async () => {
    seedAgent({ id: AGENT_ID, adapterType: "grok_local", adapterConfig: grokSeatConfig() });
    const app = await createApp();

    const res = await patchAgent(app, AGENT_ID, {
      adapterType: "codex_local",
      adapterConfig: {
        env: {
          HOME: plain(REDACTED),
          GROK_HOME: plain("/home/op/.grok"),
          CODEX_HOME: plain("/home/op/.codex-seat"),
        },
        model: "codex-model-y",
      },
      replaceAdapterConfig: true,
    });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(storedEnv(AGENT_ID)).toEqual({
      HTTPS_PROXY: plain("http://127.0.0.1:7890"),
      http_proxy: plain("http://127.0.0.1:7890"),
      NO_PROXY: plain("localhost,127.0.0.1"),
      CODEX_HOME: plain("/home/op/.codex-seat"),
    });
    expect(storedConfig(AGENT_ID).model).toBe("codex-model-y");
  });

  it("E: a PATCH that keeps the adapter merges as before and saves no profile", async () => {
    seedAgent({ id: AGENT_ID, adapterType: "grok_local", adapterConfig: grokSeatConfig() });
    const app = await createApp();

    const merged = await patchAgent(app, AGENT_ID, { adapterConfig: { model: "grok-5" } });
    expect(merged.status, JSON.stringify(merged.body)).toBe(200);
    expect(storedConfig(AGENT_ID)).toEqual({ ...grokSeatConfig(), model: "grok-5" });

    // The UI's same-adapter save: full config with redacted env placeholders.
    const replaced = await patchAgent(app, AGENT_ID, {
      adapterConfig: {
        ...grokSeatConfig(),
        env: { HOME: plain(REDACTED), GROK_HOME: plain(REDACTED), HTTPS_PROXY: plain(REDACTED) },
        model: "grok-6",
      },
      replaceAdapterConfig: true,
    });
    expect(replaced.status, JSON.stringify(replaced.body)).toBe(200);
    expect(storedEnv(AGENT_ID)).toEqual({
      HOME: plain("/home/op/grok-work"),
      GROK_HOME: plain("/home/op/.grok"),
      HTTPS_PROXY: plain("http://127.0.0.1:7890"),
    });
    expect(storedConfig(AGENT_ID).model).toBe("grok-6");
    expect(mockAdapterConfigProfiles.service.saveAgentProfile).not.toHaveBeenCalled();
  });

  it("F: test-environment for a prospective switch probes the switched config, not the leaving env", async () => {
    seedAgent({ id: AGENT_ID, adapterType: "grok_local", adapterConfig: grokSeatConfig() });
    mockAdapterConfigProfiles.agentProfiles.set(`${AGENT_ID}:switch_probe_test`, {
      env: { PROBE_HOME: plain("/home/op/probe-seat") },
      model: "probe-model",
      ...bundleKeys,
      instructionsFilePath: "/stale/AGENTS.md",
    });
    const app = await createApp();

    // What the UI sends: the saved (redacted) config plus the switch overlay.
    const res = await request(app)
      .post("/api/companies/company-1/adapters/switch_probe_test/test-environment")
      .send({
        agentId: AGENT_ID,
        adapterConfig: {
          ...grokSeatConfig(),
          env: {
            HOME: plain(REDACTED),
            GROK_HOME: plain(REDACTED),
            HTTPS_PROXY: plain(REDACTED),
            http_proxy: plain(REDACTED),
            NO_PROXY: plain(REDACTED),
          },
          model: "",
        },
      });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(probeSpy).toHaveBeenCalledTimes(1);
    const probed = probeSpy.mock.calls[0]![0].config as Record<string, unknown>;
    expect(probed.env).toEqual({
      HTTPS_PROXY: plain("http://127.0.0.1:7890"),
      http_proxy: plain("http://127.0.0.1:7890"),
      NO_PROXY: plain("localhost,127.0.0.1"),
      PROBE_HOME: plain("/home/op/probe-seat"),
    });
    expect(probed.model).toBe("probe-model");
    expect(probed).not.toHaveProperty("permissionMode");
    expect(probed.instructionsFilePath).toBe(bundleKeys.instructionsFilePath);
    // A probe never saves a profile.
    expect(mockAdapterConfigProfiles.service.saveAgentProfile).not.toHaveBeenCalled();
  });

  it("F2: test-environment for the agent's own adapter uses its saved env when the request omits env", async () => {
    seedAgent({
      id: AGENT_ID,
      adapterType: "switch_probe_test",
      adapterConfig: { env: { PROBE_HOME: plain("/home/op/probe-seat"), HTTPS_PROXY: plain("http://127.0.0.1:7890") }, model: "m1" },
    });
    const app = await createApp();

    const res = await request(app)
      .post("/api/companies/company-1/adapters/switch_probe_test/test-environment")
      .send({ agentId: AGENT_ID, adapterConfig: { model: "m2" } });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const probed = probeSpy.mock.calls[0]![0].config as Record<string, unknown>;
    expect(probed.env).toEqual({ PROBE_HOME: plain("/home/op/probe-seat"), HTTPS_PROXY: plain("http://127.0.0.1:7890") });
    expect(probed.model).toBe("m2");
  });

  it("restoring a Claude profile that holds the fixed OAuth binding applies the stored login for a board user", async () => {
    seedAgent({ id: AGENT_ID, adapterType: "grok_local", adapterConfig: grokSeatConfig() });
    mockAdapterConfigProfiles.agentProfiles.set(`${AGENT_ID}:claude_local`, {
      env: { CLAUDE_CODE_OAUTH_TOKEN: fixedClaudeOAuthBinding, CLAUDE_CONFIG_DIR: plain("/home/op/.claude-seat") },
      model: "claude-model-x",
    });
    const app = await createApp();

    const res = await patchAgent(app, AGENT_ID, uiSwitchBody("claude_local"));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(storedEnv(AGENT_ID).CLAUDE_CODE_OAUTH_TOKEN).toEqual(fixedClaudeOAuthBinding);
    const options = mockAgentService.update.mock.calls.at(-1)?.[2] as { claudeLogin?: Record<string, unknown> };
    expect(options.claudeLogin).toMatchObject({ ownerUserId: "local-board", applyExistingWithoutClaim: true });
  });

  it("a switch that restores no OAuth binding does not apply a stored login", async () => {
    seedAgent({ id: AGENT_ID, adapterType: "grok_local", adapterConfig: grokSeatConfig() });
    const app = await createApp();

    const res = await patchAgent(app, AGENT_ID, uiSwitchBody("claude_local"));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const options = mockAgentService.update.mock.calls.at(-1)?.[2] as { claudeLogin?: Record<string, unknown> };
    expect(options.claudeLogin).toMatchObject({ applyExistingWithoutClaim: false });
  });
});
