import type { ReactNode } from "react";
import { ResponsibleUserDenialNotice } from "@/components/ResponsibleUserDenialNotice";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/i18n";

/**
 * UX lab for PAP-12462 (P7): run "on behalf of {user}" surfacing + responsible-user
 * denial copy. Renders before/after of both surfaces with real design tokens so the
 * states can be captured for UX review. Route: /ux-lab/responsible-user-denial
 */

function LabSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-background/85 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function BeforeAfter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-(length:--text-micro) font-semibold uppercase tracking-(--tracking-caps) text-muted-foreground">
        {label}
      </div>
      <Card className="block border-border/60 p-3">{children}</Card>
    </div>
  );
}

/** A faithful copy of a run ledger row header (see IssueRunLedger.tsx). */
function RunLedgerRow({
  onBehalfOf,
  denial,
}: {
  onBehalfOf?: string | null;
  denial?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <article className="space-y-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-foreground">{t("responsibleuserdenialuxlab.general.run")}</span>
        <span className="min-w-0 max-w-full truncate font-mono text-foreground">{t("responsibleuserdenialuxlab.general.a1b2c3d4")}</span>
        <span>{t("responsibleuserdenialuxlab.general.bycodexcoder")}</span>
        {onBehalfOf ? (
          <span className="min-w-0 max-w-full truncate text-muted-foreground">
            {t("responsibleuserdenialuxlab.general.onbehalfof")}<span className="text-foreground">{onBehalfOf}</span>
          </span>
        ) : null}
        <span className="rounded-md border border-border px-1.5 py-0.5 text-(length:--text-micro) capitalize text-muted-foreground">
          {denial ? t("responsibleuserdenialuxlab.general.failed") : t("responsibleuserdenialuxlab.general.succeeded")}
        </span>
        <span className="ml-auto shrink-0">{t("responsibleuserdenialuxlab.general.2mago")}</span>
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="min-w-0">
          <span className="text-foreground">{t("responsibleuserdenialuxlab.general.elapsed")}</span> {t("responsibleuserdenialuxlab.general.1m4s")}</div>
        <div className="min-w-0">
          <span className="text-foreground">{t("responsibleuserdenialuxlab.general.lastusefulaction")}</span> {t("responsibleuserdenialuxlab.general.2mago1")}</div>
        <div className="min-w-0">
          <span className="text-foreground">{t("responsibleuserdenialuxlab.general.stop")}</span> {denial ? t("responsibleuserdenialuxlab.general.denied") : t("responsibleuserdenialuxlab.general.completed")}
        </div>
      </div>
      {denial}
    </article>
  );
}

/** A faithful copy of the run-detail header identity block (see AgentDetail.tsx RunDetail). */
function RunDetailHeader({ onBehalfOf, denial }: { onBehalfOf?: string | null; denial?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-foreground">{t("responsibleuserdenialuxlab.general.runa1b2c3d4")}</span>
        <span className="rounded-md border border-border px-1.5 py-0.5 text-(length:--text-micro) capitalize text-muted-foreground">
          {denial ? t("responsibleuserdenialuxlab.general.failed2") : t("responsibleuserdenialuxlab.general.succeeded3")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-(length:--text-micro) text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 text-(length:--text-nano) font-medium uppercase tracking-wide">
          {t("responsibleuserdenialuxlab.general.codexlocal")}</span>
        <span>{t("responsibleuserdenialuxlab.general.anthropicclaudeopus48")}</span>
      </div>
      {onBehalfOf ? (
        <div className="text-xs text-muted-foreground">
          {t("responsibleuserdenialuxlab.general.onbehalfof4")}<span className="text-foreground">{onBehalfOf}</span>
        </div>
      ) : null}
      {denial}
    </div>
  );
}

export function ResponsibleUserDenialUxLab() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-muted/20 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <div className="text-(length:--text-micro) font-semibold uppercase tracking-(--tracking-caps) text-muted-foreground">
            {t("responsibleuserdenialuxlab.general.pap12462p7")}</div>
          <h1 className="mt-1 text-xl font-semibold text-foreground">
            {t("responsibleuserdenialuxlab.general.runonbehalfofsurfacingdenialcopy")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("responsibleuserdenialuxlab.general.beforeafterofthetworunsurfaces")}</p>
        </header>

        <LabSection
          title={t("responsibleuserdenialuxlab.general.1runidentityonbehalfofuser")}
          description="A run acting for a human now names that user on both the issue run ledger and the run detail header."
        >
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.beforerunledger")}>
            <RunLedgerRow />
          </BeforeAfter>
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.afterrunledger")}>
            <RunLedgerRow onBehalfOf="Ada Lovelace" />
          </BeforeAfter>
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.beforerundetail")}>
            <RunDetailHeader />
          </BeforeAfter>
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.afterrundetail")}>
            <RunDetailHeader onBehalfOf="Ada Lovelace" />
          </BeforeAfter>
        </LabSection>

        <LabSection
          title={t("responsibleuserdenialuxlab.general.2denialstateresponsibleusernotauthorized")}
          description="The agent is allowed, but the user the run acts for is not. Distinct from a plain agent-lacks-permission failure."
        >
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.beforegenericfailuretext")}>
            <div className="text-xs">
              <span className="text-red-600 dark:text-red-400">
                {t("responsibleuserdenialuxlab.general.forbiddenactionnotpermitted")}</span>
              <span className="ml-1 text-muted-foreground">{t("responsibleuserdenialuxlab.general.responsibleuserunauthorized")}</span>
            </div>
          </BeforeAfter>
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.afteractionabledenialcopy")}>
            <ResponsibleUserDenialNotice
              code="RESPONSIBLE_USER_UNAUTHORIZED"
              userName="Ada Lovelace"
            />
          </BeforeAfter>
        </LabSection>

        <LabSection
          title={t("responsibleuserdenialuxlab.general.3denialstateagentlackspermissionunchanged")}
          description="A denial that is NOT a responsible-user code keeps the existing generic error copy — no responsible-user notice."
        >
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.agentlackspermissionfailure")}>
            <div className="text-xs">
              <span className="text-red-600 dark:text-red-400">
                {t("responsibleuserdenialuxlab.general.forbiddenagentisnotpermittedtoperform")}</span>
              <span className="ml-1 text-muted-foreground">{t("responsibleuserdenialuxlab.general.denymissingmembership")}</span>
            </div>
          </BeforeAfter>
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.noresponsibleusernoticerendered")}>
            <div className="text-xs text-muted-foreground">
              {t("responsibleuserdenialuxlab.general.responsibleuserdenialnoticeintentionallyabsentfor")}</div>
          </BeforeAfter>
        </LabSection>

        <LabSection
          title={t("responsibleuserdenialuxlab.general.4denialstateresponsibleuserunavailable")}
          description="The user this run acts for was removed or deactivated. Steers the agent to mark work blocked."
        >
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.beforegenericfailuretext5")}>
            <div className="text-xs">
              <span className="text-red-600 dark:text-red-400">
                {t("responsibleuserdenialuxlab.general.forbiddenresponsibleuserunavailable")}</span>
              <span className="ml-1 text-muted-foreground">{t("responsibleuserdenialuxlab.general.responsibleuserunavailable")}</span>
            </div>
          </BeforeAfter>
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.afteractionabledenialcopy6")}>
            <ResponsibleUserDenialNotice
              code="RESPONSIBLE_USER_UNAVAILABLE"
              userName="Grace Hopper"
            />
          </BeforeAfter>
        </LabSection>

        <LabSection
          title={t("responsibleuserdenialuxlab.general.incontextdenialinsideafailedrun")}
          description="How the notice reads within a run row on the issue timeline."
        >
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.unauthorized")}>
            <RunLedgerRow
              onBehalfOf="Ada Lovelace"
              denial={
                <ResponsibleUserDenialNotice
                  code="RESPONSIBLE_USER_UNAUTHORIZED"
                  userName="Ada Lovelace"
                />
              }
            />
          </BeforeAfter>
          <BeforeAfter label={t("responsibleuserdenialuxlab.general.unavailable")}>
            <RunLedgerRow
              onBehalfOf="Grace Hopper"
              denial={
                <ResponsibleUserDenialNotice
                  code="RESPONSIBLE_USER_UNAVAILABLE"
                  userName="Grace Hopper"
                />
              }
            />
          </BeforeAfter>
        </LabSection>

        <p className={cn("text-center text-(length:--text-micro) text-muted-foreground")}>
          {t("responsibleuserdenialuxlab.general.copyissourcedfromtheshared")}<code>{t("responsibleuserdenialuxlab.general.describeresponsibleuserdenial")}</code> {t("responsibleuserdenialuxlab.general.contract")}</p>
      </div>
    </div>
  );
}
