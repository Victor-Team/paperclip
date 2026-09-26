import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { agents } from "./agents.js";
import { companies } from "./companies.js";

/**
 * Per-adapter configuration profiles, server-owned.
 *
 * - A row with `agent_id` set is one agent's saved configuration for one
 *   adapter type. The server writes it when the agent leaves that adapter, and
 *   restores it when the agent switches back.
 * - A row with `agent_id` null is the company default for that adapter type. It
 *   is used when an agent switches to an adapter it has no saved profile for.
 *
 * `adapter_config` holds the persisted adapter config as-is (env bindings stay
 * secret references or plain bindings; nothing is resolved). It lives in its
 * own table, not in agents.runtime_config/metadata, because agent rows are
 * returned to clients without redacting those columns, clients round-trip
 * them, and metadata PATCHes replace the whole object.
 */
export const agentAdapterConfigProfiles = pgTable(
  "agent_adapter_config_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    adapterType: text("adapter_type").notNull(),
    adapterConfig: jsonb("adapter_config").$type<Record<string, unknown>>().notNull().default({}),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("agent_adapter_config_profiles_company_idx").on(table.companyId),
    agentAdapterUq: uniqueIndex("agent_adapter_config_profiles_agent_adapter_uq")
      .on(table.agentId, table.adapterType)
      .where(sql`${table.agentId} IS NOT NULL`),
    companyDefaultUq: uniqueIndex("agent_adapter_config_profiles_company_default_uq")
      .on(table.companyId, table.adapterType)
      .where(sql`${table.agentId} IS NULL`),
  }),
);
