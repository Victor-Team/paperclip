import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentAdapterConfigProfiles } from "@paperclipai/db";

/**
 * Server-owned per-adapter configuration profiles (ledger #19).
 *
 * An agent's profile for adapter X is the adapterConfig it had while it ran on
 * X. The agent route saves it when the agent leaves X and restores it when the
 * agent switches back to X. A company default for X is used when an agent
 * switches to X without a profile of its own.
 *
 * Stored configs are the persisted adapterConfig as-is: env bindings stay
 * plain/secret_ref/user_secret_ref objects and are never resolved here. This
 * service never returns stored values to HTTP clients; routes only report
 * which keys were saved.
 */
export interface AdapterConfigProfileService {
  getAgentProfile(agentId: string, adapterType: string): Promise<Record<string, unknown> | null>;
  saveAgentProfile(input: {
    companyId: string;
    agentId: string;
    adapterType: string;
    adapterConfig: Record<string, unknown>;
  }): Promise<void>;
  getCompanyDefault(companyId: string, adapterType: string): Promise<Record<string, unknown> | null>;
  saveCompanyDefault(input: {
    companyId: string;
    adapterType: string;
    adapterConfig: Record<string, unknown>;
    updatedByUserId: string | null;
  }): Promise<void>;
}

function asConfig(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function adapterConfigProfileService(db: Db): AdapterConfigProfileService {
  const t = agentAdapterConfigProfiles;
  return {
    async getAgentProfile(agentId, adapterType) {
      const row = await db
        .select({ adapterConfig: t.adapterConfig })
        .from(t)
        .where(and(eq(t.agentId, agentId), eq(t.adapterType, adapterType)))
        .then((rows) => rows[0] ?? null);
      return asConfig(row?.adapterConfig);
    },

    async saveAgentProfile(input) {
      const now = new Date();
      await db
        .insert(t)
        .values({
          companyId: input.companyId,
          agentId: input.agentId,
          adapterType: input.adapterType,
          adapterConfig: input.adapterConfig,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [t.agentId, t.adapterType],
          targetWhere: sql`${t.agentId} IS NOT NULL`,
          set: { adapterConfig: input.adapterConfig, updatedAt: now },
        });
    },

    async getCompanyDefault(companyId, adapterType) {
      const row = await db
        .select({ adapterConfig: t.adapterConfig })
        .from(t)
        .where(and(eq(t.companyId, companyId), isNull(t.agentId), eq(t.adapterType, adapterType)))
        .then((rows) => rows[0] ?? null);
      return asConfig(row?.adapterConfig);
    },

    async saveCompanyDefault(input) {
      const now = new Date();
      await db
        .insert(t)
        .values({
          companyId: input.companyId,
          agentId: null,
          adapterType: input.adapterType,
          adapterConfig: input.adapterConfig,
          updatedByUserId: input.updatedByUserId,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [t.companyId, t.adapterType],
          targetWhere: sql`${t.agentId} IS NULL`,
          set: {
            adapterConfig: input.adapterConfig,
            updatedByUserId: input.updatedByUserId,
            updatedAt: now,
          },
        });
    },
  };
}
