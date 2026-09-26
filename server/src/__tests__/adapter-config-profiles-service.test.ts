import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agentAdapterConfigProfiles,
  agents,
  companies,
  companySecretBindings,
  companySecretProviderConfigs,
  companySecretVersions,
  companySecrets,
  createDb,
  userSecretDeclarations,
  userSecretDefinitions,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { adapterConfigProfileService } from "../services/adapter-config-profiles.ts";
import { agentService } from "../services/agents.ts";
import { CLAUDE_OAUTH_CLAIM_REJECTED, secretService } from "../services/secrets.js";

// Ledger #19: the server-owned per-adapter profile table, against real
// Postgres (partial unique indexes, upsert targets, cascade), and the
// grok -> claude_local restore of the fixed Claude OAuth binding through the
// real agent service invariant.

const FIXED_BINDING = { type: "user_secret_ref", key: "CLAUDE_CODE_OAUTH_TOKEN" } as const;

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

describe("embedded postgres availability for adapter profile tests", () => {
  it("runs on this host (no silent skip)", () => {
    expect(embeddedPostgresSupport.supported, embeddedPostgresSupport.reason ?? "").toBe(true);
  });
});

describeEmbeddedPostgres("adapter config profile service", () => {
  let stopDb: (() => Promise<void>) | null = null;
  let db!: ReturnType<typeof createDb>;
  const previousKeyFile = process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE;
  const secretsTmpDir = path.join(os.tmpdir(), `paperclip-adapter-profiles-${randomUUID()}`);

  beforeAll(async () => {
    mkdirSync(secretsTmpDir, { recursive: true });
    process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE = path.join(secretsTmpDir, "master.key");
    const started = await startEmbeddedPostgresTestDatabase("adapter-config-profiles");
    stopDb = started.cleanup;
    db = createDb(started.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(agentAdapterConfigProfiles);
    await db.delete(activityLog);
    await db.delete(companySecretBindings);
    await db.delete(companySecretVersions);
    await db.delete(companySecrets);
    await db.delete(companySecretProviderConfigs);
    await db.delete(userSecretDeclarations);
    await db.delete(userSecretDefinitions);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await stopDb?.();
    if (previousKeyFile === undefined) delete process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE;
    else process.env.PAPERCLIP_SECRETS_MASTER_KEY_FILE = previousKeyFile;
    rmSync(secretsTmpDir, { recursive: true, force: true });
  });

  async function seedCompany(): Promise<string> {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    return companyId;
  }

  async function seedAgent(companyId: string, adapterType: string, adapterConfig: Record<string, unknown>) {
    return agentService(db).create(companyId, {
      name: `Agent ${randomUUID().slice(0, 6)}`,
      role: "engineer",
      status: "idle",
      adapterType,
      adapterConfig,
      runtimeConfig: {},
      spentMonthlyCents: 0,
      lastHeartbeatAt: null,
    });
  }

  it("keeps one profile per agent and adapter, upserts in place, and separates company defaults", async () => {
    const companyId = await seedCompany();
    const agent = await seedAgent(companyId, "grok_local", {});
    const profiles = adapterConfigProfileService(db);
    const grokV1 = { env: { HOME: { type: "plain", value: "/h1" } }, model: "grok-a" };
    const grokV2 = { env: { HOME: { type: "plain", value: "/h2" } }, model: "grok-b" };
    const claudeDefault = { env: { CLAUDE_CONFIG_DIR: { type: "plain", value: "/c" } }, model: "claude-a" };

    expect(await profiles.getAgentProfile(agent.id, "grok_local")).toBeNull();
    await profiles.saveAgentProfile({ companyId, agentId: agent.id, adapterType: "grok_local", adapterConfig: grokV1 });
    await profiles.saveAgentProfile({ companyId, agentId: agent.id, adapterType: "grok_local", adapterConfig: grokV2 });
    await profiles.saveCompanyDefault({ companyId, adapterType: "claude_local", adapterConfig: claudeDefault, updatedByUserId: "u1" });
    await profiles.saveCompanyDefault({ companyId, adapterType: "claude_local", adapterConfig: { ...claudeDefault, model: "claude-b" }, updatedByUserId: "u2" });

    expect(await profiles.getAgentProfile(agent.id, "grok_local")).toEqual(grokV2);
    expect(await profiles.getAgentProfile(agent.id, "claude_local")).toBeNull();
    expect(await profiles.getCompanyDefault(companyId, "claude_local")).toEqual({ ...claudeDefault, model: "claude-b" });
    expect(await profiles.getCompanyDefault(companyId, "grok_local")).toBeNull();
    const rows = await db.select().from(agentAdapterConfigProfiles);
    expect(rows).toHaveLength(2);
  });

  it("a company default saved from agentService.getById holds real env values, not redaction markers", async () => {
    const companyId = await seedCompany();
    const agent = await seedAgent(companyId, "claude_local", {
      env: { CLAUDE_CONFIG_DIR: { type: "plain", value: "/home/op/.claude-seat" }, HOME: { type: "plain", value: "/home/op/claude-work" } },
      model: "claude-a",
    });
    const read = await agentService(db).getById(agent.id);
    const profiles = adapterConfigProfileService(db);
    await profiles.saveCompanyDefault({
      companyId,
      adapterType: "claude_local",
      adapterConfig: read!.adapterConfig as Record<string, unknown>,
      updatedByUserId: "u1",
    });

    const stored = await profiles.getCompanyDefault(companyId, "claude_local");
    expect(stored?.env).toEqual({
      CLAUDE_CONFIG_DIR: { type: "plain", value: "/home/op/.claude-seat" },
      HOME: { type: "plain", value: "/home/op/claude-work" },
    });
    expect(JSON.stringify(stored)).not.toContain("***REDACTED***");
  });

  it("deletes an agent's profiles with the agent", async () => {
    const companyId = await seedCompany();
    const agent = await seedAgent(companyId, "grok_local", {});
    const profiles = adapterConfigProfileService(db);
    await profiles.saveAgentProfile({ companyId, agentId: agent.id, adapterType: "grok_local", adapterConfig: { model: "x" } });

    await db.delete(agents);

    expect(await db.select().from(agentAdapterConfigProfiles)).toHaveLength(0);
  });

  it("restores the fixed Claude OAuth binding on a grok -> claude_local switch only via the apply-existing path", async () => {
    const companyId = await seedCompany();
    const ownerUserId = `user-${randomUUID().slice(0, 8)}`;
    await secretService(db).completeClaudeOAuthUserSecret(companyId, ownerUserId, {
      sessionId: randomUUID(),
      mode: "first_write",
      value: "sk-owner-token",
    });
    const agent = await seedAgent(companyId, "grok_local", { env: { HOME: { type: "plain", value: "/g" } } });
    const restored = { env: { CLAUDE_CODE_OAUTH_TOKEN: { ...FIXED_BINDING } }, model: "claude-a" };

    await expect(
      agentService(db).update(agent.id, { adapterType: "claude_local", adapterConfig: restored }, {
        claudeLogin: { ownerUserId, applyExistingWithoutClaim: false },
      }),
    ).rejects.toMatchObject({ message: CLAUDE_OAUTH_CLAIM_REJECTED });

    const updated = await agentService(db).update(agent.id, { adapterType: "claude_local", adapterConfig: restored }, {
      claudeLogin: { ownerUserId, applyExistingWithoutClaim: true },
    });
    expect(updated?.adapterType).toBe("claude_local");
    expect((updated?.adapterConfig as { env: Record<string, unknown> }).env.CLAUDE_CODE_OAUTH_TOKEN).toMatchObject(FIXED_BINDING);
  });
});
