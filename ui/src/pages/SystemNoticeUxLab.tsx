// token-extraction: allowlisted — intentional one-off decoration (DECISION-SHEET.md B1
// user ruling). The bg-[...gradient...] / shadow-[...] literals in this demo/UX-lab page
// are deliberate one-off decoration, reverted from --gradient-extract-*/--shadow-extract-*
// tokens; the file is on the check-token-gates allowlist in ui/src/index.css.
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemNotice } from "@/components/SystemNotice";
import { systemNoticeFixtures } from "@/fixtures/systemNoticeFixtures";
import { cn } from "@/lib/utils";
import {
  CircleDashed,
  FlaskConical,
  Layers,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "@/i18n";

function LabSection({
  id,
  eyebrow,
  title,
  description,
  accentClassName,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  accentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-(--rad-28) border border-border/70 bg-background/85 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-5",
        accentClassName,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-(length:--text-micro) font-semibold uppercase tracking-(--tracking-caps) text-muted-foreground">
            {eyebrow}
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function FixtureFrame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-(length:--text-micro) font-semibold uppercase tracking-(--tracking-eyebrow) text-muted-foreground">
        <CircleDashed className="h-3.5 w-3.5" />
        {caption}
      </div>
      {children}
    </div>
  );
}

function MockUserBubble({
  authorName,
  body,
  alignEnd,
}: {
  authorName: string;
  body: string;
  alignEnd?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", alignEnd && "justify-end")}>
      {!alignEnd ? (
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback>{authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      ) : null}
      <div className={cn("flex min-w-0 max-w-(--pct-85) flex-col", alignEnd && "items-end")}>
        <div
          className={cn(
            "mb-1 px-1 text-sm font-medium text-foreground",
            alignEnd ? "text-right" : "text-left",
          )}
        >
          {authorName}
        </div>
        <div className="min-w-0 max-w-full rounded-2xl bg-muted px-4 py-2.5 text-sm leading-6 text-foreground">
          {body}
        </div>
      </div>
      {alignEnd ? (
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback>{authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}

function MockAgentBubble({ agentName, body }: { agentName: string; body: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Avatar size="sm" className="shrink-0">
        <AvatarFallback>{agentName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 max-w-(--pct-85) flex-col">
        <div className="mb-1 px-1 text-sm font-medium text-foreground">{agentName}</div>
        <div className="min-w-0 max-w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-sm leading-6 text-foreground">
          {body}
        </div>
      </div>
    </div>
  );
}

const checklist = [
  "One container per system notice — no nested chat bubble",
  "Tone communicated by icon + label, never color alone",
  "Operational evidence hidden behind Details, expanded only on demand",
  "Issue, agent, and run metadata render as typed link rows, not raw markdown",
  "Hierarchy visibly distinct from user (right-aligned) and agent (left-aligned) bubbles",
];

export function SystemNoticeUxLab() {
  const { t } = useTranslation();
  const fixtureById = new Map(systemNoticeFixtures.map((f) => [f.id, f] as const));

  const warningCollapsed = fixtureById.get("warning-collapsed")!;
  const warningExpanded = fixtureById.get("warning-expanded")!;
  const dangerCollapsed = fixtureById.get("danger-collapsed")!;
  const dangerExpanded = fixtureById.get("danger-expanded")!;
  const neutralCollapsed = fixtureById.get("neutral-collapsed")!;
  const neutralExpanded = fixtureById.get("neutral-expanded")!;
  const warningNoDetails = fixtureById.get("warning-no-details")!;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-(--rad-32) border border-border/70 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),transparent_28%),linear-gradient(180deg,rgba(8,145,178,0.08),transparent_44%),var(--background)] shadow-[0_30px_80px_rgba(15,23,42,0.10)]">
        <div className="grid gap-6 lg:grid-cols-(--gtc-39)">
          <div className="p-6 sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/[0.08] px-3 py-1 text-(length:--text-nano) font-semibold uppercase tracking-(--tracking-caps) text-amber-700 dark:text-amber-300">
              <FlaskConical className="h-3.5 w-3.5" />
              {t("systemnoticeuxlab.general.systemnoticelab")}</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {t("systemnoticeuxlab.general.firstclasssystemnoticetreatment")}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {t("systemnoticeuxlab.general.replacesthecurrentpatternwhereapaperclip")}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-(length:--text-nano) uppercase tracking-(--tracking-caps)">
                {t("systemnoticeuxlab.general.pap3525plan")}</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-(length:--text-nano) uppercase tracking-(--tracking-caps)">
                {t("systemnoticeuxlab.general.phase1ux")}</Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-(length:--text-nano) uppercase tracking-(--tracking-caps)">
                {t("systemnoticeuxlab.general.toneswarningdangerneutral")}</Badge>
            </div>
          </div>

          <aside className="border-t border-border/60 bg-background/70 p-6 lg:border-l lg:border-t-0">
            <div className="mb-4 flex items-center gap-2 text-(length:--text-micro) font-semibold uppercase tracking-(--tracking-caps) text-muted-foreground">
              <ListChecks className="h-4 w-4 text-amber-700 dark:text-amber-300" />
              {t("systemnoticeuxlab.general.whatthislabproves")}</div>
            <div className="space-y-3">
              {checklist.map((line) => (
                <div
                  key={line}
                  className="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground"
                >
                  {line}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <LabSection
        id="tones"
        eyebrow="Tone matrix"
        title={t("systemnoticeuxlab.general.threetonestwostates")}
        description="Each tone pairs a unique icon and tone label so the notice is recognizable without color. Collapsed is the default; the Details affordance reveals operational metadata only when reviewers ask for it."
        accentClassName="bg-[linear-gradient(180deg,rgba(245,158,11,0.05),transparent_28%),var(--background)]"
      >
        <div className="space-y-5">
          <FixtureFrame caption={warningCollapsed.caption}>
            <SystemNotice {...warningCollapsed} />
          </FixtureFrame>
          <FixtureFrame caption={warningExpanded.caption}>
            <SystemNotice {...warningExpanded} />
          </FixtureFrame>
          <FixtureFrame caption={dangerCollapsed.caption}>
            <SystemNotice {...dangerCollapsed} />
          </FixtureFrame>
          <FixtureFrame caption={dangerExpanded.caption}>
            <SystemNotice {...dangerExpanded} />
          </FixtureFrame>
          <FixtureFrame caption={neutralCollapsed.caption}>
            <SystemNotice {...neutralCollapsed} />
          </FixtureFrame>
          <FixtureFrame caption={neutralExpanded.caption}>
            <SystemNotice {...neutralExpanded} />
          </FixtureFrame>
          <FixtureFrame caption={warningNoDetails.caption}>
            <SystemNotice {...warningNoDetails} />
          </FixtureFrame>
        </div>
      </LabSection>

      <LabSection
        id="hierarchy"
        eyebrow="Hierarchy in thread"
        title={t("systemnoticeuxlab.general.distinctfromuserandagentcomments")}
        description="Side-by-side with adjacent comment types so reviewers can confirm the system row reads as a system row — full width, no avatar gutter, no chat bubble — while user and agent comments keep their existing rounded bubbles."
        accentClassName="bg-[linear-gradient(180deg,rgba(8,145,178,0.05),transparent_28%),var(--background)]"
      >
        <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
          <MockUserBubble
            authorName="Riley Board"
            body="Why does this issue keep waking back up without a clear next step?"
            alignEnd
          />
          <MockAgentBubble
            agentName="CodexCoder"
            body="The previous run completed without picking a disposition. I'll wait for the new system notice to surface so the recovery owner is unambiguous."
          />
          <SystemNotice
            tone="danger"
            label={t("systemnoticeuxlab.general.systemalert")}
            source={{ label: "Paperclip", href: "/PAP/agents" }}
            timestamp="2026-05-04T16:48:00.000Z"
            body="Paperclip could not resolve this issue's missing disposition automatically. The source assignment is unchanged and a board decision is required."
            metadata={[
              {
                title: "Recovery owner",
                rows: [
                  {
                    kind: "issue",
                    label: "Recovery issue",
                    identifier: "PAP-3440",
                    href: "/PAP/issues/PAP-3440",
                    title: "Successful run handoff missing disposition",
                  },
                  {
                    kind: "agent",
                    label: "Owner",
                    name: "CTO",
                    href: "/PAP/agents/cto",
                  },
                ],
              },
              {
                title: "Run evidence",
                rows: [
                  {
                    kind: "run",
                    label: "Source run",
                    runId: "9cdba892-c7ca-4d93-8604-4843873b127c",
                    href: "/PAP/agents/codexcoder/runs/9cdba892-c7ca-4d93-8604-4843873b127c",
                    status: "succeeded",
                  },
                ],
              },
            ]}
          />
          <MockUserBubble
            authorName="Riley Board"
            body="Thanks — assigning the recovery owner now."
            alignEnd
          />
        </div>
      </LabSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <LabSection
          eyebrow="Before"
          title={t("systemnoticeuxlab.general.todaysnestedtreatment")}
          description="The same content rendered through the existing user-bubble + warning-callout path. Two containers, same gray background as user comments, and the warning icon is forced inside a chat row."
          accentClassName="bg-[linear-gradient(180deg,rgba(244,63,94,0.05),transparent_28%),var(--background)]"
        >
          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="flex items-start gap-2.5">
              <Avatar size="sm" className="shrink-0">
                <AvatarFallback>YO</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 max-w-(--pct-85) flex-col">
                <div className="mb-1 px-1 text-sm font-medium text-foreground">{t("systemnoticeuxlab.general.you")}</div>
                <div className="min-w-0 max-w-full rounded-2xl bg-muted px-4 py-2.5 text-sm leading-6 text-foreground">
                  <div className="rounded-md border border-red-500/35 bg-red-500/10 px-3 py-2.5 text-sm text-red-950 dark:text-red-100">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-1 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
                      <div className="min-w-0">
                        <p className="m-0 font-semibold">{t("systemnoticeuxlab.general.successfulrunhandoffmissing")}</p>
                        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-(length:--text-compact) leading-5">
                          <li>{t("systemnoticeuxlab.general.sourceissuepap3440")}</li>
                          <li>{t("systemnoticeuxlab.general.sourcerun9cdba892c7ca4d9386044843873b127c")}</li>
                          <li>{t("systemnoticeuxlab.general.recoveryrun61fdb79b80124676ac712971830e126a")}</li>
                          <li>{t("systemnoticeuxlab.general.statusbeforeinprogress")}</li>
                          <li>{t("systemnoticeuxlab.general.normalizedcauseruncompletedwithoutdisposition")}</li>
                          <li>{t("systemnoticeuxlab.general.recoveryownercto")}</li>
                          <li>{t("systemnoticeuxlab.general.suggestedactionreassigntorecoveryagent")}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="px-1 text-xs text-muted-foreground">
              {t("systemnoticeuxlab.general.authorreadsas")}<span className="font-medium text-foreground">{t("systemnoticeuxlab.general.you1")}</span> {t("systemnoticeuxlab.general.eventhoughtheauthoristhepaperclip")}</p>
          </div>
        </LabSection>

        <LabSection
          eyebrow="After"
          title={t("systemnoticeuxlab.general.systemnoticereplacement")}
          description="One container, system-authored label, hidden details. The chat surface keeps user and agent bubbles unchanged."
          accentClassName="bg-[linear-gradient(180deg,rgba(16,185,129,0.05),transparent_28%),var(--background)]"
        >
          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
            <SystemNotice {...dangerCollapsed} />
            <p className="px-1 text-xs text-muted-foreground">
              {t("systemnoticeuxlab.general.samecontentthevisiblebodyisone")}{" "}
              <span className="font-medium text-foreground">{t("systemnoticeuxlab.general.details")}</span> {t("systemnoticeuxlab.general.onlywhentheyneedrunevidencetone")}</p>
          </div>
        </LabSection>
      </div>

      <Card className="gap-4 border-border/70 bg-background/85 py-0">
        <CardHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center gap-2 text-(length:--text-micro) font-semibold uppercase tracking-(--tracking-caps) text-muted-foreground">
            <Layers className="h-4 w-4 text-amber-700 dark:text-amber-300" />
            {t("systemnoticeuxlab.general.implementationnotes")}</div>
          <CardTitle className="text-lg">{t("systemnoticeuxlab.general.handofftoengineering")}</CardTitle>
          <CardDescription>
            {t("systemnoticeuxlab.general.whatthephase4uiimplementationshould")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5 pt-0 text-sm text-muted-foreground">
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <div className="mb-1 font-medium text-foreground">{t("systemnoticeuxlab.general.component")}</div>
            {t("systemnoticeuxlab.general.use")}<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.systemnotice")}</code>{" "}
            {t("systemnoticeuxlab.general.from")}<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.componentssystemnotice")}</code>{t("systemnoticeuxlab.general.itaccepts")}<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.tone")}</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.label")}</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.body")}</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.metadata")}</code>{t("systemnoticeuxlab.general.and")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.detailsdefaultopen")}</code>.
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <div className="mb-1 font-medium text-foreground">{t("systemnoticeuxlab.general.routinginissuechatthread")}</div>
            {t("systemnoticeuxlab.general.commentswhere")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.authortypequotsystemquot")}</code>{" "}
            {t("systemnoticeuxlab.general.or")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.presentationkindquotsystemnoticequot")}</code>{" "}
            {t("systemnoticeuxlab.general.shouldrenderasasystemnoticerowat")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.issuechatusermessage")}</code>{" "}
            {t("systemnoticeuxlab.general.orassistantbubble")}</div>
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <div className="mb-1 font-medium text-foreground">{t("systemnoticeuxlab.general.accessibility")}</div>
            {t("systemnoticeuxlab.general.thedetailsbuttonhas")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.ariaexpanded")}</code>{" "}
            {t("systemnoticeuxlab.general.and2")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.ariacontrols")}</code>{" "}
            {t("systemnoticeuxlab.general.wiredtothepanelidthecontainer")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.rolequotstatusquot")}</code>{" "}
            {t("systemnoticeuxlab.general.andan")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.arialabel")}</code>{" "}
            {t("systemnoticeuxlab.general.equaltothevisibletonelabelso")}</div>
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
            <div className="mb-1 font-medium text-foreground">{t("systemnoticeuxlab.general.legacyfallback")}</div>
            {t("systemnoticeuxlab.general.existingcommentswithout")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.presentation")}</code>{" "}
            {t("systemnoticeuxlab.general.keeprenderingthroughthecurrent")}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{t("systemnoticeuxlab.general.successfulrunhandoffcommentcallout")}</code>{" "}
            {t("systemnoticeuxlab.general.stringdetectorthenewcontractisopt")}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SystemNoticeUxLab;
