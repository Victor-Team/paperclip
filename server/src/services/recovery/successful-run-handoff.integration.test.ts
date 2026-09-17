import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agents,
  companies,
  createDb,
  heartbeatRuns,
  issueComments,
  issueRecoveryActions,
  issueThreadInteractions,
  issues,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "../../__tests__/helpers/embedded-postgres.js";
import { recoveryService, type LatestIssueRun } from "./service.js";
import {
  buildSuccessfulRunHandoffBoardDispositionIdempotencyKey,
  noticeMetadataReferencesRecoveryAction,
} from "./successful-run-handoff.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported
  ? describe
  : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres successful-run-handoff waiting-path tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

/**
 * R1 default-production-entry acceptance for the missing-disposition escalation
 * waiting path. `escalateStrandedAssignedIssue` with
 * `recoveryCause: SUCCESSFUL_RUN_MISSING_STATE_REASON` is the exact production
 * funnel that both exhaustion entries (provider-quota corrective runs and
 * exhausted `empty_response` liveness continuations) flow into, so these tests
 * drive it with zero flags and assert first-class rows in the database.
 */
describeEmbeddedPostgres(
  "successful run handoff exhausted board waiting path (default entry)",
  () => {
    let tempDb: Awaited<
      ReturnType<typeof startEmbeddedPostgresTestDatabase>
    > | null = null;
    let db: ReturnType<typeof createDb>;

    beforeAll(async () => {
      tempDb = await startEmbeddedPostgresTestDatabase(
        "paperclip-srh-waiting-path-",
      );
      db = createDb(tempDb.connectionString);
    }, 30_000);

    afterAll(async () => {
      await tempDb?.cleanup();
    });

    async function seedCompanyAndIssue() {
      const companyId = randomUUID();
      const coderId = randomUUID();
      const sourceIssueId = randomUUID();
      const prefix = `WP${companyId.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
      await db.insert(companies).values({
        id: companyId,
        name: "Handoff Waiting Path Co",
        issuePrefix: prefix,
        requireBoardApprovalForNewAgents: false,
      });
      await db.insert(agents).values({
        id: coderId,
        companyId,
        name: "Coder",
        role: "engineer",
        status: "idle",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      });
      await db.insert(issues).values({
        id: sourceIssueId,
        companyId,
        title: "Finish backend handoff",
        status: "in_progress",
        priority: "medium",
        assigneeAgentId: coderId,
        issueNumber: 1,
        identifier: `${prefix}-1`,
      });
      const [sourceIssue] = await db
        .select()
        .from(issues)
        .where(eq(issues.id, sourceIssueId));
      return { companyId, coderId, sourceIssue: sourceIssue! };
    }

    async function seedSourceRun(input: {
      companyId: string;
      agentId: string;
      issueId: string;
    }) {
      const runId = randomUUID();
      await db.insert(heartbeatRuns).values({
        id: runId,
        companyId: input.companyId,
        agentId: input.agentId,
        invocationSource: "manual",
        status: "succeeded",
        startedAt: new Date("2026-09-16T10:00:00.000Z"),
        finishedAt: new Date("2026-09-16T10:05:00.000Z"),
        exitCode: 0,
        contextSnapshot: { issueId: input.issueId },
      });
      return runId;
    }

    function makeHandoffRun(input: {
      companyId: string;
      agentId: string;
      issueId: string;
      sourceRunId: string;
      handoffAttempt: number;
    }): NonNullable<LatestIssueRun> {
      return {
        id: randomUUID(),
        agentId: input.agentId,
        status: "failed",
        error: "corrective handoff run produced no disposition",
        errorCode: "adapter_failed",
        createdAt: new Date("2026-09-16T11:00:00.000Z"),
        startedAt: new Date("2026-09-16T11:00:01.000Z"),
        livenessState: "needs_followup",
        contextSnapshot: {
          issueId: input.issueId,
          sourceRunId: input.sourceRunId,
          wakeReason: "successful_run_handoff_finish",
          handoffReason: "successful_run_missing_state",
          handoffRequired: true,
          missingDisposition: "clear_next_step",
          handoffAttempt: input.handoffAttempt,
          maxHandoffAttempts: 2,
        },
      };
    }

    const han = (value: string) => /[一-鿿]/.test(value);

    interface WaitingPathRowView {
      kind: string;
      status: string;
      continuationPolicy: string;
      title: string | null;
      summary: string | null;
      payload: Record<string, unknown>;
      idempotencyKey: string | null;
      sourceRunId: string | null;
    }

    function expectWaitingPathEvidence(input: {
      commentMetadata: unknown[];
      interactionRows: WaitingPathRowView[];
      sourceRunId: string;
      recoveryActionId: string | null;
      issueId: string;
    }) {
      // The waiting path must be a first-class interaction row, not a comment.
      expect(input.interactionRows).toHaveLength(1);
      const interaction = input.interactionRows[0]!;
      expect(interaction.kind).toBe("ask_user_questions");
      expect(interaction.status).toBe("pending");
      expect(interaction.continuationPolicy).toBe("wake_assignee");
      expect(interaction.sourceRunId).toBe(input.sourceRunId);
      expect(interaction.idempotencyKey).toBe(
        buildSuccessfulRunHandoffBoardDispositionIdempotencyKey({
          issueId: input.issueId,
          sourceRunId: input.sourceRunId,
          recoveryActionId: input.recoveryActionId,
        }),
      );
      expect(interaction.title).toContain("自动恢复已耗尽");
      expect(interaction.summary).toContain("答了会发生什么");
      expect(interaction.summary).toContain("不答会怎样");
      expect(interaction.summary).toContain("权限变更");

      const payload = interaction.payload as {
        questions: Array<{
          id: string;
          required: boolean;
          selectionMode: string;
          options: Array<{
            id: string;
            label: string;
            description: string;
            freeText?: boolean;
          }>;
        }>;
        supersedeOnUserComment: boolean;
      };
      expect(payload.supersedeOnUserComment).toBe(false);
      expect(payload.questions).toHaveLength(1);
      const question = payload.questions[0]!;
      expect(question.required).toBe(true);
      expect(question.selectionMode).toBe("single");
      expect(question.options.length).toBeGreaterThanOrEqual(5);
      for (const option of question.options) {
        expect(han(option.label)).toBe(true);
        expect(han(option.description)).toBe(true);
      }
      expect(question.options.filter((option) => option.freeText)).toHaveLength(
        1,
      );

      // The escalation notice must carry the waiting-path object in its
      // metadata rows (the notice body itself is a fixed prose string).
      const waitingPathMetadata = input.commentMetadata.filter((metadata) =>
        JSON.stringify(metadata ?? {}).includes("issue_thread_interaction:"),
      );
      expect(waitingPathMetadata.length).toBeGreaterThanOrEqual(1);
    }

    async function readWaitingPathState(input: {
      companyId: string;
      issueId: string;
    }) {
      const interactionRows = await db
        .select()
        .from(issueThreadInteractions)
        .where(
          and(
            eq(issueThreadInteractions.companyId, input.companyId),
            eq(issueThreadInteractions.issueId, input.issueId),
          ),
        );
      const commentRows = await db
        .select()
        .from(issueComments)
        .where(eq(issueComments.issueId, input.issueId));
      const [actionRow] = await db
        .select()
        .from(issueRecoveryActions)
        .where(eq(issueRecoveryActions.sourceIssueId, input.issueId));
      return {
        interactionRows,
        commentRows,
        actionRow: actionRow ?? null,
      };
    }

    it("creates a pending board interaction for the provider-quota exhaustion entry", async () => {
      const { companyId, coderId, sourceIssue } = await seedCompanyAndIssue();
      const sourceRunId = await seedSourceRun({
        companyId,
        agentId: coderId,
        issueId: sourceIssue.id,
      });
      const recovery = recoveryService(db, {
        enqueueWakeup: vi.fn(async () => null),
      });
      const handoffRun: NonNullable<LatestIssueRun> = makeHandoffRun({
        companyId,
        agentId: coderId,
        issueId: sourceIssue.id,
        sourceRunId,
        handoffAttempt: 2,
      });

      const updated = await recovery.escalateStrandedAssignedIssue({
        issue: sourceIssue,
        previousStatus: "in_progress",
        latestRun: handoffRun,
        comment: "Corrective handoff exhausted.",
        recoveryCause: "successful_run_missing_state",
        successfulRunHandoffEvidence: {
          sourceRunId,
          correctiveRunId: handoffRun.id,
          missingDisposition: "clear_next_step",
          handoffAttempt: 2,
          maxHandoffAttempts: 2,
        },
      });

      expect(updated).toMatchObject({ status: "blocked" });

      const { interactionRows, commentRows, actionRow } =
        await readWaitingPathState({
          companyId,
          issueId: sourceIssue.id,
        });

      expectWaitingPathEvidence({
        commentMetadata: commentRows.map((row) => row.metadata),
        interactionRows: interactionRows.map((row) => ({
          kind: row.kind,
          status: row.status,
          continuationPolicy: row.continuationPolicy,
          title: row.title,
          summary: row.summary,
          payload: row.payload as unknown as Record<string, unknown>,
          idempotencyKey: row.idempotencyKey,
          sourceRunId: row.sourceRunId,
        })),
        sourceRunId,
        recoveryActionId: actionRow?.id ?? null,
        issueId: sourceIssue.id,
      });

      expect(actionRow).toBeTruthy();
      // Stranded-source actions escalate the issue to the board with
      // maxAttempts=null, so the row stays `active` while owning the wake
      // policy; exhaustion is tracked on the handoff runs, not this row.
      expect(actionRow).toMatchObject({
        status: "active",
        ownerType: "board",
        cause: "successful_run_missing_state",
        wakePolicy: { type: "board_escalation" },
      });
    });

    it("creates an equivalent board interaction for the empty_response exhaustion entry", async () => {
      const { companyId, coderId, sourceIssue } = await seedCompanyAndIssue();
      // The empty_response entry reaches this escalation through TOK-179's
      // `successful_run_handoff_required` funnel; its corrective handoff run
      // carries the same context shape, so the source run id points at the
      // SUCCESS + empty run rather than a 429 run.
      const sourceRunId = await seedSourceRun({
        companyId,
        agentId: coderId,
        issueId: sourceIssue.id,
      });
      const recovery = recoveryService(db, {
        enqueueWakeup: vi.fn(async () => null),
      });
      const handoffRun: NonNullable<LatestIssueRun> = makeHandoffRun({
        companyId,
        agentId: coderId,
        issueId: sourceIssue.id,
        sourceRunId,
        handoffAttempt: 2,
      });

      await recovery.escalateStrandedAssignedIssue({
        issue: sourceIssue,
        previousStatus: "in_progress",
        latestRun: handoffRun,
        comment: "Empty-response continuation exhausted.",
        recoveryCause: "successful_run_missing_state",
        successfulRunHandoffEvidence: {
          sourceRunId,
          correctiveRunId: handoffRun.id,
          missingDisposition: "clear_next_step",
          handoffAttempt: 2,
          maxHandoffAttempts: 2,
        },
      });

      const { interactionRows, commentRows, actionRow } =
        await readWaitingPathState({
          companyId,
          issueId: sourceIssue.id,
        });

      expectWaitingPathEvidence({
        commentMetadata: commentRows.map((row) => row.metadata),
        interactionRows: interactionRows.map((row) => ({
          kind: row.kind,
          status: row.status,
          continuationPolicy: row.continuationPolicy,
          title: row.title,
          summary: row.summary,
          payload: row.payload as unknown as Record<string, unknown>,
          idempotencyKey: row.idempotencyKey,
          sourceRunId: row.sourceRunId,
        })),
        sourceRunId,
        recoveryActionId: actionRow?.id ?? null,
        issueId: sourceIssue.id,
      });
    });

    it("keeps the issue blocked with a queryable marker when the interaction create fails", async () => {
      const { companyId, coderId, sourceIssue } = await seedCompanyAndIssue();
      const sourceRunId = await seedSourceRun({
        companyId,
        agentId: coderId,
        issueId: sourceIssue.id,
      });
      const recovery = recoveryService(db, {
        enqueueWakeup: vi.fn(async () => null),
      });
      const handoffRun: NonNullable<LatestIssueRun> = makeHandoffRun({
        companyId,
        agentId: coderId,
        issueId: sourceIssue.id,
        sourceRunId,
        handoffAttempt: 2,
      });

      // Force every interaction create to fail to prove the fail-closed path:
      // the escalation must not lose its notice, and the failure marker must be
      // queryable in the posted notice metadata.
      const serviceModule = await import("../issue-thread-interactions.js");
      const realFactory = serviceModule.issueThreadInteractionService;
      const failingCreate = vi.fn(async () => {
        throw new Error("interaction store unavailable");
      });
      const factorySpy = vi
        .spyOn(serviceModule, "issueThreadInteractionService")
        .mockImplementation(((scopedDb: ReturnType<typeof createDb>) => {
          const real = realFactory(scopedDb);
          return new Proxy(real, {
            get(target, prop, receiver) {
              if (prop === "create") return failingCreate;
              return Reflect.get(target, prop, receiver);
            },
          });
        }) as typeof realFactory);

      try {
        const updated = await recovery.escalateStrandedAssignedIssue({
          issue: sourceIssue,
          previousStatus: "in_progress",
          latestRun: handoffRun,
          comment: "Corrective handoff exhausted with store down.",
          recoveryCause: "successful_run_missing_state",
          successfulRunHandoffEvidence: {
            sourceRunId,
            correctiveRunId: handoffRun.id,
            missingDisposition: "clear_next_step",
            handoffAttempt: 2,
            maxHandoffAttempts: 2,
          },
        });

        expect(updated).toMatchObject({ status: "blocked" });

        const { interactionRows, commentRows } = await readWaitingPathState({
          companyId,
          issueId: sourceIssue.id,
        });
        // Fail closed: no interaction row may exist, and the failure marker is
        // recorded in the escalation notice metadata so the dead end is
        // queryable rather than silent.
        expect(interactionRows).toHaveLength(0);
        expect(failingCreate).toHaveBeenCalledTimes(2);
        const waitingMarkerComments = commentRows.filter((row) =>
          JSON.stringify(row.metadata ?? {}).includes("unavailable:"),
        );
        expect(waitingMarkerComments.length).toBeGreaterThanOrEqual(1);
        expect(
          JSON.stringify(
            waitingMarkerComments[0]!.metadata ?? {},
          ).includes("interaction store unavailable"),
        ).toBe(true);
      } finally {
        factorySpy.mockRestore();
      }
    });

    it("does not create a second waiting path when the escalation replays", async () => {
      const { companyId, coderId, sourceIssue } = await seedCompanyAndIssue();
      const sourceRunId = await seedSourceRun({
        companyId,
        agentId: coderId,
        issueId: sourceIssue.id,
      });
      const recovery = recoveryService(db, {
        enqueueWakeup: vi.fn(async () => null),
      });
      const handoffRun: NonNullable<LatestIssueRun> = makeHandoffRun({
        companyId,
        agentId: coderId,
        issueId: sourceIssue.id,
        sourceRunId,
        handoffAttempt: 2,
      });
      const evidence = {
        sourceRunId,
        correctiveRunId: handoffRun.id,
        missingDisposition: "clear_next_step",
        handoffAttempt: 2,
        maxHandoffAttempts: 2,
      };

      await recovery.escalateStrandedAssignedIssue({
        issue: sourceIssue,
        previousStatus: "in_progress",
        latestRun: handoffRun,
        comment: "Corrective handoff exhausted.",
        recoveryCause: "successful_run_missing_state",
        successfulRunHandoffEvidence: evidence,
      });
      await recovery.escalateStrandedAssignedIssue({
        issue: sourceIssue,
        previousStatus: "in_review",
        latestRun: handoffRun,
        comment: "Corrective handoff exhausted.",
        recoveryCause: "successful_run_missing_state",
        successfulRunHandoffEvidence: evidence,
      });

      const { interactionRows, commentRows, actionRow } =
        await readWaitingPathState({
          companyId,
          issueId: sourceIssue.id,
        });
      expect(interactionRows).toHaveLength(1);
      expect(actionRow).toMatchObject({ attemptCount: 2 });
      const actionReferencingComments = commentRows.filter((row) =>
        noticeMetadataReferencesRecoveryAction(
          row.metadata,
          actionRow?.id ?? "",
        ),
      );
      expect(actionReferencingComments.length).toBeLessThanOrEqual(1);
    });
  },
);
