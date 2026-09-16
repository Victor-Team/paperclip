/**
 * Structured adapter final-response semantics.
 *
 * Some adapters — the Gemini-CLI family (`gemini_local` and external plugins
 * that wrap the same CLI, e.g. `antigravity_local`) — can exit 0 while their
 * structured final response reports that the agent turn failed. The CLI owns
 * the exit code; the structured response owns the truth about the turn.
 * Paperclip must not mark such a run `succeeded` merely because the process
 * exited 0 (TOK-185): a 429 RESOURCE_EXHAUSTED turn recorded as a succeeded
 * run bypasses provider-quota recovery and dead-ends the task tree in a
 * missing-disposition escalation.
 *
 * Scope note: a structured `SUCCESS` with an empty response is deliberately
 * *not* treated as a failure here. Paperclip already owns that case through
 * the `empty_response` run-liveness state and its bounded continuation
 * (`recovery/run-liveness-continuations.ts`); turning it into a failed run
 * would replace a working first-class path with a generic adapter failure.
 *
 * The final response is read from `AdapterExecutionResult.resultJson`, either
 * spread at the top level (`gemini_local` merges the parsed result event into
 * resultJson) or nested under `resultJson.parsed` (external plugins that keep
 * the raw CLI JSON). Recognized shape:
 *
 *   { status: "SUCCESS" | "ERROR", response: string, error?: string, is_error?: boolean }
 *
 * Status matching is case-insensitive: the CLI emits uppercase values while
 * stream-json `result` events use lowercase.
 */

export type AdapterStructuredFinalFailure = { message: string };

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStructuredFinalResponse(
  resultJson: Record<string, unknown> | null | undefined,
): { record: Record<string, unknown>; status: string | null } | null {
  if (!resultJson) return null;
  const nested =
    typeof resultJson.parsed === "object" &&
    resultJson.parsed !== null &&
    !Array.isArray(resultJson.parsed)
      ? (resultJson.parsed as Record<string, unknown>)
      : null;
  for (const candidate of [nested, resultJson]) {
    if (!candidate) continue;
    const status = readTrimmedString(candidate.status);
    // `is_error` is the CLI's own boolean error flag and can appear without a
    // status field; treat it as an error-marked record with unknown status.
    if (status || candidate.is_error === true) {
      return { record: candidate, status: status ? status.toUpperCase() : null };
    }
  }
  return null;
}

/**
 * Classify a structured final response that must fail the run even when the
 * adapter process exited 0. Returns null when the adapter contract is unknown
 * (no structured final response) or the turn did not report an error — the
 * legacy exit-code-only outcome decision keeps owning those runs.
 */
export function readAdapterStructuredFinalFailure(input: {
  resultJson?: Record<string, unknown> | null;
}): AdapterStructuredFinalFailure | null {
  const structured = readStructuredFinalResponse(input.resultJson);
  if (!structured) return null;
  const { record, status } = structured;

  if (record.is_error !== true && status !== "ERROR" && status !== "FAILED") {
    return null;
  }
  return {
    message:
      readTrimmedString(record.error) ??
      readTrimmedString(record.message) ??
      readTrimmedString(record.result) ??
      "Adapter final response reported an error",
  };
}
