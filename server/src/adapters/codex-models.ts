import { spawnSync } from "node:child_process";
import type { AdapterModel } from "./types.js";
import { models as codexFallbackModels } from "@paperclipai/adapter-codex-local";
import { readConfigFile } from "../config-file.js";

const OPENAI_MODELS_ENDPOINT = "https://api.openai.com/v1/models";
const OPENAI_MODELS_TIMEOUT_MS = 5000;
const OPENAI_MODELS_CACHE_TTL_MS = 60_000;

let cached: { keyFingerprint: string; expiresAt: number; models: AdapterModel[] } | null = null;

// The installed Codex CLI ships its own model catalog (`codex debug models`). Reading it lets the
// model dropdown follow CLI upgrades without a Paperclip release — subscription logins have no
// OPENAI_API_KEY, so the API listing below is usually unavailable.
const CODEX_CLI_MODELS_TIMEOUT_MS = 15_000;
const CODEX_CLI_MODELS_CACHE_TTL_MS = 10 * 60_000;
const CODEX_CLI_MAX_BUFFER_BYTES = 32 * 1024 * 1024;

type CodexModelsCommandResult = { status: number | null; stdout: string; hasError: boolean };

let cliCached: { expiresAt: number; models: AdapterModel[] } | null = null;

function defaultCodexModelsRunner(): CodexModelsCommandResult {
  const command = process.env.PAPERCLIP_CODEX_COMMAND?.trim() || "codex";
  const result = spawnSync(command, ["debug", "models"], {
    encoding: "utf8",
    timeout: CODEX_CLI_MODELS_TIMEOUT_MS,
    maxBuffer: CODEX_CLI_MAX_BUFFER_BYTES,
  });
  return {
    status: result.status,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    hasError: Boolean(result.error),
  };
}

let codexModelsRunner: () => CodexModelsCommandResult = defaultCodexModelsRunner;

/** Parses `codex debug models` JSON; keeps only user-visible entries, in the CLI's priority order. */
export function parseCodexCliModelsOutput(stdout: string): AdapterModel[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    return [];
  }
  const list = (parsed as { models?: unknown })?.models;
  if (!Array.isArray(list)) return [];
  const entries: { model: AdapterModel; priority: number; index: number }[] = [];
  list.forEach((item, index) => {
    if (typeof item !== "object" || item === null) return;
    const rec = item as { slug?: unknown; display_name?: unknown; visibility?: unknown; priority?: unknown };
    if (typeof rec.slug !== "string" || rec.slug.trim().length === 0) return;
    if (rec.visibility !== undefined && rec.visibility !== "list") return;
    const label = typeof rec.display_name === "string" && rec.display_name.trim() ? rec.display_name : rec.slug;
    const priority = typeof rec.priority === "number" ? rec.priority : Number.MAX_SAFE_INTEGER;
    entries.push({ model: { id: rec.slug.trim(), label: label.trim() }, priority, index });
  });
  entries.sort((a, b) => a.priority - b.priority || a.index - b.index);
  return dedupeModels(entries.map((entry) => entry.model));
}

function loadCodexCliModels(forceRefresh: boolean): AdapterModel[] {
  const now = Date.now();
  if (!forceRefresh && cliCached && cliCached.expiresAt > now) return cliCached.models;
  const result = codexModelsRunner();
  const models = result.hasError || (result.status ?? 1) !== 0 ? [] : parseCodexCliModelsOutput(result.stdout);
  if (models.length > 0) {
    cliCached = { expiresAt: now + CODEX_CLI_MODELS_CACHE_TTL_MS, models };
    return models;
  }
  return cliCached?.models ?? [];
}

function fingerprint(apiKey: string): string {
  return `${apiKey.length}:${apiKey.slice(-6)}`;
}

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: model.label.trim() || id });
  }
  return deduped;
}

function mergedWithFallback(models: AdapterModel[]): AdapterModel[] {
  return dedupeModels([
    ...models,
    ...codexFallbackModels,
  ]).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true, sensitivity: "base" }));
}

function resolveOpenAiApiKey(): string | null {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return envKey;

  const config = readConfigFile();
  if (config?.llm?.provider !== "openai") return null;
  const configKey = config.llm.apiKey?.trim();
  return configKey && configKey.length > 0 ? configKey : null;
}

async function fetchOpenAiModels(apiKey: string): Promise<AdapterModel[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_MODELS_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_MODELS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { data?: unknown };
    const data = Array.isArray(payload.data) ? payload.data : [];
    const models: AdapterModel[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const id = (item as { id?: unknown }).id;
      if (typeof id !== "string" || id.trim().length === 0) continue;
      models.push({ id, label: id });
    }
    return dedupeModels(models);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function loadCodexModels(options?: { forceRefresh?: boolean }): Promise<AdapterModel[]> {
  const forceRefresh = options?.forceRefresh === true;
  const cliModels = loadCodexCliModels(forceRefresh);
  const apiModels = await loadOpenAiModels(forceRefresh);
  // CLI catalog first (what the installed CLI can actually run, in its priority order), then
  // API-discovered ids, then the static list so long-standing aliases never disappear.
  return dedupeModels([...cliModels, ...(apiModels ?? codexFallbackModels)]);
}

async function loadOpenAiModels(forceRefresh: boolean): Promise<AdapterModel[] | null> {
  const apiKey = resolveOpenAiApiKey();
  const fallback = dedupeModels(codexFallbackModels);
  if (!apiKey) return null;

  const now = Date.now();
  const keyFingerprint = fingerprint(apiKey);
  if (!forceRefresh && cached && cached.keyFingerprint === keyFingerprint && cached.expiresAt > now) {
    return cached.models;
  }

  const fetched = await fetchOpenAiModels(apiKey);
  if (fetched.length > 0) {
    const merged = mergedWithFallback(fetched);
    cached = {
      keyFingerprint,
      expiresAt: now + OPENAI_MODELS_CACHE_TTL_MS,
      models: merged,
    };
    return merged;
  }

  if (cached && cached.keyFingerprint === keyFingerprint && cached.models.length > 0) {
    return cached.models;
  }

  return fallback;
}

export async function listCodexModels(): Promise<AdapterModel[]> {
  return loadCodexModels();
}

export async function refreshCodexModels(): Promise<AdapterModel[]> {
  return loadCodexModels({ forceRefresh: true });
}

export function resetCodexModelsCacheForTests() {
  cached = null;
  cliCached = null;
}

export function setCodexModelsRunnerForTests(runner: (() => CodexModelsCommandResult) | null) {
  codexModelsRunner = runner ?? defaultCodexModelsRunner;
}
