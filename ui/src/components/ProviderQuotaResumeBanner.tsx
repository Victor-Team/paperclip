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
  const summary = resume.data ? summarizeProviderQuotaResume(resume.data) : null;
  if (!companyId || (count === 0 && !summary && !resume.error)) return null;

  return (
    <InlineBanner
      tone="info"
      icon={Hourglass}
      title={
        count > 0
          ? t("dashboard.general.providerQuotaWaitingTitle", { count })
          : undefined
      }
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
              : t("dashboard.general.providerQuotaResumeNow")}
          </Button>
        ) : undefined
      }
    >
      {count > 0 ? <p>{t("dashboard.general.providerQuotaWaitingBody")}</p> : null}
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
