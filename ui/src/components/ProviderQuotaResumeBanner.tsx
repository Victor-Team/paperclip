import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hourglass } from "lucide-react";

import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { providerQuotaApi, type ProviderQuotaResumeResult } from "../api/providerQuota";
import { InlineBanner } from "./InlineBanner";

export const providerQuotaWaitsQueryKey = (companyId: string) =>
  ["provider-quota", "waits", companyId] as const;

export function summarizeProviderQuotaResume(result: ProviderQuotaResumeResult) {
  const released = result.results.filter(
    (item) => item.outcome === "released" || item.outcome === "already_running",
  ).length;
  const failed = result.results.filter((item) => item.outcome === "failed").length;
  return { released, failed };
}

/**
 * Dashboard notice for work parked on provider (model) quota. The platform
 * already probes at least hourly; this lets the board resume everything right
 * away after a top-up or an early reset.
 */
export function ProviderQuotaResumeBanner({ companyId }: { companyId: string | null | undefined }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const waits = useQuery({
    queryKey: providerQuotaWaitsQueryKey(companyId ?? ""),
    queryFn: () => providerQuotaApi.waits(companyId!),
    enabled: Boolean(companyId),
    refetchInterval: 60_000,
  });
  const resume = useMutation({
    mutationFn: () => providerQuotaApi.resumeNow(companyId!),
    onSettled: () => {
      if (companyId) void queryClient.invalidateQueries({ queryKey: providerQuotaWaitsQueryKey(companyId) });
    },
  });

  const count = waits.data?.count ?? 0;
  // Network (connectivity) and other transient provider-failure waits share the
  // list and the button (ledger #56); whatever is not tagged is quota.
  const listed = waits.data?.waits ?? [];
  const unreachableCount = listed.filter((wait) => wait.reason === "provider_unreachable").length;
  const retryCount = listed.filter((wait) => wait.reason === "transient_failure").length;
  const quotaCount = count - unreachableCount - retryCount;
  const sections = [
    quotaCount > 0
      ? { key: "quota", title: t("dashboard.general.providerQuotaWaitingTitle", { count: quotaCount }), body: t("dashboard.general.providerQuotaWaitingBody") }
      : null,
    unreachableCount > 0
      ? { key: "unreachable", title: t("dashboard.general.providerUnreachableWaitingTitle", { count: unreachableCount }), body: t("dashboard.general.providerUnreachableWaitingBody") }
      : null,
    retryCount > 0
      ? { key: "retry", title: t("dashboard.general.providerRetryWaitingTitle", { count: retryCount }), body: t("dashboard.general.providerRetryWaitingBody") }
      : null,
  ].filter((section): section is { key: string; title: string; body: string } => section !== null);
  const summary = resume.data ? summarizeProviderQuotaResume(resume.data) : null;
  if (!companyId || (count === 0 && !summary && !resume.error)) return null;

  return (
    <InlineBanner
      tone="info"
      icon={Hourglass}
      title={sections[0]?.title}
      actions={
        count > 0 ? (
          <Button
            size="sm"
            onClick={() => resume.mutate()}
            disabled={resume.isPending}
            data-testid="dashboard-provider-quota-resume-now"
          >
            {resume.isPending
              ? t("dashboard.general.providerQuotaResuming")
              : quotaCount === count
                ? t("dashboard.general.providerQuotaResumeNow")
                : t("dashboard.general.providerWaitResumeNow")}
          </Button>
        ) : undefined
      }
    >
      {sections.map((section, index) => (
        <div key={section.key} data-testid={`dashboard-provider-wait-${section.key}`}>
          {index > 0 ? <p className="font-medium">{section.title}</p> : null}
          <p>{section.body}</p>
        </div>
      ))}
      {summary ? (
        <p data-testid="dashboard-provider-quota-resume-result">
          {t("dashboard.general.providerQuotaResumeResult", summary)}
        </p>
      ) : null}
      {resume.error ? (
        <p className="text-destructive" data-testid="dashboard-provider-quota-resume-error">
          {t("dashboard.general.providerQuotaResumeError", {
            message: resume.error instanceof Error ? resume.error.message : String(resume.error),
          })}
        </p>
      ) : null}
    </InlineBanner>
  );
}
