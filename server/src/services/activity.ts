import { executionProjectionsForRuns } from "./execution-projection.js";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  activityLog,
  agents,
  documentRevisions,
  environmentLeases,
  environments,
  heartbeatRunEvents,
  heartbeatRuns,
  issueComments,
  issueDocuments,
  issues,
  issueWorkProducts,
  workspaceOperations,
} from "@paperclipai/db";
import { ISSUE_CONTINUATION_SUMMARY_DOCUMENT_KEY } from "@paperclipai/shared";
import { logger } from "../middleware/logger.js";
import { visibleIssueCondition } from "./issue-visibility.js";
import { classifyRunLiveness } from "./run-liveness.js";

export interface ActivityFilters {
  companyId: string;
  agentId?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}

const DEFAULT_ACTIVITY_LIMIT = 100;
const MAX_ACTIVITY_LIMIT = 500;

export function normalizeActivityLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) return DEFAULT_ACTIVITY_LIMIT;
  return Math.max(1, Math.min(MAX_ACTIVITY_LIMIT, Math.floor(limit ?? DEFAULT_ACTIVITY_LIMIT)));
}

export function activityService(db: Db) {
  const scheduledLivenessBackfills = new Set<string>();
  const issueIdAsText = sql<string>`${issues.id}::text`;
  const summarizedUsageJson = sql<Record<string, unknown> | null>`
    case
      when ${heartbeatRuns.usageJson} is null then null
      else jsonb_strip_nulls(jsonb_build_object(
        'inputTokens', coalesce(${heartbeatRuns.usageJson} -> 'inputTokens', ${heartbeatRuns.usageJson} -> 'input_tokens'),
        'input_tokens', coalesce(${heartbeatRuns.usageJson} -> 'input_tokens', ${heartbeatRuns.usageJson} -> 'inputTokens'),
        'outputTokens', coalesce(${heartbeatRuns.usageJson} -> 'outputTokens', ${heartbeatRuns.usageJson} -> 'output_tokens'),
        'output_tokens', coalesce(${heartbeatRuns.usageJson} -> 'output_tokens', ${heartbeatRuns.usageJson} -> 'outputTokens'),
        'cachedInputTokens', coalesce(
          ${heartbeatRuns.usageJson} -> 'cachedInputTokens',
          ${heartbeatRuns.usageJson} -> 'cached_input_tokens',
          ${heartbeatRuns.usageJson} -> 'cache_read_input_tokens'
        ),
        'cached_input_tokens', coalesce(
          ${heartbeatRuns.usageJson} -> 'cached_input_tokens',
          ${heartbeatRuns.usageJson} -> 'cachedInputTokens',
          ${heartbeatRuns.usageJson} -> 'cache_read_input_tokens'
        ),
        'cache_read_input_tokens', coalesce(
          ${heartbeatRuns.usageJson} -> 'cache_read_input_tokens',
          ${heartbeatRuns.usageJson} -> 'cached_input_tokens',
          ${heartbeatRuns.usageJson} -> 'cachedInputTokens'
        ),
        'billingType', coalesce(${heartbeatRuns.usageJson} -> 'billingType', ${heartbeatRuns.usageJson} -> 'billing_type'),
        'billing_type', coalesce(${heartbeatRuns.usageJson} -> 'billing_type', ${heartbeatRuns.usageJson} -> 'billingType'),
        'costUsd', coalesce(
          ${heartbeatRuns.usageJson} -> 'costUsd',
          ${heartbeatRuns.usageJson} -> 'cost_usd',
          ${heartbeatRuns.usageJson} -> 'total_cost_usd'
        ),
        'cost_usd', coalesce(
          ${heartbeatRuns.usageJson} -> 'cost_usd',
          ${heartbeatRuns.usageJson} -> 'costUsd',
          ${heartbeatRuns.usageJson} -> 'total_cost_usd'
        ),
        'total_cost_usd', coalesce(
          ${heartbeatRuns.usageJson} -> 'total_cost_usd',
          ${heartbeatRuns.usageJson} -> 'cost_usd',
          ${heartbeatRuns.usageJson} -> 'costUsd'
        )
      ))
    end
  `.as("usageJson");
  // Summary fields of result_json: output name -> source keys in precedence order.
  const RESULT_SUMMARY_FIELDS: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["conversationReset", ["conversationReset"]],
    ["billingType", ["billingType", "billing_type"]],
    ["billing_type", ["billing_type", "billingType"]],
    ["costUsd", ["costUsd", "cost_usd", "total_cost_usd"]],
    ["cost_usd", ["cost_usd", "costUsd", "total_cost_usd"]],
    ["total_cost_usd", ["total_cost_usd", "cost_usd", "costUsd"]],
    ["stopReason", ["stopReason"]],
    ["effectiveTimeoutSec", ["effectiveTimeoutSec"]],
    ["effectiveTimeoutMs", ["effectiveTimeoutMs"]],
    ["timeoutConfigured", ["timeoutConfigured"]],
    ["timeoutSource", ["timeoutSource"]],
    ["timeoutFired", ["timeoutFired"]],
  ];
  const RESULT_SUMMARY_KEYS = [...new Set(RESULT_SUMMARY_FIELDS.flatMap(([, keys]) => keys))];
  const resultKey = (key: string) => sql.raw(`result_summary."${key}"`);
  // Same value as coalesce(result_json -> k1, result_json -> k2, ...).
  // jsonb_to_record turns a JSON null into SQL NULL, so a key holding JSON null
  // is told apart from a missing key (`?`) only when a later key has a value —
  // the one case where the two differ. The last key needs no check: JSON null
  // and SQL NULL both end up stripped from the summary.
  const resultSummaryValue = (keys: readonly string[]) => {
    if (keys.length === 1) return resultKey(keys[0]!);
    const branches = keys.map((key, index) => {
      const later = keys.slice(index + 1);
      if (later.length === 0) return sql`else ${resultKey(key)}`;
      return sql`when ${resultKey(key)} is not null then ${resultKey(key)}
        when coalesce(${sql.join(later.map(resultKey), sql`, `)}) is not null and result_source.obj ? ${key} then 'null'::jsonb`;
    });
    return sql`case ${sql.join(branches, sql` `)} end`;
  };
  // result_json can hold tens of KB per run, and every `->` re-reads
  // (de-TOASTs) the whole value: the previous ~25 `->` per row made
  // /issues/:id/runs take ~2s on an issue with ~470 runs. jsonb_to_record reads
  // every summary key in one pass. Non-object values summarize to '{}', exactly
  // as `->` on them yields NULL.
  const summarizedResultJson = sql<Record<string, unknown> | null>`
    case
      when ${heartbeatRuns.resultJson} is null then null
      else (
        select jsonb_strip_nulls(jsonb_build_object(${sql.join(
          RESULT_SUMMARY_FIELDS.map(([name, keys]) => sql`${sql.raw(`'${name}'`)}, ${resultSummaryValue(keys)}`),
          sql`, `,
        )}))
        from (
          select case
            when jsonb_typeof(${heartbeatRuns.resultJson}) = 'object' then ${heartbeatRuns.resultJson}
            else '{}'::jsonb
          end as obj
        ) as result_source
        cross join lateral jsonb_to_record(result_source.obj) as result_summary(${sql.raw(
          RESULT_SUMMARY_KEYS.map((key) => `"${key}" jsonb`).join(", "),
        )})
      )
    end
  `.as("resultJson");

  function countValue(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }

  function dateValue(value: unknown) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  function latestDate(...values: unknown[]) {
    let latest: Date | null = null;
    for (const value of values) {
      const parsed = dateValue(value);
      if (!parsed) continue;
      if (!latest || parsed.getTime() > latest.getTime()) latest = parsed;
    }
    return latest;
  }

  function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  function readNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  async function backfillMissingRunLivenessForIssue(companyId: string, issueId: string) {
    const runs = await db
      .select({
        id: heartbeatRuns.id,
        companyId: heartbeatRuns.companyId,
        status: heartbeatRuns.status,
        contextSnapshot: heartbeatRuns.contextSnapshot,
        resultJson: heartbeatRuns.resultJson,
        stdoutExcerpt: heartbeatRuns.stdoutExcerpt,
        stderrExcerpt: heartbeatRuns.stderrExcerpt,
        error: heartbeatRuns.error,
        errorCode: heartbeatRuns.errorCode,
        continuationAttempt: heartbeatRuns.continuationAttempt,
      })
      .from(heartbeatRuns)
      .where(
        and(
          eq(heartbeatRuns.companyId, companyId),
          isNull(heartbeatRuns.livenessState),
          sql`${heartbeatRuns.status} not in ('queued', 'running')`,
          or(
            sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issueId}`,
            sql`exists (
              select 1
              from ${activityLog}
              where ${activityLog.companyId} = ${companyId}
                and ${activityLog.entityType} = 'issue'
                and ${activityLog.entityId} = ${issueId}
                and ${activityLog.runId} = ${heartbeatRuns.id}
            )`,
          ),
        ),
      )
      .limit(20);

    if (runs.length === 0) return;

    const issue = await db
      .select({
        status: issues.status,
        title: issues.title,
        description: issues.description,
      })
      .from(issues)
      .where(and(eq(issues.companyId, companyId), eq(issues.id, issueId)))
      .then((rows) => rows[0] ?? null);

    for (const run of runs) {
      const context = asRecord(run.contextSnapshot);
      const continuationAttempt =
        readNumber(context?.continuationAttempt) ??
        readNumber(context?.livenessContinuationAttempt) ??
        run.continuationAttempt ??
        0;

      const [commentStats] = await db
        .select({
          count: sql<number>`count(*)::int`,
          latestAt: sql<Date | null>`max(${issueComments.createdAt})`,
        })
        .from(issueComments)
        .where(
          and(
            eq(issueComments.companyId, companyId),
            eq(issueComments.issueId, issueId),
            eq(issueComments.createdByRunId, run.id),
          ),
        );

      const [documentStats] = await db
        .select({
          count: sql<number>`count(*)::int`,
          planCount: sql<number>`count(*) filter (where ${issueDocuments.key} = 'plan')::int`,
          latestAt: sql<Date | null>`max(${documentRevisions.createdAt})`,
        })
        .from(documentRevisions)
        .innerJoin(issueDocuments, eq(documentRevisions.documentId, issueDocuments.documentId))
        .where(
          and(
            eq(documentRevisions.companyId, companyId),
            eq(documentRevisions.createdByRunId, run.id),
            eq(issueDocuments.companyId, companyId),
            eq(issueDocuments.issueId, issueId),
            sql`${issueDocuments.key} != ${ISSUE_CONTINUATION_SUMMARY_DOCUMENT_KEY}`,
          ),
        );

      const [workProductStats] = await db
        .select({
          count: sql<number>`count(*)::int`,
          latestAt: sql<Date | null>`max(${issueWorkProducts.createdAt})`,
        })
        .from(issueWorkProducts)
        .where(
          and(
            eq(issueWorkProducts.companyId, companyId),
            eq(issueWorkProducts.issueId, issueId),
            eq(issueWorkProducts.createdByRunId, run.id),
          ),
        );

      const [workspaceOperationStats] = await db
        .select({
          count: sql<number>`count(*)::int`,
          latestAt: sql<Date | null>`max(${workspaceOperations.startedAt})`,
        })
        .from(workspaceOperations)
        .where(and(eq(workspaceOperations.companyId, companyId), eq(workspaceOperations.heartbeatRunId, run.id)));

      const [activityStats] = await db
        .select({
          count: sql<number>`count(*)::int`,
          latestAt: sql<Date | null>`max(${activityLog.createdAt})`,
        })
        .from(activityLog)
        .where(and(eq(activityLog.companyId, companyId), eq(activityLog.runId, run.id)));

      const [eventStats] = await db
        .select({
          count: sql<number>`count(*) filter (where ${heartbeatRunEvents.eventType} not in ('lifecycle', 'adapter.invoke', 'error'))::int`,
          latestAt: sql<Date | null>`max(${heartbeatRunEvents.createdAt}) filter (where ${heartbeatRunEvents.eventType} not in ('lifecycle', 'adapter.invoke', 'error'))`,
        })
        .from(heartbeatRunEvents)
        .where(and(eq(heartbeatRunEvents.companyId, companyId), eq(heartbeatRunEvents.runId, run.id)));

      const classification = classifyRunLiveness({
        runStatus: run.status,
        issue,
        resultJson: asRecord(run.resultJson),
        stdoutExcerpt: run.stdoutExcerpt,
        stderrExcerpt: run.stderrExcerpt,
        error: run.error,
        errorCode: run.errorCode,
        continuationAttempt,
        evidence: {
          issueCommentsCreated: countValue(commentStats?.count),
          documentRevisionsCreated: countValue(documentStats?.count),
          planDocumentRevisionsCreated: countValue(documentStats?.planCount),
          workProductsCreated: countValue(workProductStats?.count),
          workspaceOperationsCreated: countValue(workspaceOperationStats?.count),
          activityEventsCreated: countValue(activityStats?.count),
          toolOrActionEventsCreated: countValue(eventStats?.count),
          latestEvidenceAt: latestDate(
            commentStats?.latestAt,
            documentStats?.latestAt,
            workProductStats?.latestAt,
            workspaceOperationStats?.latestAt,
            activityStats?.latestAt,
            eventStats?.latestAt,
          ),
        },
      });

      await db
        .update(heartbeatRuns)
        .set({
          livenessState: classification.livenessState,
          livenessReason: classification.livenessReason,
          continuationAttempt: classification.continuationAttempt,
          lastUsefulActionAt: classification.lastUsefulActionAt,
          nextAction: classification.nextAction,
          updatedAt: new Date(),
        })
        .where(and(eq(heartbeatRuns.id, run.id), isNull(heartbeatRuns.livenessState)));
    }
  }

  function scheduleRunLivenessBackfill(companyId: string, issueId: string) {
    const key = `${companyId}:${issueId}`;
    if (scheduledLivenessBackfills.has(key)) return;
    scheduledLivenessBackfills.add(key);
    void backfillMissingRunLivenessForIssue(companyId, issueId)
      .catch((err: unknown) => {
        logger.warn({ err, companyId, issueId }, "run liveness backfill failed");
      })
      .finally(() => {
        scheduledLivenessBackfills.delete(key);
      });
  }

  return {
    list: (filters: ActivityFilters) => {
      const conditions = [eq(activityLog.companyId, filters.companyId)];
      const limit = normalizeActivityLimit(filters.limit);

      if (filters.agentId) {
        conditions.push(eq(activityLog.agentId, filters.agentId));
      }
      if (filters.entityType) {
        conditions.push(eq(activityLog.entityType, filters.entityType));
      }
      if (filters.entityId) {
        conditions.push(eq(activityLog.entityId, filters.entityId));
      }

      return db
        .select({ activityLog })
        .from(activityLog)
        .leftJoin(
          issues,
          and(
            eq(activityLog.entityType, sql`'issue'`),
            eq(activityLog.entityId, issueIdAsText),
          ),
        )
        .where(
          and(
            ...conditions,
            or(
              sql`${activityLog.entityType} != 'issue'`,
              visibleIssueCondition(),
            ),
          ),
        )
        .orderBy(desc(activityLog.createdAt))
        .limit(limit)
        .then((rows) => rows.map((r) => r.activityLog));
    },

    forIssue: (issueId: string) =>
      db
        .select()
        .from(activityLog)
        .where(
          or(
            and(eq(activityLog.entityType, "issue"), eq(activityLog.entityId, issueId)),
            and(or(eq(activityLog.action, "project.created"), eq(activityLog.action, "company.skill_created")), sql`${activityLog.details}->>'sourceIssueId' = ${issueId}`,
              sql`${activityLog.companyId} = (select company_id from issues where id = ${issueId})`),
          ),
        )
        .orderBy(desc(activityLog.createdAt)),

    runsForIssue: async (companyId: string, issueId: string) => {
      scheduleRunLivenessBackfill(companyId, issueId);
      const runs = await db
        .select({
          runId: heartbeatRuns.id,
          runtimeMode: heartbeatRuns.runtimeMode,
          status: heartbeatRuns.status,
          agentId: heartbeatRuns.agentId,
          adapterType: agents.adapterType,
          startedAt: heartbeatRuns.startedAt,
          finishedAt: heartbeatRuns.finishedAt,
          createdAt: heartbeatRuns.createdAt,
          invocationSource: heartbeatRuns.invocationSource,
          responsibleUserId: heartbeatRuns.responsibleUserId,
          errorCode: heartbeatRuns.errorCode,
          usageJson: summarizedUsageJson,
          resultJson: summarizedResultJson,
          logBytes: heartbeatRuns.logBytes,
          retryOfRunId: heartbeatRuns.retryOfRunId,
          scheduledRetryAt: heartbeatRuns.scheduledRetryAt,
          scheduledRetryAttempt: heartbeatRuns.scheduledRetryAttempt,
          scheduledRetryReason: heartbeatRuns.scheduledRetryReason,
          livenessState: heartbeatRuns.livenessState,
          livenessReason: heartbeatRuns.livenessReason,
          continuationAttempt: heartbeatRuns.continuationAttempt,
          lastUsefulActionAt: heartbeatRuns.lastUsefulActionAt,
          nextAction: heartbeatRuns.nextAction,
          wakeCommentIds: sql<string[] | null>`${heartbeatRuns.contextSnapshot} -> 'wakeCommentIds'`,
          wakeCommentId: sql<string | null>`${heartbeatRuns.contextSnapshot} ->> 'wakeCommentId'`,
          contextCommentId: sql<string | null>`${heartbeatRuns.contextSnapshot} ->> 'commentId'`,
          contextIssueId: sql<string | null>`${heartbeatRuns.contextSnapshot} ->> 'issueId'`,
        })
        .from(heartbeatRuns)
        .innerJoin(
          agents,
          and(
            eq(agents.id, heartbeatRuns.agentId),
            eq(agents.companyId, heartbeatRuns.companyId),
          ),
        )
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            or(
              sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issueId}`,
              sql`exists (
                select 1
                from ${activityLog}
                where ${activityLog.companyId} = ${companyId}
                  and ${activityLog.entityType} = 'issue'
                  and ${activityLog.entityId} = ${issueId}
                  and ${activityLog.runId} = ${heartbeatRuns.id}
              )`,
            ),
          ),
        )
        .orderBy(desc(heartbeatRuns.createdAt));

      if (runs.length === 0) return runs;
      const runIds = runs.map((run) => run.runId);
      if (runIds.length === 0) return runs;

      const exhaustionRows = await db
        .select({
          runId: heartbeatRunEvents.runId,
          message: heartbeatRunEvents.message,
        })
        .from(heartbeatRunEvents)
        .where(
          and(
            inArray(heartbeatRunEvents.runId, runIds),
            eq(heartbeatRunEvents.eventType, "lifecycle"),
            sql`${heartbeatRunEvents.message} like 'Bounded retry exhausted%'`,
          ),
        )
        .orderBy(asc(heartbeatRunEvents.runId), desc(heartbeatRunEvents.id));

      const retryExhaustedReasonByRunId = new Map<string, string>();
      for (const row of exhaustionRows) {
        if (!row.message || retryExhaustedReasonByRunId.has(row.runId)) continue;
        retryExhaustedReasonByRunId.set(row.runId, row.message);
      }

      const leaseRows = await db
        .select({
          lease: environmentLeases,
          environment: {
            id: environments.id,
            name: environments.name,
            driver: environments.driver,
          },
        })
        .from(environmentLeases)
        .innerJoin(environments, eq(environmentLeases.environmentId, environments.id))
        .where(
          and(
            eq(environmentLeases.companyId, companyId),
            inArray(environmentLeases.heartbeatRunId, runIds),
          ),
        )
        .orderBy(desc(environmentLeases.lastUsedAt), desc(environmentLeases.createdAt));

      const leaseByRunId = new Map<string, (typeof leaseRows)[number]>();
      for (const row of leaseRows) {
        if (row.lease.heartbeatRunId && !leaseByRunId.has(row.lease.heartbeatRunId)) {
          leaseByRunId.set(row.lease.heartbeatRunId, row);
        }
      }

      const executionByRunId = await executionProjectionsForRuns(db, companyId, runIds);
      return runs.map((run) => {
        const leaseRow = leaseByRunId.get(run.runId);
        const leaseMetadata = leaseRow?.lease.metadata ?? null;
        const workspacePath =
          typeof leaseMetadata?.remoteCwd === "string" && leaseMetadata.remoteCwd.trim().length > 0
            ? leaseMetadata.remoteCwd
            : typeof leaseMetadata?.remoteWorkspacePath === "string" && leaseMetadata.remoteWorkspacePath.trim().length > 0
              ? leaseMetadata.remoteWorkspacePath
              : null;
        return {
          ...run,
          execution: executionByRunId.get(run.runId) ?? null,
          environment: leaseRow
            ? {
                id: leaseRow.environment.id,
                name: leaseRow.environment.name,
                driver: leaseRow.environment.driver,
              }
            : null,
          environmentLease: leaseRow
            ? {
                id: leaseRow.lease.id,
                status: leaseRow.lease.status,
                leasePolicy: leaseRow.lease.leasePolicy,
                provider: leaseRow.lease.provider,
                providerLeaseId: leaseRow.lease.providerLeaseId,
                executionWorkspaceId: leaseRow.lease.executionWorkspaceId,
                workspacePath,
                failureReason: leaseRow.lease.failureReason,
                cleanupStatus: leaseRow.lease.cleanupStatus,
                acquiredAt: leaseRow.lease.acquiredAt,
                releasedAt: leaseRow.lease.releasedAt,
              }
            : null,
          retryExhaustedReason: retryExhaustedReasonByRunId.get(run.runId) ?? null,
        };
      });
    },

    issuesForRun: async (runId: string) => {
      const run = await db
        .select({
          companyId: heartbeatRuns.companyId,
          contextSnapshot: heartbeatRuns.contextSnapshot,
        })
        .from(heartbeatRuns)
        .where(eq(heartbeatRuns.id, runId))
        .then((rows) => rows[0] ?? null);
      if (!run) return [];

      const fromActivity = await db
        .selectDistinctOn([issueIdAsText], {
          issueId: issues.id,
          identifier: issues.identifier,
          title: issues.title,
          status: issues.status,
          priority: issues.priority,
        })
        .from(activityLog)
        .innerJoin(issues, eq(activityLog.entityId, issueIdAsText))
        .where(
          and(
            eq(activityLog.companyId, run.companyId),
            eq(activityLog.runId, runId),
            eq(activityLog.entityType, "issue"),
            visibleIssueCondition(),
          ),
        )
        .orderBy(issueIdAsText);

      const context = run.contextSnapshot;
      const contextIssueId =
        context && typeof context === "object" && typeof (context as Record<string, unknown>).issueId === "string"
          ? ((context as Record<string, unknown>).issueId as string)
          : null;
      if (!contextIssueId) return fromActivity;
      if (fromActivity.some((issue) => issue.issueId === contextIssueId)) return fromActivity;

      const fromContext = await db
        .select({
          issueId: issues.id,
          identifier: issues.identifier,
          title: issues.title,
          status: issues.status,
          priority: issues.priority,
        })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, run.companyId),
            eq(issues.id, contextIssueId),
            visibleIssueCondition(),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!fromContext) return fromActivity;
      return [fromContext, ...fromActivity];
    },

    create: (data: typeof activityLog.$inferInsert) =>
      db
        .insert(activityLog)
        .values(data)
        .returning()
        .then((rows) => rows[0]),
  };
}
