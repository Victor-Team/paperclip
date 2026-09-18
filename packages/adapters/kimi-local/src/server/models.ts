import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterModel } from "@paperclipai/adapter-utils";

const MODELS_CACHE_TTL_MS = 60_000;

/**
 * Kimi has no `models` subcommand: the CLI resolves model aliases straight from
 * its own config.toml. Anything the user configured there is usable, while the
 * adapter's static `models` list only covers the kimi-code subscription lane.
 * Without this discovery the UI shows three hard-coded entries and every
 * self-configured provider model is invisible.
 *
 * Note the id shape differs per lane and is NOT provider-prefixed here:
 *   subscription lane -> "kimi-code/k3"
 *   config.toml lane  -> "glm-5.3"        (verified: `kimi -m volcengine-agent/glm-5.3`
 *                                          fails with "is not configured in config.toml")
 */
function kimiConfigPath(): string {
  const home = process.env.KIMI_CODE_HOME?.trim() || path.join(os.homedir(), ".kimi-code");
  return path.join(home, "config.toml");
}

/** Minimal TOML slice: we only need the `[models.*]` table headers plus display_name. */
export function parseKimiConfigModels(toml: string): AdapterModel[] {
  const out: AdapterModel[] = [];
  const seen = new Set<string>();
  // Matches `[models.name]` and `[models."quoted.name"]`, capturing until the next table header.
  const blockRe = /^\[models\.("?)([^\]"]+)\1\]\s*$([\s\S]*?)(?=^\[|\z)/gm;
  for (const match of toml.matchAll(blockRe)) {
    const id = match[2]?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const body = match[3] ?? "";
    const display = /^\s*display_name\s*=\s*"([^"]*)"/m.exec(body)?.[1]?.trim();
    out.push({ id, label: display || id });
  }
  return out;
}

let cache: { at: number; models: AdapterModel[] } | null = null;

export async function discoverKimiModels(): Promise<AdapterModel[]> {
  let raw: string;
  try {
    raw = await fs.readFile(kimiConfigPath(), "utf8");
  } catch {
    return [];
  }
  return parseKimiConfigModels(raw);
}

export async function discoverKimiModelsCached(): Promise<AdapterModel[]> {
  const now = Date.now();
  if (cache && now - cache.at < MODELS_CACHE_TTL_MS) return cache.models;
  const models = await discoverKimiModels();
  // Only cache successful discovery so a transient read failure is retried immediately.
  if (models.length > 0) cache = { at: now, models };
  return models;
}

export async function listKimiModels(): Promise<AdapterModel[]> {
  try {
    return await discoverKimiModelsCached();
  } catch {
    return [];
  }
}

export function resetKimiModelsCacheForTests() {
  cache = null;
}
