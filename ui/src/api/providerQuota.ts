import { api } from "./client";

export type ProviderQuotaWaitKind = "scheduled_retry" | "quota_monitor" | "stale_monitor";

/** Why the work waits: model quota, the model service being unreachable (network), or repeated transient model-service errors. */
export type ProviderWaitReason = "provider_quota" | "provider_unreachable" | "transient_failure";

export interface ProviderQuotaWait {
  issueId: string;
  agentId: string | null;
  kind: ProviderQuotaWaitKind;
  reason: ProviderWaitReason;
  waitingUntil: string | null;
}

export type ProviderQuotaResumeOutcome =
  | "released"
  | "already_running"
  | "not_needed"
  | "stale_monitor_cleared"
  | "failed";

export interface ProviderQuotaResumeResult {
  results: Array<{
    issueId: string;
    agentId: string | null;
    phase: ProviderQuotaWaitKind;
    outcome: ProviderQuotaResumeOutcome;
    message: string | null;
  }>;
}

export const providerQuotaApi = {
  waits: (companyId: string) =>
    api.get<{ count: number; waits: ProviderQuotaWait[] }>(`/companies/${companyId}/provider-quota/waits`),
  resumeNow: (companyId: string) =>
    api.post<ProviderQuotaResumeResult>(`/companies/${companyId}/provider-quota/resume-now`, {}),
};
