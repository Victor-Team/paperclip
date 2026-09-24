import { PhotonConnectStep } from "./PhotonConnectStep";
import { EmailEndpointSetup } from "./EmailEndpointSetup";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react";
import { Trans } from "react-i18next";
import { AgentSelect } from "@/components/AgentMultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/context/ToastContext";
import { agentsApi } from "@/api/agents";
import { instanceSettingsApi } from "@/api/instanceSettings";
import {
  chatEndpointsApi,
  type ChatEndpoint,
  type ChatProvider,
  type ChatEndpointSetupAction,
} from "@/api/chatEndpoints";
import { useNavigate, useSearchParams } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { copyTextToClipboard } from "@/lib/clipboard";
import { isAgentStatusInvokable } from "@paperclipai/shared";
import { sanitizedSetupErrorMessage } from "./chat-setup-error";
import { useTranslation } from "@/i18n";
import {
  createGitHubPrivateKeyReadGuard,
  readGitHubPrivateKeyFile,
} from "./github-private-key-file";

const providerNames: Record<ChatProvider, string> = {
  agentmail: "AgentMail",
  slack: "Slack",
  github: "GitHub",
  discord: "Discord",
  "microsoft-teams": "Microsoft Teams",
  telegram: "Telegram",
  "imessage-photon": "iMessage Photon",
};

const knownProviders = new Set(Object.keys(providerNames));

function isProvider(value: string | null): value is ChatProvider {
  return value !== null && knownProviders.has(value);
}

function slackBotNameForAgent(agentName: string): string {
  const safeName = agentName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return safeName || "paperclip-agent";
}

function publicOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isChatEndpointRepairing(
  endpoint: Pick<
    ChatEndpoint,
    "provider" | "status" | "providerAccountId" | "botExternalId"
  > | null,
  resumeEndpointId: string | null,
  reconnectRequested: boolean,
): boolean {
  if (!resumeEndpointId || !endpoint) return false;
  const recoveringStatus =
    endpoint.status === "attention" || endpoint.status === "revoked";
  // A secret-only GitHub draft affected by setup trouble has no App identity
  // or reusable App credentials. It must remain first-time setup, where App ID
  // and private key are required, rather than offering a misleading reconnect.
  if (
    endpoint.provider === "github" &&
    recoveringStatus &&
    !endpoint.providerAccountId &&
    !endpoint.botExternalId
  ) {
    return false;
  }
  return (
    recoveringStatus ||
    (reconnectRequested &&
      (endpoint.status === "active" || endpoint.status === "paused"))
  );
}

function SetupRail({ step }: { step: number }) {
  const { t } = useTranslation();
  return (
    <ol
      className="space-y-2 text-sm"
      aria-label={t("chatendpointsetup.general.connectionsetupprogress")}
    >
      {[
        t("chatendpointsetup.general.chooseagent"),
        t("chatendpointsetup.general.connectprovider"),
        t("chatendpointsetup.general.tryit"),
      ].map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border ${index < step ? "border-primary bg-primary text-primary-foreground" : index === step ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}
          >
            {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <span
            className={
              index === step
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ChatEndpointSetup() {
  const [params] = useSearchParams();
  return params.get("provider") === "agentmail" ? <EmailEndpointSetup /> : <ChatSdkEndpointSetup />;
}
function ChatSdkEndpointSetup() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const provider = isProvider(params.get("provider"))
    ? (params.get("provider") as ChatProvider)
    : null;
  const toolHref = params.get("toolHref") || "/apps";
  const preselectedAgent = params.get("agentId") ?? "";
  const resumeEndpointId = params.get("resume") ?? "";
  const reconnectRequested = params.get("reconnect") === "1";
  const [purpose, setPurpose] = useState<"choice" | "chat">(
    params.get("purpose") === "chat" ? "chat" : "choice",
  );
  const [agentId, setAgentId] = useState(preselectedAgent);
  const [endpoint, setEndpoint] = useState<ChatEndpoint | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [generatedWebhookSecret, setGeneratedWebhookSecret] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Connectors", href: "/apps" },
      { label: "Connect chat" },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const agentsQuery = useQuery({
    queryKey: ["chat-endpoint-setup-agents", selectedCompanyId],
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const resumeQuery = useQuery({
    queryKey: ["chat-endpoint-setup-resume", resumeEndpointId],
    queryFn: () => chatEndpointsApi.get(resumeEndpointId),
    enabled: Boolean(resumeEndpointId),
  });
  useEffect(() => {
    if (!resumeQuery.data) return;
    setEndpoint(resumeQuery.data);
    setAgentId(resumeQuery.data.assignedAgentId);
    setPurpose("chat");
  }, [resumeQuery.data]);
  const githubVerificationQuery = useQuery({
    queryKey: ["chat-endpoint-github-webhook-verification", endpoint?.id],
    queryFn: () => chatEndpointsApi.get(endpoint!.id),
    enabled: Boolean(
      provider === "github" &&
      endpoint?.id &&
      endpoint.setup?.step === "provider_setup" &&
      endpoint.setup?.webhookSecretConfigured &&
      !endpoint.setup.webhookVerifiedAt,
    ),
    refetchInterval: 1_500,
  });
  useEffect(() => {
    if (
      !githubVerificationQuery.data ||
      provider !== "github" ||
      !endpoint ||
      endpoint.id !== githubVerificationQuery.data.id ||
      endpoint.setup?.step !== "provider_setup" ||
      !endpoint.setup?.webhookSecretConfigured ||
      endpoint.setup.webhookVerifiedAt
    )
      return;
    setEndpoint(githubVerificationQuery.data);
  }, [endpoint, githubVerificationQuery.data, provider]);
  const experimentalSettingsQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
    enabled: endpoint?.setup?.step === "test",
  });
  const activeAgents = useMemo(
    () =>
      (agentsQuery.data ?? []).filter((agent) =>
        isAgentStatusInvokable(agent.status),
      ),
    [agentsQuery.data],
  );
  const syncEndpointSnapshot = (
    next: ChatEndpoint,
    onlyIfStillVisible = false,
  ) => {
    setEndpoint((visible) =>
      onlyIfStillVisible && visible?.id !== next.id ? visible : next,
    );
    queryClient.setQueryData(["chat-endpoint-setup-resume", next.id], next);
    queryClient.setQueryData(queryKeys.chatEndpoints.detail(next.id), next);
    if (next.provider === "github") {
      queryClient.setQueryData(
        ["chat-endpoint-github-webhook-verification", next.id],
        next,
      );
    }
  };
  const createEndpoint = useMutation({
    mutationFn: () =>
      chatEndpointsApi.create(selectedCompanyId!, {
        provider: provider!,
        assignedAgentId: agentId,
      }),
    onSuccess: (next) => {
      syncEndpointSnapshot(next);
      if (next.provider === "imessage-photon") {
        const resumed = new URLSearchParams(params);
        resumed.set("resume", next.id);
        setParams(resumed, { replace: true });
      }
    },
    onError: (error) =>
      pushToast({
        title: t("chatendpointsetup.general.couldntstartsetup"),
        body: error instanceof Error ? error.message : t("chatendpointsetup.general.tryagain"),
        tone: "error",
      }),
  });
  const setupAction = useMutation({
    mutationFn: ({
      action,
      values,
    }: {
      action: ChatEndpointSetupAction;
      values?: Record<string, string>;
    }) => chatEndpointsApi.setup(endpoint!.id, provider === "imessage-photon" ? {
      action,
      ...(values?.projectSecret ? { credentials: { projectSecret: values.projectSecret } } : {}),
      ...(values?.projectId && values.allocation === "shared" ? { photon: { allocation: "shared" as const, projectId: values.projectId } } : values?.projectId && values?.lineId ? { photon: { allocation: "dedicated" as const, projectId: values.projectId, lineId: values.lineId } } : {}),
    } : { action, credentials: values }),
    onMutate: () => setSetupError(null),
    onSuccess: (next) => {
      setSetupError(null);
      syncEndpointSnapshot(next);
      setCredentials({});
    },
    onError: (error, variables) =>
      setSetupError(sanitizedSetupErrorMessage(error, variables.values)),
  });
  const generateSetupSecret = useMutation({
    mutationFn: () => chatEndpointsApi.generateSetupSecret(endpoint!.id),
    onMutate: async () => {
      const endpointId = endpoint!.id;
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ["chat-endpoint-github-webhook-verification", endpointId],
          exact: true,
        }),
        queryClient.cancelQueries({
          queryKey: ["chat-endpoint-setup-resume", endpointId],
          exact: true,
        }),
        queryClient.cancelQueries({
          queryKey: queryKeys.chatEndpoints.detail(endpointId),
          exact: true,
        }),
      ]);
      return { endpointId };
    },
    onSuccess: async ({ webhookSecret }, _variables, context) => {
      const endpointId = context.endpointId;
      const markRotated = (current: ChatEndpoint) => ({
        ...current,
        setup: {
          ...current.setup,
          step: "provider_setup" as const,
          webhookSecretConfigured: true,
          webhookVerifiedAt: null,
        },
      });

      queryClient.removeQueries({
        queryKey: ["chat-endpoint-github-webhook-verification", endpointId],
        exact: true,
      });
      setGeneratedWebhookSecret(webhookSecret);
      setEndpoint((current) =>
        current && current.id === endpointId ? markRotated(current) : current,
      );
      queryClient.setQueryData<ChatEndpoint>(
        ["chat-endpoint-setup-resume", endpointId],
        (current) => (current ? markRotated(current) : current),
      );
      queryClient.setQueryData<ChatEndpoint>(
        queryKeys.chatEndpoints.detail(endpointId),
        (current) => (current ? markRotated(current) : current),
      );

      try {
        const current = await chatEndpointsApi.get(endpointId);
        syncEndpointSnapshot(current, true);
      } catch {
        // Keep the one-time secret copyable. Verification polling will retry the
        // canonical endpoint read without restoring a pre-rotation snapshot.
      }
    },
    onError: (error) =>
      pushToast({
        title: t("chatendpointsetup.general.couldntgeneratewebhooksecret"),
        body: error instanceof Error ? error.message : t("chatendpointsetup.general.tryagain"),
        tone: "error",
      }),
  });
  const testConnection = useMutation({
    mutationFn: () => chatEndpointsApi.test(endpoint!.id),
    onSuccess: (next) => {
      syncEndpointSnapshot(next);
      if (next.status === "active") navigate(`/apps/chat/${next.id}/settings`);
    },
    onError: (error) =>
      pushToast({
        title: t("chatendpointsetup.general.testnotcomplete"),
        body:
          error instanceof Error
            ? error.message
            : t("chatendpointsetup.general.sendtheprovidermessagethentryagain"),
        tone: "error",
      }),
  });

  if (!provider)
    return (
      <p className="text-sm text-destructive">
        {t("chatendpointsetup.general.thischatproviderisnotsupported")}
      </p>
    );
  if (!selectedCompanyId)
    return (
      <p className="text-sm text-muted-foreground">
        {t("chatendpointsetup.general.selectanorganizationtoconnectchat")}
      </p>
    );

  if (purpose === "choice") {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold">
            {t("chatendpointsetup.general.choosehowtoconnect")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("chatendpointsetup.general.whatshouldthisconnectiondo", {
              providerName: providerNames[provider],
            })}
          </p>
        </div>
        <div className="grid gap-3">
          <button
            type="button"
            className="rounded-xl border border-border p-4 text-left hover:bg-accent/40"
            onClick={() => setPurpose("chat")}
          >
            <span className="block text-sm font-semibold">
              {t("chatendpointsetup.general.chatwithanagent")}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t("chatendpointsetup.general.peopleincanstartandcontinue", {
                providerName: providerNames[provider],
              })}
            </span>
          </button>
          <button
            type="button"
            className="rounded-xl border border-border p-4 text-left hover:bg-accent/40"
            onClick={() => navigate(toolHref)}
          >
            <span className="block text-sm font-semibold">
              {t("chatendpointsetup.general.usethisconnectionasanagenttool")}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {t("chatendpointsetup.general.letagentsuseactionsanddata", {
                providerName: providerNames[provider],
              })}
            </span>
          </button>
        </div>
      </div>
    );
  }

  const repairing = isChatEndpointRepairing(
    endpoint,
    resumeEndpointId,
    reconnectRequested,
  );
  const step = endpoint
    ? !repairing &&
      (endpoint.setup?.step === "test" || endpoint.setup?.step === "complete")
      ? 2
      : 1
    : 0;
  const selectedAgent = activeAgents.find((agent) => agent.id === agentId);
  return (
    <div className="grid max-w-4xl gap-8 md:grid-cols-(--gtc-11)">
      <SetupRail step={step} />
      <main className="min-w-0 space-y-6">
        {!endpoint ? (
          <>
            <div>
              <h1 className="text-xl font-bold">
                {t("chatendpointsetup.general.whichagentdoyouwanttochat")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("chatendpointsetup.general.thisagentispermanentfortheconnection")}
              </p>
            </div>
            <AgentSelect
              agents={activeAgents}
              value={agentId}
              onChange={setAgentId}
              placeholder={t("chatendpointsetup.general.chooseanactiveagent")}
              emptyMessage={t("chatendpointsetup.general.noactiveagentsareavailable")}
            />
            <div className="flex justify-end">
              <Button
                disabled={!agentId || createEndpoint.isPending}
                onClick={() => createEndpoint.mutate()}
              >
                {createEndpoint.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t("chatendpointsetup.general.continue")}
              </Button>
            </div>
          </>
        ) : step === 1 ? (
          <>
            {setupError ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <p className="font-medium">
                  {t("chatendpointsetup.general.connectionfailed")}
                </p>
                <p className="mt-1">{setupError}</p>
              </div>
            ) : null}
            <ProviderConnectStep
              key={`${provider}:${endpoint.id}`}
              provider={provider}
              agentName={selectedAgent?.name ?? endpoint.assignedAgentName}
              endpoint={endpoint}
              credentials={credentials}
              setCredentials={setCredentials}
              repairing={repairing}
              pending={setupAction.isPending}
              generatedWebhookSecret={generatedWebhookSecret}
              generatingSetupSecret={generateSetupSecret.isPending}
              onGenerateSetupSecret={() => generateSetupSecret.mutate()}
              onAction={(action, values) =>
                setupAction.mutate({ action, values })
              }
            />
          </>
        ) : (
          <TryStep
            endpointId={endpoint.id}
            provider={provider}
            agentName={selectedAgent?.name ?? endpoint.assignedAgentName}
            botLabel={endpoint.botLabel}
            botUsername={endpoint.botUsername}
            photonAllocation={endpoint.photonAllocation}
            providerUrl={endpoint.setup?.providerUrl}
            guestIsolationState={
              experimentalSettingsQuery.isPending
                ? "loading"
                : experimentalSettingsQuery.isError
                  ? "unknown"
                  : experimentalSettingsQuery.data?.enableIsolatedWorkspaces ===
                      true
                    ? "enabled"
                    : "disabled"
            }
            pending={testConnection.isPending}
            onOpenAccess={() => navigate(`/apps/chat/${endpoint.id}/access`)}
            onTest={() => testConnection.mutate()}
          />
        )}
        <div className="flex justify-start">
          <Button variant="ghost" onClick={() => navigate("/apps")}>
            {t("chatendpointsetup.general.saveampexit")}
          </Button>
        </div>
      </main>
    </div>
  );
}

function ProviderConnectStep({
  provider,
  agentName,
  endpoint,
  credentials,
  setCredentials,
  repairing,
  pending,
  generatedWebhookSecret,
  generatingSetupSecret,
  onGenerateSetupSecret,
  onAction,
}: {
  provider: ChatProvider;
  agentName: string;
  endpoint: ChatEndpoint;
  credentials: Record<string, string>;
  setCredentials: Dispatch<SetStateAction<Record<string, string>>>;
  repairing: boolean;
  pending: boolean;
  generatedWebhookSecret: string;
  generatingSetupSecret: boolean;
  onGenerateSetupSecret: () => void;
  onAction: (
    action: ChatEndpointSetupAction,
    values?: Record<string, string>,
  ) => void;
}) {
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const reportCopyFailure = () =>
    pushToast({
      title: t("chatendpointsetup.general.couldntcopytoclipboard"),
      body: t("chatendpointsetup.general.selectandcopyvalue"),
      tone: "error",
    });
  const field = (key: string, label: string, type = "password") => (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <Input
        type={type}
        value={credentials[key] ?? ""}
        onChange={(event) =>
          setCredentials({ ...credentials, [key]: event.target.value })
        }
      />
    </label>
  );
  const openProviderSetup = (fallback: string) =>
    window.open(
      endpoint.setup?.authorizationUrl ??
        endpoint.setup?.providerUrl ??
        fallback,
      "_blank",
      "noopener,noreferrer",
    );
  const endpointValue = (label: string, value: string | null | undefined) => (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="rounded-lg border border-border bg-muted p-3 font-mono text-xs break-all">
        {value ??
          "This endpoint is unavailable. Check the server's public URL."}
      </div>
    </div>
  );
  const [manifestCopied, setManifestCopied] = useState(false);
  const [privateKeyVisible, setPrivateKeyVisible] = useState(false);
  const [privateKeyFileError, setPrivateKeyFileError] = useState<string | null>(
    null,
  );
  const [privateKeyFileLoaded, setPrivateKeyFileLoaded] = useState(false);
  const [privateKeyFileLoading, setPrivateKeyFileLoading] = useState(false);
  const privateKeyFileInputRef = useRef<HTMLInputElement>(null);
  const privateKeyReadGuard = useRef(createGitHubPrivateKeyReadGuard()).current;
  useEffect(
    () => () => {
      privateKeyReadGuard.invalidate();
    },
    [privateKeyReadGuard],
  );
  const loadPrivateKeyFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const readRevision = privateKeyReadGuard.start();
    setPrivateKeyFileError(null);
    setPrivateKeyFileLoaded(false);
    setPrivateKeyFileLoading(true);
    try {
      const privateKey = await readGitHubPrivateKeyFile(file);
      if (!privateKeyReadGuard.isCurrent(readRevision)) return;
      setCredentials((current) => ({ ...current, privateKey }));
      setPrivateKeyVisible(false);
      setPrivateKeyFileLoaded(true);
    } catch (error) {
      if (!privateKeyReadGuard.isCurrent(readRevision)) return;
      setPrivateKeyFileError(
        error instanceof Error
          ? error.message
          : "Paperclip couldn't read that file. Choose the .pem file again or paste the private key.",
      );
    } finally {
      if (privateKeyReadGuard.isCurrent(readRevision)) {
        setPrivateKeyFileLoading(false);
      }
    }
  };
  const replacePrivateKey = (privateKey: string) => {
    privateKeyReadGuard.invalidate();
    setPrivateKeyFileError(null);
    setPrivateKeyFileLoaded(false);
    setPrivateKeyFileLoading(false);
    setCredentials((current) => ({ ...current, privateKey }));
  };
  const slackCommand =
    endpoint.setup?.command ??
    `/${
      agentName
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24) || "paperclip"
    }`;
  const slackBotName = slackBotNameForAgent(agentName);
  const slackAppName = `${slackBotName.slice(0, 25)}-paperclip`;
  const slackWebhookUrl =
    endpoint.setup?.webhookUrl ?? "<paperclip-webhook-url>";
  const slackManifest = `display_information:
  name: ${JSON.stringify(slackAppName)}
features:
  app_home:
    home_tab_enabled: false
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  agent_view:
    agent_description: "Work with a Paperclip agent in a task-backed conversation."
  bot_user:
    display_name: ${JSON.stringify(slackBotName)}
  slash_commands:
    - command: ${JSON.stringify(slackCommand)}
      description: Start or manage work with ${JSON.stringify(agentName)}
      usage_hint: ${JSON.stringify("status | new | close | <task>")}
      should_escape: false
      url: ${JSON.stringify(slackWebhookUrl)}
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - assistant:write
      - channels:history
      - channels:read
      - chat:write
      - commands
      - files:read
      - files:write
      - groups:history
      - groups:read
      - im:history
      - im:read
      - mpim:history
      - mpim:read
      - reactions:read
      - reactions:write
      - users:read
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
  event_subscriptions:
    request_url: ${JSON.stringify(slackWebhookUrl)}
    bot_events:
      - agent_session_stopped
      - app_mention
      - message.channels
      - message.groups
      - message.im
      - message.mpim
      - member_joined_channel
      - member_left_channel
      - channel_left
      - group_left
      - reaction_added
      - reaction_removed
      - channel_archive
      - group_archive
      - channel_unarchive
      - group_unarchive
      - channel_deleted
      - channel_rename
      - group_rename
      - app_uninstalled
      - tokens_revoked
  interactivity:
    is_enabled: true
    request_url: ${JSON.stringify(slackWebhookUrl)}`;
  const teamsClientId =
    credentials.clientId?.trim() || "<application-client-id>";
  const teamsManifestSettings = JSON.stringify(
    {
      bots: [
        {
          botId: teamsClientId,
          scopes: ["personal", "team", "groupChat"],
          supportsFiles: true,
          isNotificationOnly: false,
          commandLists: [
            {
              scopes: ["personal", "groupChat"],
              commands: [
                {
                  title: "/status",
                  description: t("chatendpointsetup.teams.commandstatus"),
                },
                {
                  title: "/new",
                  description: t("chatendpointsetup.teams.commandnew"),
                },
                {
                  title: "/close",
                  description: t("chatendpointsetup.teams.commandclose"),
                },
              ],
            },
          ],
        },
      ],
      webApplicationInfo: {
        id: teamsClientId,
        resource: "https://paperclip.ing",
      },
      authorization: {
        permissions: {
          resourceSpecific: [
            { name: "ChannelMessage.Read.Group", type: "Application" },
            { name: "ChatMessage.Read.Chat", type: "Application" },
          ],
        },
      },
    },
    null,
    2,
  );
  if (provider === "imessage-photon") return <PhotonConnectStep endpoint={endpoint} agentName={agentName} repairing={repairing} pending={pending} onAction={onAction} />;
  if (provider === "discord") {
    const applicationId = credentials.applicationId?.trim() ?? "";
    const guildId = credentials.guildId?.trim() ?? "";
    const installUrl = applicationId
      ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(applicationId)}&permissions=309237763136&scope=bot${guildId ? `&guild_id=${encodeURIComponent(guildId)}&disable_guild_select=true` : ""}`
      : null;
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">
            {t("chatendpointsetup.discord.title", { agentName })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {repairing
              ? t("chatendpointsetup.discord.reconnectdescription")
              : t("chatendpointsetup.discord.createdescription")}
          </p>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>{t("chatendpointsetup.discord.step1")}</li>
          <li>{t("chatendpointsetup.discord.step2")}</li>
          <li>{t("chatendpointsetup.discord.step3")}</li>
          <li>{t("chatendpointsetup.discord.step4")}</li>
        </ol>
        <Button
          variant="outline"
          onClick={() =>
            openProviderSetup("https://discord.com/developers/applications")
          }
        >
          {t("chatendpointsetup.discord.opendeveloperportal")} <ExternalLink />
        </Button>
        {field("applicationId", t("chatendpointsetup.discord.applicationid"), "text")}
        {field("guildId", t("chatendpointsetup.discord.serverid"), "text")}
        {field("botToken", t("chatendpointsetup.discord.bottoken"))}
        {installUrl && (
          <Button asChild variant="outline">
            <a href={installUrl} target="_blank" rel="noreferrer">
              {t("chatendpointsetup.discord.installbot")} <ExternalLink />
            </a>
          </Button>
        )}
        <p className="text-sm text-muted-foreground">
          {t("chatendpointsetup.discord.installpermissions")}
        </p>
        <Button
          disabled={
            (!repairing &&
              (!credentials.applicationId ||
                !credentials.guildId ||
                !credentials.botToken)) ||
            pending
          }
          onClick={() =>
            onAction(repairing ? "reconnect" : "configure", credentials)
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {repairing
            ? t("chatendpointsetup.discord.reconnectbot")
            : t("chatendpointsetup.discord.connectbot")}
        </Button>
      </div>
    );
  }
  if (provider === "telegram")
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">
            {t("chatendpointsetup.telegram.title", { agentName })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {repairing
              ? t("chatendpointsetup.telegram.reconnectdescription")
              : t("chatendpointsetup.telegram.createdescription")}
          </p>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            {t("chatendpointsetup.telegram.openbotfather")} <code>/newbot</code>.
          </li>
          <li>{t("chatendpointsetup.telegram.enterdisplayname")}</li>
          <li>
            {t("chatendpointsetup.telegram.chooseusername")} <code>bot</code>.
          </li>
        </ol>
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {t("chatendpointsetup.telegram.groupnoticebefore")} {" "}
          <code>/task@bot_username &lt;request&gt;</code>
          {t("chatendpointsetup.telegram.groupnoticeafter")}
        </p>
        <Button
          variant="outline"
          onClick={() => openProviderSetup("https://t.me/BotFather")}
        >
          {t("chatendpointsetup.telegram.openbotfatherbutton")} <ExternalLink />
        </Button>
        {field("botToken", t("chatendpointsetup.telegram.bottoken"))}
        {!endpoint.setup?.webhookUrl && (
          <p className="text-sm text-destructive">
            {t("chatendpointsetup.telegram.publichttpsrequired")}
          </p>
        )}
        <Button
          disabled={
            (!repairing && !credentials.botToken) ||
            !endpoint.setup?.webhookUrl ||
            pending
          }
          onClick={() =>
            onAction(repairing ? "reconnect" : "configure", credentials)
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {repairing
            ? t("chatendpointsetup.telegram.reconnectbot")
            : t("chatendpointsetup.telegram.connectbot")}
        </Button>
      </div>
    );
  if (provider === "microsoft-teams")
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">
            {t("chatendpointsetup.teams.title", { agentName })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {repairing
              ? t("chatendpointsetup.teams.reconnectdescription")
              : t("chatendpointsetup.teams.createdescription")}
          </p>
        </div>
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {t("chatendpointsetup.teams.organizationsupport")}
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>{t("chatendpointsetup.teams.step1")}</li>
          <li>{t("chatendpointsetup.teams.step2")}</li>
          <li>{t("chatendpointsetup.teams.step3")}</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a
              href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
              target="_blank"
              rel="noreferrer"
            >
              {t("chatendpointsetup.teams.openentra")} <ExternalLink />
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://portal.azure.com/#create/Microsoft.AzureBot"
              target="_blank"
              rel="noreferrer"
            >
              {t("chatendpointsetup.teams.createazurebot")} <ExternalLink />
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://dev.teams.microsoft.com/apps"
              target="_blank"
              rel="noreferrer"
            >
              {t("chatendpointsetup.teams.opendeveloperportal")} <ExternalLink />
            </a>
          </Button>
        </div>
        {endpointValue(
          t("chatendpointsetup.teams.messagingendpoint"),
          endpoint.setup?.messagingEndpoint,
        )}
        {field("clientId", t("chatendpointsetup.teams.applicationclientid"), "text")}
        {field("tenantId", t("chatendpointsetup.teams.directorytenantid"), "text")}
        {field("clientSecret", t("chatendpointsetup.teams.clientsecretvalue"))}
        <section className="space-y-3 rounded-lg border border-border p-4">
          <div>
            <h2 className="text-sm font-semibold">
              {t("chatendpointsetup.teams.portalmaptitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("chatendpointsetup.teams.portalmapdescription")}
            </p>
          </div>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              <Trans
                i18nKey="chatendpointsetup.teams.portalstep1"
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="chatendpointsetup.teams.portalstep2"
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="chatendpointsetup.teams.portalstep3"
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="chatendpointsetup.teams.portalstep4"
                components={{ strong: <strong /> }}
              />
            </li>
          </ol>
        </section>
        <label className="grid gap-2 text-sm font-medium">
          {t("chatendpointsetup.teams.manifestlabel")}
          <Textarea
            className="min-h-80 font-mono text-xs"
            readOnly
            value={teamsManifestSettings}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!credentials.clientId?.trim()}
            onClick={() => {
              void copyTextToClipboard(teamsManifestSettings).then(
                () => setManifestCopied(true),
                reportCopyFailure,
              );
            }}
          >
            {manifestCopied
              ? t("chatendpointsetup.teams.manifestcopied")
              : t("chatendpointsetup.teams.copymanifest")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("chatendpointsetup.teams.manifestdescription")}
        </p>
        <p className="text-sm text-muted-foreground">
          <Trans
            i18nKey="chatendpointsetup.teams.ssodescription"
            components={{ code: <code /> }}
          />
        </p>
        <p className="text-sm text-muted-foreground">
          {t("chatendpointsetup.teams.rscdescription")}
        </p>
        <p className="text-sm text-muted-foreground">
          <Trans
            i18nKey="chatendpointsetup.teams.filesdescription"
            components={{ code: <code /> }}
          />
        </p>
        {!endpoint.setup?.messagingEndpoint && (
          <p className="text-sm text-destructive">
            {t("chatendpointsetup.teams.publichttpsrequired")}
          </p>
        )}
        <Button
          disabled={
            (!repairing &&
              (!credentials.clientId ||
                !credentials.tenantId ||
                !credentials.clientSecret)) ||
            !endpoint.setup?.messagingEndpoint ||
            pending
          }
          onClick={() =>
            onAction(repairing ? "reconnect" : "configure", credentials)
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {repairing
            ? t("chatendpointsetup.teams.reconnectapp")
            : t("chatendpointsetup.teams.verifycredentials")}
        </Button>
      </div>
    );
  if (provider === "github")
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">
            {repairing
              ? t("chatendpointsetup.github.reconnectapp")
              : t("chatendpointsetup.github.createorconnectapp")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {repairing
              ? t("chatendpointsetup.github.reconnectdescription")
              : t("chatendpointsetup.github.createdescription")}
          </p>
        </div>
        {!repairing && (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              <Trans
                i18nKey="chatendpointsetup.github.step1"
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="chatendpointsetup.github.step2"
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="chatendpointsetup.github.step3"
                components={{ strong: <strong /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="chatendpointsetup.github.step4"
                components={{ strong: <strong />, code: <code /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="chatendpointsetup.github.step5"
                components={{ strong: <strong /> }}
              />
            </li>
          </ol>
        )}
        {endpointValue(
          t("chatendpointsetup.github.homepageurl"),
          publicOrigin(endpoint.setup?.webhookUrl),
        )}
        {endpointValue(
          t("chatendpointsetup.github.webhookurl"),
          endpoint.setup?.webhookUrl,
        )}
        <Button
          variant="outline"
          onClick={() =>
            window.open(
              repairing
                ? "https://github.com/settings/apps"
                : (endpoint.setup?.authorizationUrl ??
                    "https://github.com/settings/apps/new"),
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          {repairing
            ? t("chatendpointsetup.github.openappsettings")
            : t("chatendpointsetup.github.opennewappform")}{" "}
          <ExternalLink />
        </Button>
        {field("appId", t("chatendpointsetup.github.appid"), "text")}
        <div className="grid gap-2 text-sm font-medium">
          <label htmlFor="github-private-key">
            {t("chatendpointsetup.github.privatekeypem")}
          </label>
          <div className="relative">
            {privateKeyVisible ? (
              <Textarea
                id="github-private-key"
                className="min-h-24 pr-11 font-mono text-xs"
                value={credentials.privateKey ?? ""}
                onChange={(event) => replacePrivateKey(event.target.value)}
              />
            ) : (
              <Input
                id="github-private-key"
                type="password"
                className="pr-11 font-mono text-xs"
                value={credentials.privateKey ?? ""}
                onChange={(event) => replacePrivateKey(event.target.value)}
                onPaste={(event) => {
                  event.preventDefault();
                  replacePrivateKey(event.clipboardData.getData("text"));
                }}
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1"
              aria-label={
                privateKeyVisible
                  ? t("chatendpointsetup.github.hideprivatekey")
                  : t("chatendpointsetup.github.showprivatekey")
              }
              onClick={() => setPrivateKeyVisible((visible) => !visible)}
            >
              {privateKeyVisible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <input
            ref={privateKeyFileInputRef}
            type="file"
            accept=".pem,.key,application/x-pem-file,application/pkcs8,text/plain"
            className="hidden"
            aria-label={t("chatendpointsetup.github.chooseprivatekeyfile")}
            onChange={loadPrivateKeyFile}
          />
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => privateKeyFileInputRef.current?.click()}
            >
              {t("chatendpointsetup.github.choosepemfile")}
            </Button>
          </div>
          {privateKeyFileError ? (
            <p role="alert" className="text-sm text-destructive">
              {privateKeyFileError}
            </p>
          ) : null}
          {privateKeyFileLoading ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {t("chatendpointsetup.github.readingprivatekey")}
            </p>
          ) : privateKeyFileLoaded ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {t("chatendpointsetup.github.privatekeyloaded")}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium">
            {t("chatendpointsetup.github.webhooksecret")}
          </p>
          {generatedWebhookSecret ? (
            <>
              <Input
                aria-label={t("chatendpointsetup.github.generatedwebhooksecret")}
                className="font-mono text-xs"
                readOnly
                value={generatedWebhookSecret}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void copyTextToClipboard(generatedWebhookSecret).catch(
                      reportCopyFailure,
                    );
                  }}
                >
                  {t("chatendpointsetup.github.copywebhooksecret")}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("chatendpointsetup.github.copysecretnow")}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {endpoint.setup?.webhookSecretConfigured
                ? t("chatendpointsetup.github.secretconfigured")
                : t("chatendpointsetup.github.generatesecretandpaste")}
            </p>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={generatingSetupSecret}
              onClick={onGenerateSetupSecret}
            >
              {generatingSetupSecret && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {endpoint.setup?.webhookSecretConfigured
                ? t("chatendpointsetup.github.regeneratewebhooksecret")
                : t("chatendpointsetup.github.generatewebhooksecret")}
            </Button>
          </div>
          {endpoint.setup?.webhookSecretConfigured && (
            <p className="text-sm text-muted-foreground">
              {endpoint.providerAccountId || endpoint.botExternalId
                ? t("chatendpointsetup.github.regeneratingwarning")
                : t("chatendpointsetup.github.generatingwarning")}
            </p>
          )}
          {endpoint.setup?.webhookSecretConfigured && (
            <p
              className={`text-sm ${endpoint.setup.webhookVerifiedAt ? "text-foreground" : "text-muted-foreground"}`}
            >
              {endpoint.setup.webhookVerifiedAt
                ? t("chatendpointsetup.github.webhookverified")
                : t("chatendpointsetup.github.waitingforwebhook")}
            </p>
          )}
        </div>
        {!endpoint.setup?.webhookUrl && (
          <p className="text-sm text-destructive">
            {t("chatendpointsetup.github.publichttpsrequired")}
          </p>
        )}
        <Button
          disabled={
            (!repairing && (!credentials.appId || !credentials.privateKey)) ||
            !endpoint.setup?.webhookSecretConfigured ||
            !endpoint.setup?.webhookVerifiedAt ||
            !endpoint.setup?.webhookUrl ||
            privateKeyFileLoading ||
            generatingSetupSecret ||
            pending
          }
          onClick={() =>
            onAction(repairing ? "reconnect" : "configure", credentials)
          }
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {repairing
            ? t("chatendpointsetup.github.reconnectandverify")
            : t("chatendpointsetup.github.connectandverify")}
        </Button>
      </div>
    );
  if (endpoint.providerAccountId && !repairing)
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Finish Slack setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Point the Slack app at Paperclip now that its signing secret is
            connected.
          </p>
        </div>
        {endpointValue("Paperclip webhook URL", endpoint.setup?.webhookUrl)}
        {endpointValue("Slack command", slackCommand)}
        <div className="rounded-lg border border-border p-3 text-sm">
          <p className="font-medium">Use the registered command</p>
          <p className="mt-1 text-muted-foreground">
            Start work with <code>{slackCommand} investigate this</code>. In a
            direct message, use <code>{slackCommand} status</code>,{" "}
            <code>{slackCommand} new</code>, or{" "}
            <code>{slackCommand} close</code>. Slack&apos;s bare{" "}
            <code>/status</code> command is not a Paperclip control.
          </p>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Return to <strong>App Manifest</strong> in Slack and click{" "}
            <strong>Save Changes</strong>. The copied manifest already contains
            the event, interaction, and slash-command URLs. Slack verifies the
            Events URL when you save; Paperclip records Interactivity and slash
            command health only after each signed callback is observed.
          </li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => openProviderSetup("https://api.slack.com/apps")}
          >
            Open Slack app settings <ExternalLink />
          </Button>
          <Button disabled={pending} onClick={() => onAction("verify")}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Start Slack message test
          </Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Connect a Slack app</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {repairing
            ? "Reconnect verifies or replaces credentials for this same Slack app. It does not reinstall the app or change its workspace or channel membership. Leave credentials blank to reuse the saved values."
            : "Bring your own Slack app. The manifest requests the scopes Paperclip needs; credentials remain write-only."}
        </p>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Copy the manifest, then create a Slack app{" "}
          <strong>From an app manifest</strong> in the target workspace.
        </li>
        <li>
          Open <strong>OAuth &amp; Permissions</strong>, install the app to the
          workspace, and copy its Bot User OAuth Token.
        </li>
        <li>
          Open <strong>Basic Information</strong> and copy its Signing Secret.
        </li>
      </ol>
      <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Slack app name</span>
          <code>{slackAppName}</code>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Bot display name</span>
          <code>{slackBotName}</code>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Slash command</span>
          <code>{slackCommand}</code>
        </div>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Slack app manifest
        <Textarea
          className="min-h-56 font-mono text-xs"
          readOnly
          value={slackManifest}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            void copyTextToClipboard(slackManifest).then(
              () => setManifestCopied(true),
              reportCopyFailure,
            );
          }}
        >
          {manifestCopied ? "Manifest copied" : "Copy manifest"}
        </Button>
        <Button
          variant="outline"
          onClick={() => openProviderSetup("https://api.slack.com/apps")}
        >
          Open Slack app settings <ExternalLink />
        </Button>
      </div>
      {field("botToken", "Bot User OAuth Token")}
      {field("signingSecret", "Signing Secret")}
      {!endpoint.setup?.webhookUrl && (
        <p className="text-sm text-destructive">
          Configure a public HTTPS URL for this Paperclip instance before
          connecting Slack.
        </p>
      )}
      <Button
        disabled={
          (!repairing &&
            (!credentials.botToken || !credentials.signingSecret)) ||
          !endpoint.setup?.webhookUrl ||
          pending
        }
        onClick={() =>
          onAction(repairing ? "reconnect" : "configure", credentials)
        }
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {repairing ? "Reconnect Slack app" : "Connect Slack app"}
      </Button>
    </div>
  );
}

function TryStep({
  endpointId,
  provider,
  agentName,
  botLabel,
  botUsername,
  photonAllocation,
  providerUrl,
  guestIsolationState,
  pending,
  onOpenAccess,
  onTest,
}: {
  endpointId: string;
  provider: ChatProvider;
  agentName: string;
  botLabel?: string | null;
  botUsername?: string | null;
  photonAllocation?: "dedicated" | "shared";
  providerUrl?: string | null;
  guestIsolationState: "loading" | "enabled" | "disabled" | "unknown";
  pending: boolean;
  onOpenAccess: () => void;
  onTest: () => void;
}) {
  const principalsQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.principals(endpointId),
    queryFn: () => chatEndpointsApi.listPrincipals(endpointId),
    refetchInterval: 1_500,
  });
  const [numberCopied, setNumberCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const identities = principalsQuery.data ?? [];
  const unlinkedIdentities = identities.filter(
    (identity) => identity.status !== "linked",
  );
  const freshConversationInstruction =
    provider === "imessage-photon" ? "send a fresh message to your Photon number" : provider === "telegram"
      ? "start a fresh conversation with /new and send the test message again"
      : provider === "github"
        ? "start a new issue or pull request conversation and mention the agent again"
        : provider === "microsoft-teams"
          ? "start a new channel post and mention the agent again"
          : "send a new root mention to the agent";
  const identityGuidance = provider === "imessage-photon" && principalsQuery.isSuccess && (identities.length === 0 || unlinkedIdentities.length > 0)
    ? { tone: "info" as const, title: "Link your Messages identity", body: "Send one message to discover your phone number or Apple account address, then link that exact identity in Access. Send a fresh request after linking; earlier messages do not start work." }
    : principalsQuery.isError
    ? {
        tone: "warning" as const,
        title: "Identity readiness could not be checked",
        body: `Review Access before expecting an agent reply. After linking the account you are testing, ${freshConversationInstruction}.`,
      }
    : !principalsQuery.isSuccess || guestIsolationState === "loading"
      ? null
      : identities.length === 0
        ? guestIsolationState === "disabled"
          ? {
              tone: "warning" as const,
              title: "Link the account you’re testing",
              body:
                provider === "telegram"
                  ? "Tap Start in Telegram to discover your account; the welcome does not start an agent run. Link the account privately in Access, then return and send the test message."
                  : `Your first ${providerNames[provider]} message discovers the external account, but isolated guest work is off, so it cannot safely start ${agentName}. Send it once, link that account privately in Access, then ${freshConversationInstruction}.`,
            }
          : {
              tone: "info" as const,
              title: "Your first message identifies your account",
              body:
                provider === "telegram"
                  ? "Tap Start in Telegram to discover your account. Until linked, it is a restricted guest and still needs a sandbox-backed isolated run; test that path intentionally, or link it in Access and then send the test message."
                  : `Until linked, the account is a restricted guest and still needs a sandbox-backed isolated run. Test that guest path intentionally, or link the account in Access and then ${freshConversationInstruction}.`,
            }
        : unlinkedIdentities.length > 0
          ? guestIsolationState === "disabled"
            ? {
                tone: "warning" as const,
                title: "Link the account you’re testing",
                body: `An observed external account is unlinked, and isolated guest work is off, so it cannot safely start ${agentName}. Link the account in Access, then ${freshConversationInstruction}; Paperclip does not replay the refused request.`,
              }
            : {
                tone: "info" as const,
                title: "Unlinked identity detected",
                body: `An unlinked account is a restricted guest and still needs a sandbox-backed isolated run. Test guest access intentionally, or link the account in Access and then ${freshConversationInstruction}.`,
              }
          : null;
  const providerBotUsername = botUsername?.replace(/^@/, "");
  const normalizedBotUsername =
    provider === "github"
      ? providerBotUsername?.replace(/\[bot\]$/i, "")
      : providerBotUsername;
  const botMention = normalizedBotUsername
    ? `@${normalizedBotUsername}`
    : (botLabel ?? agentName);
  const instructions =
    provider === "imessage-photon" ? [
      photonAllocation === "shared" ? "In your Photon project, enroll your sender in Users and find its assigned number in Get started. Send a fresh message to that number from Apple Messages." : `Open Apple Messages and send a fresh message to ${botUsername ?? botLabel ?? "the dedicated number"}.`,
      "Link the discovered sender to a Paperclip person in Access, then send a fresh request.",
      "Wait for the agent’s actual reply. Setup completes after that reply is delivered.",
      ...(photonAllocation === "shared" ? ["This Pro-compatible channel supports DMs only. Group messages cannot start work."] : ["For a group: add the number in Messages, send a message, enable the discovered group in Settings, then send a fresh request."]),
    ] : provider === "discord"
      ? [
          "Open a text channel where the bot is installed.",
          `Mention ${botMention} in a new root message.`,
          `Reply once inside ${agentName}'s new Discord thread.`,
        ]
      : provider === "telegram"
        ? [
            "Open the bot's private chat.",
            "Tap Start.",
            "Send “Help me test this”.",
          ]
        : provider === "github"
          ? [
              "Open an installed issue or pull request.",
              `Mention ${botMention} in a comment.`,
              "Add another comment to continue the same task.",
            ]
          : provider === "microsoft-teams"
            ? [
                "Open an installed channel and start a new post.",
                `Mention ${botMention} in the post.`,
                "Reply once beneath the post.",
              ]
            : [
                "Open a channel and invite the bot if needed.",
                `Mention ${botMention} in a new channel message.`,
                `Reply once in ${agentName}'s thread.`,
              ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">
          Try {agentName} in {providerNames[provider]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete this real conversation to finish setup.
        </p>
      </div>
      {(!principalsQuery.isSuccess || guestIsolationState === "loading") &&
      !principalsQuery.isError ? (
        <p role="status" className="text-sm text-muted-foreground">
          Checking identity and guest readiness…
        </p>
      ) : null}
      {identityGuidance ? (
        <div
          role={identityGuidance.tone === "warning" ? "alert" : "status"}
          className={
            identityGuidance.tone === "warning"
              ? "rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
              : "rounded-lg border border-border bg-muted/30 p-4 text-sm"
          }
        >
          <h2 className="font-medium">{identityGuidance.title}</h2>
          <p className="mt-1 text-muted-foreground">{identityGuidance.body}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={onOpenAccess}
          >
            Review identity access
          </Button>
        </div>
      ) : null}
      {provider === "imessage-photon" && botUsername && <div className="space-y-2"><Button variant="outline" onClick={() => { void copyTextToClipboard(botUsername).then(() => { setNumberCopied(true); setCopyError(null); }, () => setCopyError("Could not copy the number. Select it in the instructions below.")); }}>{numberCopied ? "Number copied" : `Copy ${botUsername}`}</Button>{copyError && <p role="alert" className="text-sm text-destructive">{copyError}</p>}</div>}
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {instructions.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {providerUrl && (
          <Button asChild variant="outline">
            <a href={providerUrl} target="_blank" rel="noopener noreferrer">
              Open {providerNames[provider]} <ExternalLink />
            </a>
          </Button>
        )}
        <Button disabled={pending} onClick={onTest}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          I've sent the test message
        </Button>
      </div>
    </div>
  );
}
