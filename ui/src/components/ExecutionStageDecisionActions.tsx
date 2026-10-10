import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import type { Issue } from "@paperclipai/shared";
import { issuesApi } from "../api/issues";
import { useToastActions } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useTranslation } from "@/i18n";

export type ExecutionStageDecision = "approve" | "request_changes";

/**
 * True when `userId` is the human the issue's current review or approval stage
 * is waiting on. Only then does the viewer get the verbs below; the server still
 * re-checks the actor on PATCH (`only the active participant can advance`).
 */
export function isCurrentStageParticipant(
  issue: Pick<Issue, "status" | "executionState"> | null | undefined,
  userId: string | null | undefined,
): boolean {
  const state = issue?.executionState;
  const participant = state?.currentParticipant;
  return Boolean(
    issue &&
      userId &&
      issue.status === "in_review" &&
      state?.status === "pending" &&
      participant?.type === "user" &&
      participant.userId === userId,
  );
}

interface ExecutionStageDecisionActionsProps {
  issueId: string;
  companyId: string;
  className?: string;
  /** Fired after the decision lands so the surface can collapse or refetch extras. */
  onResolved?: (decision: ExecutionStageDecision) => void;
}

/**
 * Approve / request changes for a *normal* review or approval stage whose
 * current participant is the viewer (issue tracker #63: the stalled-review
 * verbs only appear when no participant path is left, so a human approver of a
 * healthy stage had no button). Both verbs go through the ordinary issue PATCH
 * the execution policy already handles: approve → `done` with the note,
 * request changes → `in_progress` with the note (any other status from the
 * board would clear the execution state instead of recording a decision). The
 * server requires a comment for both, so both stay disabled until there is one.
 */
export function ExecutionStageDecisionActions({
  issueId,
  companyId,
  className,
  onResolved,
}: ExecutionStageDecisionActionsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();
  const [note, setNote] = useState("");

  const decide = useMutation({
    mutationFn: (decision: ExecutionStageDecision) =>
      issuesApi.update(issueId, {
        status: decision === "approve" ? "done" : "in_progress",
        comment: note.trim(),
      }),
    onSuccess: (_result, decision) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attention(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issueId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.activity(issueId) });
      setNote("");
      pushToast({
        title:
          decision === "approve"
            ? t("executionstageactions.general.approved")
            : t("executionstageactions.general.changesrequested"),
        tone: "success",
      });
      onResolved?.(decision);
    },
    onError: (error) => {
      pushToast({
        title: t("executionstageactions.general.failed"),
        body: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    },
  });

  const pending = decide.isPending;
  const noteEmpty = note.trim().length === 0;
  const runningFor = (decision: ExecutionStageDecision) =>
    pending && decide.variables === decision;

  return (
    <div className={cn("flex flex-col gap-3", className)} data-testid="execution-stage-decision">
      <p className="text-xs font-medium text-muted-foreground">{t("executionstageactions.general.awaiting")}</p>
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("executionstageactions.general.noteplaceholder")}
        className="min-h-16 text-sm"
        data-testid="execution-stage-note"
        disabled={pending}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-amber-400/70 text-amber-900 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-100 dark:hover:bg-amber-500/15 sm:w-auto"
          disabled={pending || noteEmpty}
          title={noteEmpty ? t("executionstageactions.general.noterequired") : undefined}
          onClick={() => decide.mutate("request_changes")}
          data-testid="execution-stage-request-changes"
        >
          {runningFor("request_changes") ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          )}
          {t("executionstageactions.general.requestchanges")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="w-full sm:w-auto"
          disabled={pending || noteEmpty}
          title={noteEmpty ? t("executionstageactions.general.noterequired") : undefined}
          onClick={() => decide.mutate("approve")}
          data-testid="execution-stage-approve"
        >
          {runningFor("approve") ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          )}
          {t("executionstageactions.general.approve")}
        </Button>
      </div>
    </div>
  );
}
