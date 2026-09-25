import { ChatSetupNavigation } from "@/components/chat/ChatSetupNavigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { useNavigate, useSearchParams, Link } from "@/lib/router";
import { agentsApi } from "@/api/agents";
import { issuesApi } from "@/api/issues";
import { projectsApi } from "@/api/projects";
import { toolsApi } from "@/api/tools";
import { emailApi } from "@/api/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCardGroup } from "@/components/ui/radio-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AgentIcon } from "@/components/AgentIconPicker";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AccessStep } from "@/features/connections/ConnectionSetupFlow";
import { TrustPresetSection } from "@/components/TrustPresetSection";
import { EmailSafetyNotice } from "@/components/EmailSafetyNotice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getTrustPreset,
  getLowTrustBoundary,
  lowTrustBoundaryHasScope,
} from "@/lib/trust-policy-ui";
import { queryKeys } from "@/lib/queryKeys";
import type {
  AgentPermissions,
  EmailEndpointSummary,
} from "@paperclipai/shared";
import { useTranslation } from "@/i18n";
const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function EmailEndpointSetup() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const companyId = selectedCompanyId ?? "";
  const [connectionId, setConnectionId] = useState(
    params.get("connectionId") ?? "",
  );
  const [step, setStep] = useState(params.get("connectionId") ? 3 : 0);
  const [agentId, setAgentId] = useState(params.get("agentId") ?? "");
  const [grantKind, setGrantKind] = useState<"user" | "organization" | "agent">(
    "user",
  );
  const [agentAccess, setAgentAccess] = useState<"specific" | "all">(
    "specific",
  );
  const [agentIds, setAgentIds] = useState<Set<string>>(
    new Set(params.get("agentId") ? [params.get("agentId")!] : []),
  );
  const [apiKey, setApiKey] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const [addressMode, setAddressMode] = useState("new");
  const [inboxId, setInboxId] = useState("");
  const [username, setUsername] = useState("");
  const [domain, setDomain] = useState("agentmail.to");
  const [mode, setMode] = useState<"websocket" | "webhook">("websocket");
  const [trustOpen, setTrustOpen] = useState(false);
  const [permissions, setPermissions] = useState<Partial<AgentPermissions>>({});
  const agents = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });
  const projects = useQuery({
    queryKey: queryKeys.projects.list(companyId),
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId && trustOpen,
  });
  const boundaryIssues = useQuery({
    queryKey: ["email-boundary-issues", companyId],
    queryFn: () => issuesApi.list(companyId),
    enabled: !!companyId && trustOpen,
  });
  const chosen = agents.data?.find((a) => a.id === agentId);
  const lowTrust = getTrustPreset(chosen?.permissions) === "low_trust_review";
  const scoped = lowTrustBoundaryHasScope(
    getLowTrustBoundary(chosen?.permissions),
  );
  const inspected = useQuery({
    queryKey: ["email-credential-inspect", companyId, connectionId],
    queryFn: () => emailApi.inspectSaved(companyId, connectionId),
    enabled: !!companyId && !!connectionId && step >= 3,
    retry: false,
  });
  const inboxes = useQuery({
    queryKey: ["email-inboxes", companyId],
    queryFn: () => emailApi.list(companyId),
    enabled: !!companyId,
  });
  const scopedKey = inspected.data?.scope.scope_type === "inbox";
  useEffect(() => {
    if (scopedKey) {
      setAddressMode("existing");
      setInboxId(inspected.data?.inboxes[0]?.inbox_id ?? "");
    }
  }, [scopedKey, inspected.data]);
  const connect = useMutation({
    mutationFn: () =>
      emailApi.connect(companyId, {
        apiKey,
        grantKind: grantKind === "organization" ? "organization" : "user",
        allAgents: agentAccess === "all",
        agentIds: [...agentIds],
        idempotencyKey: requestId,
      }),
    onSuccess: (result) => {
      setApiKey("");
      setConnectionId(result.id);
      setStep(2);
      void cache.invalidateQueries({
        queryKey: queryKeys.tools.connections(companyId),
      });
    },
  });
  const agentDetail = useQuery({
    queryKey: queryKeys.agents.detail(agentId),
    queryFn: () => agentsApi.get(agentId),
    enabled: !!agentId && trustOpen,
  });
  const trust = useMutation({
    mutationFn: () =>
      agentsApi.updatePermissions(
        agentId,
        {
          ...permissions,
          canCreateAgents: permissions.canCreateAgents ?? false,
          canCreateSkills: permissions.canCreateSkills ?? true,
          canAssignTasks: agentDetail.data?.access?.canAssignTasks ?? false,
        },
        companyId,
      ),
    onSuccess: () => {
      setTrustOpen(false);
      void cache.invalidateQueries({
        queryKey: queryKeys.agents.list(companyId),
      });
    },
  });
  const setup = useMutation({
    mutationFn: () =>
      emailApi.setup(companyId, {
        assignedAgentId: agentId,
        credentialConnectionId: connectionId,
        ...(addressMode === "existing" ? { inboxId } : { username, domain }),
        receiveMode: mode,
        idempotencyKey: requestId,
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["email-inboxes", companyId] });
      void cache.invalidateQueries({
        queryKey: queryKeys.tools.connectionInstalls(connectionId),
      });
      setStep(6);
    },
  });
  const address =
    addressMode === "existing" ? inboxId : `${username}@${domain}`;
  const labels =
    step < 3
      ? [
          t("emailendpointsetup.general.access"),
          t("emailendpointsetup.general.apikey"),
          t("emailendpointsetup.general.connected"),
        ]
      : [
          t("emailendpointsetup.general.agent"),
          t("emailendpointsetup.general.emailaddress"),
          t("emailendpointsetup.general.review"),
        ];
  const current = step < 3 ? step : Math.min(step - 3, 2);
  const error = connect.error ?? setup.error ?? inspected.error ?? agents.error;
  const trustNotice = chosen && (
    <div
      className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
      role={lowTrust && scoped ? "note" : "alert"}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {lowTrust && scoped ? (
          <Check className="size-4" />
        ) : (
          <AlertTriangle className="size-4 text-(--status-agent-paused)" />
        )}
        {lowTrust
          ? scoped
            ? t("emailendpointsetup.general.lowtrustreviewconfigured")
            : t("emailendpointsetup.general.lowtrustneedsaworkboundary")
          : t("emailendpointsetup.general.agentisnotalowtrustagent", {
              agentName: chosen.name,
            })}
      </p>
      <p className="text-sm text-muted-foreground">
        {lowTrust
          ? t(
              "emailendpointsetup.general.emailtasksstayinsidetheconfiguredproject",
            )
          : t(
              "emailendpointsetup.general.emailcancontainmaliciousinstructions",
            )}
      </p>
      <p className="text-xs text-muted-foreground">{t("emailendpointsetup.general.lowtrustexecutionalsorequiresisolatedworkspaces")}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setPermissions(chosen.permissions);
          setTrustOpen(true);
        }}
      >
        {lowTrust
          ? t("emailendpointsetup.general.reviewtrustsettings")
          : t("emailendpointsetup.general.configurelowtrust")}
      </Button>
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          {step < 3
            ? t("emailendpointsetup.general.connectagentmail")
            : step === 6
              ? t("emailendpointsetup.general.youragentsemailisready")
              : t("emailendpointsetup.general.giveanagentanemailaddress")}
        </h1>
        <Button
          variant="ghost"
          onClick={() =>
            navigate(
              connectionId ? `/apps/${connectionId}/permissions` : "/apps",
            )
          }
        >
          {step === 6 ? t("emailendpointsetup.general.close") : t("emailendpointsetup.general.cancel")}
        </Button>
      </header>
      <ChatSetupNavigation
        labels={labels}
        step={current}
        availableStep={current}
        disabled={connect.isPending || setup.isPending || step === 2 || step === 6}
        onSelect={(index) => setStep(step < 3 ? index : index + 3)}
      />
      {step === 0 && (
        <AccessStep
          companyId={companyId}
          authKind="api_key"
          grantKinds={["user", "organization"]}
          grantKind={grantKind}
          setGrantKind={setGrantKind}
          installChoice={agentAccess}
          setInstallChoice={setAgentAccess}
          installAgentIds={agentIds}
          setInstallAgentIds={setAgentIds}
          onBack={() => navigate("/apps")}
          onContinue={() => setStep(1)}
          submitLabel={t("emailendpointsetup.general.continue")}
        />
      )}
      {step === 1 && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            connect.mutate();
          }}
        >
          <section className="space-y-4 rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold">
              {t("emailendpointsetup.general.addyouragentmailapikey")}</h2>
            <Label htmlFor="email-api-key">{t("emailendpointsetup.general.apikey")}</Label>
            <Input
              id="email-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("emailendpointsetup.general.pasteyouragentmailapikey")}
            />
            <a
              href="https://console.agentmail.to"
              target="_blank"
              rel="noreferrer"
              className="text-sm underline"
            >
              {t("emailendpointsetup.general.getakeyinagentmail")}</a>
          </section>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              {t("emailendpointsetup.general.back")}</Button>
            <Button disabled={!apiKey.trim() || connect.isPending}>
              {connect.isPending ? t("emailendpointsetup.general.connecting") : t("emailendpointsetup.general.connectagentmail1")}
            </Button>
          </div>
        </form>
      )}
      {step === 2 && (
        <section className="space-y-5 rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold">{t("emailendpointsetup.general.agentmailisconnected")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("emailendpointsetup.general.nextgiveanagentanemailaddress")}</p>
          <div className="flex justify-end">
            <Button
              onClick={() => navigate(`/apps/${connectionId}/permissions`)}
            >
              {t("emailendpointsetup.general.openpermissions")}<ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      )}
      {step === 3 && (
        <>
          <section className="space-y-4 rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold">
              {t("emailendpointsetup.general.whoshouldhandlethisinbox")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("emailendpointsetup.general.incomingemailwillcreatetasksassignedto")}</p>
            <Label>{t("emailendpointsetup.general.agent")}</Label>
            <SearchableSelect
              value={agentId}
              placeholder={t("emailendpointsetup.general.chooseanagent")}
              searchPlaceholder={t("emailendpointsetup.general.searchallagents")}
              emptyMessage={t("emailendpointsetup.general.noagentsfound")}
              groups={[
                {
                  id: "agents",
                  options: (agents.data ?? [])
                    .filter(
                      (a) =>
                        !["terminated", "pending_approval"].includes(a.status),
                    )
                    .map((a) => ({
                      key: a.id,
                      value: a.id,
                      label: a.name,
                      icon: a.icon,
                    })),
                },
              ]}
              onValueChange={(id, option) => {
                setAgentId(id);
                setUsername(
                  option.label
                    .toLowerCase()
                    .replace(/[^a-z0-9._-]+/g, "-")
                    .slice(0, 64),
                );
              }}
              renderValue={(option) =>
                option && (
                  <span className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback>
                        <AgentIcon icon={String(option.icon ?? "bot")} />
                      </AvatarFallback>
                    </Avatar>
                    {option.label}
                  </span>
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("emailendpointsetup.general.activatingthisinboxalsoaddstheagent")}</p>
          </section>
          {trustNotice}
        </>
      )}
      {step === 4 && (
        <>
          <section className="space-y-5 rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold">
              {t("emailendpointsetup.general.chooseagentsemailaddress", {
                agentName: chosen?.name ?? "",
              })}</h2>
            <RadioCardGroup
              ariaLabel={t("emailendpointsetup.general.emailaddresssource")}
              value={addressMode}
              onValueChange={setAddressMode}
              options={[
                {
                  value: "new",
                  title: t("emailendpointsetup.general.createanewaddress"),
                  disabled: scopedKey,
                },
                {
                  value: "existing",
                  title: t("emailendpointsetup.general.useanexistinginbox"),
                },
              ]}
            />
            {addressMode === "new" ? (
              <div className="space-y-2">
                <Label htmlFor="email-name">{t("emailendpointsetup.general.emailaddress")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="email-name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  />
                  <span className="text-sm text-muted-foreground">
                    @{domain}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email-existing">{t("emailendpointsetup.general.availableinbox")}</Label>
                <select
                  id="email-existing"
                  className={selectClass}
                  value={inboxId}
                  onChange={(e) => setInboxId(e.target.value)}
                >
                  <option value="">{t("emailendpointsetup.general.chooseaninbox")}</option>
                  {inspected.data?.inboxes.map((i) => (
                    <option
                      key={i.inbox_id}
                      disabled={inboxes.data?.some(
                        (e) =>
                          e.address === i.inbox_id && e.status !== "archived",
                      )}
                      value={i.inbox_id}
                    >
                      {i.inbox_id}
                      {inboxes.data?.some((e) => e.address === i.inbox_id)
                        ? t("emailendpointsetup.general.alreadyassigned")
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <details className="border-t border-border pt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                {t("emailendpointsetup.general.advancedoptions")}</summary>
              <div className="space-y-4 pt-4">
                {addressMode === "new" && (
                  <>
                    <Label htmlFor="email-domain">{t("emailendpointsetup.general.domain")}</Label>
                    <select
                      id="email-domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className={selectClass}
                    >
                      <option>agentmail.to</option>
                      {inspected.data?.domains
                        .filter((d) => d.status === "VERIFIED")
                        .map((d) => (
                          <option key={d.domain_id}>{d.domain}</option>
                        ))}
                    </select>
                    <a
                      className="text-sm underline"
                      href="https://docs.agentmail.to/custom-domains"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("emailendpointsetup.general.setupacustomdomaininagentmail")}</a>
                  </>
                )}
                <Label htmlFor="email-mode">{t("emailendpointsetup.general.receiving")}</Label>
                <select
                  id="email-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className={selectClass}
                >
                  <option value="websocket">
                    {t("emailendpointsetup.general.liveconnectionworkslocally")}</option>
                  <option value="webhook">
                    {t("emailendpointsetup.general.webhookrequirespublichttps")}</option>
                </select>
              </div>
            </details>
          </section>
          <EmailSafetyNotice />
        </>
      )}
      {step === 5 && (
        <>
          <EmailSafetyNotice />
          {trustNotice}
          <section className="space-y-4 rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold">
              {t("emailendpointsetup.general.readytostartreceivingemail")}</h2>
            <p className="text-lg font-semibold">{address}</p>
            <p className="text-sm">
              {t("emailendpointsetup.general.assignedto")} {chosen?.name} ·{" "}
              {mode === "websocket" ? t("emailendpointsetup.general.liveconnection") : t("emailendpointsetup.general.signedwebhook")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("emailendpointsetup.general.newconversationscreatetasksrepliesstayin")}</p>
          </section>
        </>
      )}
      {step === 6 && (
        <section className="space-y-5 rounded-xl border border-border p-6">
          <p className="flex items-center gap-2 text-sm">
            <Check className="size-4" />
            {t("emailendpointsetup.general.receivingemailfor")} {chosen?.name}
          </p>
          <p className="text-lg font-semibold">{setup.data?.address}</p>
          <EmailSafetyNotice />
          <Button onClick={() => navigate(`/apps/${connectionId}/permissions`)}>
            {t("emailendpointsetup.general.backtopermissions")}</Button>
        </section>
      )}
      {step >= 3 && step <= 5 && (
        <div className="flex justify-between border-t border-border pt-5">
          <Button
            variant="ghost"
            onClick={() =>
              step === 3
                ? navigate(`/apps/${connectionId}/permissions`)
                : setStep(step - 1)
            }
          >
            <ArrowLeft className="size-4" />
            {t("emailendpointsetup.general.back2")}</Button>
          <Button
            disabled={
              !chosen ||
              (lowTrust && !scoped) ||
              (step >= 4 &&
                (!inspected.data ||
                  (addressMode === "existing"
                    ? !inboxId
                    : !/^[a-z0-9][a-z0-9._-]*$/.test(username)))) ||
              setup.isPending
            }
            onClick={() => (step === 5 ? setup.mutate() : setStep(step + 1))}
          >
            {setup.isPending
              ? t("emailendpointsetup.general.activating")
              : step === 5
                ? addressMode === "new"
                  ? t("emailendpointsetup.general.createemailaddress")
                  : t("emailendpointsetup.general.connectemailaddress")
                : step === 4
                  ? t("emailendpointsetup.general.reviewemailaddress")
                  : t("emailendpointsetup.general.continue")}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
      <Dialog open={trustOpen} onOpenChange={setTrustOpen}>
        <DialogContent className="max-h-screen overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("emailendpointsetup.general.trustsettings")} {chosen?.name}</DialogTitle>
            <DialogDescription>
              {t("emailendpointsetup.general.changesapplytoallofthisagent")}</DialogDescription>
          </DialogHeader>
          <TrustPresetSection
            permissions={permissions}
            onChange={setPermissions}
            companyId={companyId}
            projectCandidates={(projects.data ?? []).map((p) => ({
              id: p.id,
              label: p.name,
            }))}
            issueCandidates={(boundaryIssues.data ?? []).map((issue) => ({
              id: issue.id,
              label: `${issue.identifier} · ${issue.title}`,
            }))}
            allowSingleIssue={false}
            candidatesLoading={projects.isPending || boundaryIssues.isPending}
          />
          <p className="text-xs text-muted-foreground">
            {t("emailendpointsetup.general.lowtrustlimitspaperclipaccessitdoes")}</p>
          {(trust.error || projects.error || boundaryIssues.error) && (
            <p role="alert" className="text-sm text-destructive">
              {(trust.error ?? projects.error ?? boundaryIssues.error)?.message}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTrustOpen(false)}>
              {t("emailendpointsetup.general.cancel3")}</Button>
            <Button
              disabled={
                trust.isPending ||
                agentDetail.isPending ||
                !!agentDetail.error ||
                (getTrustPreset(permissions) === "low_trust_review" &&
                  !lowTrustBoundaryHasScope(getLowTrustBoundary(permissions)))
              }
              onClick={() => trust.mutate()}
            >
              {t("emailendpointsetup.general.savetrustsettings")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function EmailConnectionInboxes({
  companyId,
  connectionId,
  canConfigure,
}: {
  companyId: string;
  connectionId: string;
  canConfigure: boolean;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["email-inboxes", companyId],
    queryFn: () => emailApi.list(companyId),
    refetchInterval: 10_000,
  });
  const connections = useQuery({
    queryKey: queryKeys.tools.connections(companyId),
    queryFn: () => toolsApi.listConnections(companyId),
  });
  const children = new Set(
    connections.data?.connections
      .filter((c) => c.config?.credentialConnectionId === connectionId)
      .map((c) => c.id),
  );
  const inboxes =
    query.data?.filter(
      (i) => i.connectionId === connectionId || children.has(i.connectionId),
    ) ?? [];
  const statusLabels: Record<string, string> = {
    active: t("emailendpointsetup.general.receivingemailstatus"),
    draft: t("emailendpointsetup.general.draftstatus"),
    verifying: t("emailendpointsetup.general.verifyingstatus"),
    paused: t("emailendpointsetup.general.pausedstatus"),
    attention: t("emailendpointsetup.general.attentionstatus"),
    revoked: t("emailendpointsetup.general.revokedstatus"),
    archived: t("emailendpointsetup.general.archivedstatus"),
  };
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {t("emailendpointsetup.general.giveanagentanemailaddress4")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("emailendpointsetup.general.eachemailconversationbecomesatask")}</p>
        </div>
        {canConfigure && (
          <Button asChild size="lg">
            <Link
              to={`/apps/chat/connect?provider=agentmail&connectionId=${connectionId}`}
            >
              {t("emailendpointsetup.general.giveanagentanemailaddress5")}</Link>
          </Button>
        )}
      </div>
      {inboxes.map((i) => (
        <div
          key={i.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
        >
          <Link
            className="text-sm underline"
            to={`/apps/chat/${i.id}/settings`}
          >
            {i.address}
          </Link>
          <span className="text-xs text-muted-foreground">
            {i.lastError ??
              (statusLabels[i.status] ?? i.status)}
          </span>
        </div>
      ))}
      {!!inboxes.length && <EmailSafetyNotice />}
      {query.error && (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      )}
    </section>
  );
}
export function EmailEndpointSettings({
  endpointId,
  companyId,
}: {
  endpointId: string;
  companyId: string;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["email-inboxes", companyId],
    queryFn: () => emailApi.list(companyId),
    refetchInterval: 10_000,
  });
  const inbox = query.data?.find(
    (row: EmailEndpointSummary) => row.id === endpointId,
  );
  const [removed, setRemoved] = useState(false);
  const [replacementKey, setReplacementKey] = useState("");
  const [receiveMode, setReceiveMode] = useState<"websocket" | "webhook" | "">(
    "",
  );
  const reconnect = useMutation({
    mutationFn: () =>
      emailApi.reconnect(
        endpointId,
        replacementKey,
        receiveMode || inbox!.receiveMode,
      ),
    onSuccess: () => {
      setReplacementKey("");
    },
    onSettled: () => {
      void cache.invalidateQueries({ queryKey: ["email-inboxes", companyId] });
    },
  });
  const control = useMutation({
    mutationFn: (action: "pause" | "resume" | "remove") =>
      emailApi.control(endpointId, action),
    onSuccess: (result) => {
      setRemoved(result.status === "archived");
      void cache.invalidateQueries({ queryKey: ["email-inboxes", companyId] });
    },
  });
  if (removed)
    return <p>{t("emailendpointsetup.general.inboxdisconnectedemailhistoryremainsinits")}</p>;
  if (!inbox)
    return (
      <p role={query.error ? "alert" : undefined}>
        {query.error?.message ?? t("emailendpointsetup.general.loadingemailinbox")}
      </p>
    );
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-bold">{inbox.address}</h1>
      <p className="text-sm text-muted-foreground">
        {inbox.status} ·{" "}
        {inbox.receiveMode === "websocket" ? t("emailendpointsetup.general.liveconnection6") : t("emailendpointsetup.general.webhook")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("emailendpointsetup.general.lastmailcheck")} {inbox.lastSyncAt ? new Date(inbox.lastSyncAt).toLocaleString() : t("emailendpointsetup.general.notcheckedyet")}
      </p>
      <p className="text-sm">
        {t("emailendpointsetup.general.eachemailconversationisatasktask")}</p>
      {inbox.lastError && (
        <p role="alert" className="text-sm text-destructive">
          {inbox.lastError}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={control.isPending}
          onClick={() =>
            control.mutate(inbox.status === "active" ? "pause" : "resume")
          }
        >
          {inbox.status === "active" ? t("emailendpointsetup.general.pause") : t("emailendpointsetup.general.resume")}
        </Button>
        <Button
          variant="outline"
          disabled={control.isPending}
          onClick={() => control.mutate("remove")}
        >
          {t("emailendpointsetup.general.disconnectinbox")}</Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-reconnect-key">
          {t("emailendpointsetup.general.reconnectthisinboxwithanewapi")}</Label>
        <Input
          id="email-reconnect-key"
          type="password"
          autoComplete="off"
          value={replacementKey}
          onChange={(e) => setReplacementKey(e.target.value)}
        />
        <Label htmlFor="email-reconnect-mode">{t("emailendpointsetup.general.receivingmode")}</Label>
        <select
          id="email-reconnect-mode"
          className={selectClass}
          value={receiveMode || inbox.receiveMode}
          onChange={(e) =>
            setReceiveMode(e.target.value as "websocket" | "webhook")
          }
        >
          <option value="websocket">{t("emailendpointsetup.general.liveconnection7")}</option>
          <option value="webhook">{t("emailendpointsetup.general.webhook8")}</option>
        </select>
        <Button
          variant="outline"
          disabled={!replacementKey || reconnect.isPending}
          onClick={() => reconnect.mutate()}
        >
          {t("emailendpointsetup.general.reconnectinbox")}</Button>
      </div>
      {reconnect.error && (
        <p role="alert" className="text-sm text-destructive">
          {reconnect.error.message}
        </p>
      )}
      {control.error && (
        <p role="alert" className="text-sm text-destructive">
          {control.error.message}
        </p>
      )}
    </div>
  );
}
