import { useEffect, useMemo, useState } from "react";
import type { AgentPermissions, TrustPreset } from "@paperclipai/shared";
import { Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, CollapsibleSection } from "./agent-config-primitives";
import {
  buildPermissionsForTrustPreset,
  clearSingleLowTrustBoundaryTarget,
  getLowTrustBoundary,
  getSingleLowTrustBoundaryTarget,
  getTrustPreset,
  isCeLowTrustBoundaryEditable,
  lowTrustBoundaryHasScope,
  setSingleLowTrustBoundaryTarget,
  summarizeLowTrustBoundaryTarget,
  TRUST_PRESET_DESCRIPTIONS,
  TRUST_PRESET_LABELS,
  type LowTrustBoundaryTarget,
} from "../lib/trust-policy-ui";
import { cn } from "../lib/utils";
import { useTranslation } from "@/i18n";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function formatCount(value: readonly unknown[] | undefined, singular: string, plural: string) {
  const count = value?.length ?? 0;
  if (count === 0) return "-";
  return `${count} ${count === 1 ? singular : plural}`;
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 text-right", value === "-" && "text-muted-foreground")}>{value}</span>
    </div>
  );
}

export interface LowTrustBoundaryCandidate {
  id: string;
  label: string;
}

type LowTrustBoundaryTargetType = LowTrustBoundaryTarget["type"];

const BOUNDARY_TARGET_LABELS: Record<LowTrustBoundaryTargetType, string> = {
  project: "Project",
  root_issue: "Root issue",
  issue: "Issue",
};

export function TrustPresetSection({
  permissions,
  onChange,
  disabled,
  companyId,
  projectCandidates = [],
  issueCandidates = [],
  candidatesLoading,
  allowSingleIssue = true,
}: {
  permissions: Partial<AgentPermissions> | null | undefined;
  onChange: (permissions: Partial<AgentPermissions>) => void;
  disabled?: boolean;
  companyId?: string | null;
  projectCandidates?: LowTrustBoundaryCandidate[];
  issueCandidates?: LowTrustBoundaryCandidate[];
  candidatesLoading?: boolean;
  allowSingleIssue?: boolean;
}) {
  const { t } = useTranslation();
  const [policyOpen, setPolicyOpen] = useState(false);
  const preset = getTrustPreset(permissions);
  const boundary = getLowTrustBoundary(permissions);
  const boundaryTarget = getSingleLowTrustBoundaryTarget(boundary);
  const [targetType, setTargetType] = useState<LowTrustBoundaryTargetType>(boundaryTarget?.type ?? "project");
  const lowTrust = preset === "low_trust_review";
  const hasScope = lowTrustBoundaryHasScope(boundary);
  const boundaryEditable = isCeLowTrustBoundaryEditable(boundary);
  const policy = permissions?.authorizationPolicy ?? null;
  const managedPermissions = useMemo(
    () => buildPermissionsForTrustPreset(permissions, preset),
    [permissions, preset],
  );

  useEffect(() => {
    if (boundaryTarget) setTargetType(boundaryTarget.type);
  }, [boundaryTarget?.type]);

  function handlePresetChange(value: string) {
    const nextPreset: TrustPreset = value === "low_trust_review" ? "low_trust_review" : "standard";
    onChange(buildPermissionsForTrustPreset(permissions, nextPreset));
  }

  function handleBoundaryTargetChange(targetId: string) {
    if (!companyId || !targetId) return;
    onChange(setSingleLowTrustBoundaryTarget(permissions, companyId, { type: targetType, id: targetId }));
  }

  function handleClearBoundary() {
    onChange(clearSingleLowTrustBoundaryTarget(permissions));
  }

  const targetCandidates = targetType === "project" ? projectCandidates : issueCandidates;
  const boundaryValue = boundaryTarget?.type === targetType ? boundaryTarget.id : "";

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{t("trustpresetsection.general.trust")}</h3>
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Field label={t("trustpresetsection.general.trustpreset")} hint="Choose how broadly this agent can read and act on Paperclip work objects.">
          <select
            className={inputClass}
            value={preset}
            onChange={(event) => handlePresetChange(event.target.value)}
            disabled={disabled}
          >
            <option value="standard">{TRUST_PRESET_LABELS.standard}</option>
            <option value="low_trust_review">{TRUST_PRESET_LABELS.low_trust_review}</option>
          </select>
        </Field>
        <p className="text-xs text-muted-foreground">{TRUST_PRESET_DESCRIPTIONS[preset]}</p>

        {lowTrust ? (
          <div
            role={hasScope ? "status" : "alert"}
            aria-live="polite"
            className={cn(
              "rounded-md border px-3 py-2.5 text-sm flex gap-2",
              hasScope
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {hasScope ? (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="font-medium">
                  {hasScope ? t("trustpresetsection.general.containmentactive") : t("trustpresetsection.general.containmentnotconfigured")}
                </p>
                <p className="mt-1 text-xs leading-5">
                  {hasScope
                    ? t("trustpresetsection.general.thisagentcanonlyreadandmutate")
                    : t("trustpresetsection.general.thisagentissettolowtrust")}
                </p>
              </div>
              {boundaryEditable ? (
                <div className="rounded-md border border-border/70 bg-background/70 p-3 text-foreground space-y-3">
                  <div className="grid gap-3 sm:grid-cols-(--gtc-12)">
                    <Field label={t("trustpresetsection.general.boundarytype")}>
                      <select
                        className={inputClass}
                        value={targetType}
                        onChange={(event) => setTargetType(event.target.value as LowTrustBoundaryTargetType)}
                        disabled={disabled}
                      >
                        <option value="project">{t("trustpresetsection.general.project")}</option>
                        <option value="root_issue">{t("trustpresetsection.general.rootissue")}</option>
                        {allowSingleIssue && <option value="issue">{t("trustpresetsection.general.issue")}</option>}
                      </select>
                    </Field>
                    <Field label={BOUNDARY_TARGET_LABELS[targetType]}>
                      <select
                        className={inputClass}
                        value={boundaryValue}
                        onChange={(event) => handleBoundaryTargetChange(event.target.value)}
                        disabled={disabled || !companyId || candidatesLoading || targetCandidates.length === 0}
                      >
                        <option value="">
                          {candidatesLoading
                            ? t("trustpresetsection.general.loading")
                            : targetCandidates.length === 0
                              ? `No ${targetType === "project" ? t("trustpresetsection.general.projects") : t("trustpresetsection.general.issues")} available`
                              : t("trustpresetsection.general.selectboundary")}
                        </option>
                        {targetCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t("trustpresetsection.general.cesavesonecontainmentboundaryata")}</p>
                    {boundaryTarget ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        onClick={handleClearBoundary}
                        disabled={disabled}
                      >
                        {t("trustpresetsection.general.clearboundary")}</Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-border/70 bg-background/70 p-3 text-foreground">
                  <p className="text-sm font-medium">{t("trustpresetsection.general.managedbyeeapi")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("trustpresetsection.general.thispolicyhas")} {summarizeLowTrustBoundaryTarget(boundary).toLowerCase()} {t("trustpresetsection.general.andcannotbeeditedbythece")}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t("trustpresetsection.general.wanttosetmorethanonecontainment")}{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://paperclip.ing/ee"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("trustpresetsection.general.getpaperclipee")}</a>
              </p>
              <CollapsibleSection
                title={t("trustpresetsection.general.viewpolicy")}
                open={policyOpen}
                onToggle={() => setPolicyOpen((open) => !open)}
              >
                <div className="divide-y divide-border/60 text-foreground">
                  <PolicyRow label={t("trustpresetsection.general.preset")} value="Low-trust review v1" />
                  <PolicyRow label={t("trustpresetsection.general.rawoutput")} value="Quarantined from higher-trust agents" />
                  <PolicyRow label={t("trustpresetsection.general.projects1")} value={formatCount(boundary?.projectIds, "project", "projects")} />
                  <PolicyRow label={t("trustpresetsection.general.rootissue2")} value={boundary?.rootIssueId ? boundary.rootIssueId.slice(0, 8) : "-"} />
                  <PolicyRow label={t("trustpresetsection.general.explicitissues")} value={formatCount(boundary?.issueIds, "issue", "issues")} />
                  <PolicyRow label={t("trustpresetsection.general.allowedagents")} value={formatCount(boundary?.allowedAgentIds, "agent", "agents")} />
                  <PolicyRow label={t("trustpresetsection.general.allowedtools")} value={boundary?.allowedToolClasses?.join(" · ") || "-"} />
                  <PolicyRow label={t("trustpresetsection.general.allowedsecrets")} value={formatCount(boundary?.allowedSecretBindingIds, "binding", "bindings")} />
                  <PolicyRow label={t("trustpresetsection.general.promotiontarget")} value={boundary?.outputPromotionTarget?.issueId?.slice(0, 8) ?? "-"} />
                  <PolicyRow
                    label={t("trustpresetsection.general.eefields")}
                    value={Object.keys(policy ?? {}).some((key) => !["trustPreset", "reviewPreset", "trustBoundary"].includes(key))
                      ? "Custom advanced policy fields preserved"
                      : "-"}
                  />
                </div>
              </CollapsibleSection>
            </div>
          </div>
        ) : null}

        {managedPermissions.authorizationPolicy?.reviewPreset ? null : (
          <p className="text-xs text-muted-foreground">
            {t("trustpresetsection.general.advancedpermissionsremaineditablethroughtheee")}</p>
        )}
      </div>
    </div>
  );
}
