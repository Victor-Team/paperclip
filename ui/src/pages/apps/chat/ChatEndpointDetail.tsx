import { SlackToolsSettings, SlackSearchAccess } from "./SlackToolSettings";
import { defaultSlackAppName } from "./slack-app-name";
import { ChatCommunicationInstructions } from "./ChatCommunicationInstructions";
import { SlackAvatarSettings } from "./SlackAvatarStep";
import { agentsApi } from "@/api/agents";
import { agentAvatarUrl } from "@/lib/agent-avatar-url";
import { resolveAgentAppearance } from "@paperclipai/shared";
import { GitHubBotManagement, GitHubReviews } from "./GitHubBotManagement";
import { EmailEndpointSettings } from "./EmailEndpointSetup";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Check,
  Activity as ActivityIcon,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Unlink,
} from "lucide-react";
import {
  chatEndpointsApi,
  type ChatActivityItem,
  type ChatEndpoint,
  type ChatEndpointResource,
  type ChatProvider,
} from "@/api/chatEndpoints";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { AppLogo } from "../AppLogo";
import { StatusBadge } from "@/components/StatusBadge";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { formatDateTime } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Link, Navigate, useNavigate, useParams } from "@/lib/router";
import { useTranslation } from "@/i18n";

const tabs = ["settings", "access", "reviews", "conversations", "activity"] as const;
type ChatTab = (typeof tabs)[number];
type Translate = (key: string, values?: Record<string, unknown>) => string;
const providerNames: Record<ChatProvider, string> = {
  agentmail: "AgentMail",
  slack: "Slack",
  github: "GitHub",
  discord: "Discord",
  "microsoft-teams": "Microsoft Teams",
  telegram: "Telegram",
  "imessage-photon": "iMessage Photon",
};

function providerLifecycleGuidance(t: Translate): Record<
  ChatProvider,
  { reconnect: string; remove: string }
> {
  return {
  agentmail: { reconnect: t("chatendpointdetail.general.reconnectsameemailinbox"), remove: t("chatendpointdetail.general.disconnectemailandretaintaskhistory") },
  slack: {
    reconnect: t("chatendpointdetail.general.reconnectslack"),
    remove: t("chatendpointdetail.general.removeslack"),
  },
  github: {
    reconnect: t("chatendpointdetail.general.reconnectgithub"),
    remove: t("chatendpointdetail.general.removegithub"),
  },
  discord: {
    reconnect: t("chatendpointdetail.general.reconnectdiscord"),
    remove: t("chatendpointdetail.general.removediscord"),
  },
  "microsoft-teams": {
    reconnect: t("chatendpointdetail.general.reconnectteams"),
    remove: t("chatendpointdetail.general.removeteams"),
  },
  "imessage-photon": {
    reconnect: t("chatendpointdetail.general.reconnectphoton"),
    remove: t("chatendpointdetail.general.removephoton"),
  },
  telegram: {
    reconnect: t("chatendpointdetail.general.reconnecttelegram"),
    remove: t("chatendpointdetail.general.removetelegram"),
  },
  };
}

function activityKindLabel(
  kind: ChatActivityItem["kind"],
  t: Translate,
) {
  return t(`chatendpointdetail.general.activitykind${kind}`);
}

const fileTransferPhaseLabelKeys: Record<
  NonNullable<ChatActivityItem["fileTransfer"]>["phase"],
  string
> = {
  consent_pending: "externallyconnectedtaskbanner.general.consentcardqueued",
  consent_sending: "externallyconnectedtaskbanner.general.sendingconsentcard",
  consent_unknown: "externallyconnectedtaskbanner.general.consentcarddeliverynotconfirmed",
  awaiting_consent: "externallyconnectedtaskbanner.general.awaitingconsent",
  upload_pending: "externallyconnectedtaskbanner.general.uploadqueued",
  uploading: "externallyconnectedtaskbanner.general.uploadingfile",
  upload_unknown: "externallyconnectedtaskbanner.general.fileuploadnotconfirmed",
  file_info_pending: "externallyconnectedtaskbanner.general.filenotificationqueued",
  file_info_sending: "externallyconnectedtaskbanner.general.sendingfilenotification",
  file_info_unknown: "externallyconnectedtaskbanner.general.filenotificationnotconfirmed",
  delivered: "externallyconnectedtaskbanner.general.delivered",
  declined: "externallyconnectedtaskbanner.general.declined",
  expired: "externallyconnectedtaskbanner.general.consentexpired",
  cancelled: "externallyconnectedtaskbanner.general.cancelledremotebytesmayremain",
  conflict: "externallyconnectedtaskbanner.general.filedeliveryneedsreview",
};

const replayableFailureStates = new Set(["failed"]);
// Provider callbacks do not necessarily emit a Board activity event. Refresh
// only mounted operational views, and stop polling when the browser is hidden.
const liveChatQueryOptions = {
  staleTime: 0,
  refetchInterval: 5_000,
  refetchIntervalInBackground: false,
} as const;

export function isReplayEligible(item: ChatActivityItem): boolean {
  if (
    item.fileTransfer ||
    !item.replayable ||
    !replayableFailureStates.has(item.status)
  ) {
    return false;
  }
  if (item.kind === "delivery") return item.status === "failed";
  return item.kind === "publication";
}

export function activityResolutionActions(item: ChatActivityItem) {
  const offered = item.resolutionActions ?? [];
  if (!item.fileTransfer) return offered;
  if (
    item.kind !== "publication" ||
    !Number.isSafeInteger(item.fileTransfer.version) ||
    item.fileTransfer.version < 1
  )
    return [];
  if (
    ![
      "consent_unknown",
      "upload_unknown",
      "file_info_unknown",
      "conflict",
    ].includes(item.fileTransfer.phase)
  )
    return [];
  // Only the file-info stage can use ordinary visible-delivery resolution.
  // Earlier consent/upload evidence must not be fabricated by these buttons.
  return item.fileTransfer.phase === "file_info_unknown"
    ? offered
    : offered.filter((action) => action === "cancel");
}

export function activityResolutionDescription(
  item: ChatActivityItem,
  t?: Translate,
): string {
  const phase = item.fileTransfer?.phase;
  if (phase === "file_info_unknown")
    return t ? t("chatendpointdetail.general.fileinfounknown") : "The file upload was confirmed, but its Teams notification was not. Check Teams first. Retrying sends only that notification, not the file bytes, and may create a duplicate card.";
  if (phase === "consent_unknown")
    return t ? t("chatendpointdetail.general.consentunknown") : "The consent card may have reached Teams. File delivery is not confirmed. Cancelling here does not remove any card already sent.";
  if (phase)
    return t ? t("chatendpointdetail.general.filetransferunknown") : "The file may already exist in OneDrive. Cancelling stops this Paperclip transfer; it does not delete remote bytes. Uploads cannot be marked delivered or retried from this uncertain state.";
  return t ? t("chatendpointdetail.general.deliveryunknown") : "Paperclip lost confirmation after sending. Check the provider conversation first. Retrying can create a duplicate message.";
}

export function isResolutionEligible(item: ChatActivityItem): boolean {
  return (
    (item.kind === "publication" || item.kind === "action") &&
    item.status === "delivery_unknown" &&
    activityResolutionActions(item).length > 0
  );
}

export function isIndividuallyToggleableResource(
  provider: ChatProvider,
  resourceType: string,
): boolean {
  return !(
    provider === "microsoft-teams" &&
    (resourceType === "direct_message" || resourceType === "group_chat")
  );
}

function activityDetailLabel(item: ChatActivityItem, t: Translate): string {
  return replayableFailureStates.has(item.status)
    ? t("chatendpointdetail.general.reason")
    : t("chatendpointdetail.general.details");
}

export function connectionHealthPresentation(
  endpoint: Pick<ChatEndpoint, "status" | "healthMessage" | "lastError">,
  t?: Translate,
) {
  // Health events outlive pause/removal. They are history, not lifecycle state.
  const lifecycleMessages = {
    draft: t ? t("chatendpointdetail.general.setupincomplete") : "Connection setup is incomplete.",
    verifying: t ? t("chatendpointdetail.general.verificationinprogress") : "Connection verification is in progress.",
    paused: t ? t("chatendpointdetail.general.connectionpaused") : "Connection is paused. Resume it to receive new messages.",
    attention: t ? t("chatendpointdetail.general.connectionneedsattention") : "Connection needs attention.",
    revoked: t ? t("chatendpointdetail.general.connectionaccessrevoked") : "Connection access is revoked. Reconnect to verify access.",
    archived: t ? t("chatendpointdetail.general.connectionremoved") : "Connection has been removed from Paperclip.",
  };
  const lifecycleMessage =
    endpoint.status === "active" ? null : lifecycleMessages[endpoint.status];
  return {
    message: lifecycleMessage ?? endpoint.healthMessage ?? null,
    previousHealth: lifecycleMessage ? (endpoint.healthMessage ?? null) : null,
    error: endpoint.lastError ?? null,
    errorLabel: ["active", "attention", "revoked"].includes(endpoint.status)
      ? (t ? t("chatendpointdetail.general.reason") : "Reason")
      : (t ? t("chatendpointdetail.general.lastreportederror") : "Last reported error"),
  };
}

export function ChatEndpointDetail() {
  const { t } = useTranslation();
  const { endpointId = "", tab = "settings" } = useParams<{
    endpointId: string;
    tab?: string;
  }>();
  const activeTab = tabs.includes(tab as ChatTab) ? (tab as ChatTab) : null;
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumbs();
  const endpointQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.detail(endpointId),
    queryFn: () => chatEndpointsApi.get(endpointId),
    enabled: Boolean(endpointId && activeTab),
    ...liveChatQueryOptions,
    refetchInterval:
      activeTab === "activity" || activeTab === "conversations"
        ? liveChatQueryOptions.refetchInterval
        : false,
  });
  const endpoint = endpointQuery.data;
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const tabItems = useMemo(
    () =>
      tabs.map((value) => ({
        value,
        label: t(`chatendpointdetail.general.tab${value}`),
      })),
    [t],
  );

  useEffect(() => {
    if (!endpoint || !activeTab) return;
    setBreadcrumbs([
      { label: t("chatendpointdetail.general.connectors"), href: "/apps" },
      {
        label: `${endpoint.assignedAgentName} · ${providerNames[endpoint.provider]}`,
        href: `/apps/chat/${endpoint.id}/settings`,
      },
      {
        label:
          tabItems.find((item) => item.value === activeTab)?.label ??
          t("chatendpointdetail.general.tabsettings"),
      },
    ]);
    return () => setBreadcrumbs([]);
  }, [activeTab, endpoint, setBreadcrumbs, t, tabItems]);

  if (!activeTab)
    return <Navigate replace to={`/apps/chat/${endpointId}/settings`} />;
  if (endpointQuery.isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("chatendpointdetail.general.loadingconnection")}</div>
    );
  if (endpointQuery.isError || !endpoint)
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {t("chatendpointdetail.general.thischatconnectioncouldnotbeloaded")}</p>
        <Button variant="outline" onClick={() => endpointQuery.refetch()}>
          {t("chatendpointdetail.general.tryagain")}</Button>
      </div>
    );
  if (endpoint.provider === "agentmail") return <EmailEndpointSettings endpointId={endpoint.id} companyId={endpoint.companyId} />;
  const setupIncomplete =
    endpoint.setup?.step !== "complete" &&
    ["draft", "verifying", "attention", "revoked"].includes(endpoint.status);

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
            {endpoint.assignedAgentName} {t("chatendpointdetail.general.in")} {providerNames[endpoint.provider]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {endpoint.providerAccountLabel ?? t("chatendpointdetail.general.chatconnection")}
          </p>
          {endpoint.provider === "imessage-photon" && endpoint.botExternalId && endpoint.photonAllocation !== "shared" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>{endpoint.botExternalId}</span>
              <Button variant="ghost" size="sm" aria-label={t("chatendpointdetail.general.copydedicatednumber")} onClick={async () => {
                try { await copyTextToClipboard(endpoint.botExternalId!); setCopyStatus(t("chatendpointdetail.general.numbercopied")); }
                catch { setCopyStatus(t("chatendpointdetail.general.couldnotcopynumber")); }
              }}><Copy className="size-4" />{t("chatendpointdetail.general.copynumber")}</Button>
              <span role="status" className="text-muted-foreground">{copyStatus}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {setupIncomplete ? (
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  `/apps/chat/connect?provider=${endpoint.provider}&purpose=chat&resume=${endpoint.id}`,
                )
              }
            >
              {t("chatendpointdetail.general.continuesetup")}</Button>
          ) : null}
          {endpoint.status !== "active" && <StatusBadge status={endpoint.status} />}
        </div>
      </header>
      {activeTab === "settings" && (
        <>
{endpoint.provider === "github" && <GitHubBotManagement endpoint={endpoint} view="settings" />}
{endpoint.provider !== "github" && <Settings endpointId={endpoint.id} endpoint={endpoint} />}
</>
      )}
      {activeTab === "reviews" && endpoint.provider === "github" && <GitHubReviews endpointId={endpoint.id} />}
{activeTab === "access" && endpoint.provider === "github" && <GitHubBotManagement endpoint={endpoint} view="access" />}
{activeTab === "access" && endpoint.provider !== "github" && (
        <Access
          endpointId={endpoint.id}
          allowUnlinked={endpoint.allowUnlinkedPeople}
          endpoint={endpoint}
        />
      )}
      {activeTab === "conversations" && (
        <Conversations endpointId={endpoint.id} provider={endpoint.provider} />
      )}
      {activeTab === "activity" && (
        <Activity endpointId={endpoint.id} endpoint={endpoint} />
      )}
    </div>
  );
}

function Settings({
  endpointId,
  endpoint,
}: {
  endpointId: string;
  endpoint: Awaited<ReturnType<typeof chatEndpointsApi.get>>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [messageCopied, setMessageCopied] = useState(false);
  const avatarAgent = useQuery({
    queryKey: queryKeys.agents.detail(endpoint.assignedAgentId),
    queryFn: () => agentsApi.get(endpoint.assignedAgentId, endpoint.companyId),
    enabled: endpoint.provider === "slack",
  });
  const mentionMessage = `@${(endpoint.botUsername ?? endpoint.botLabel ?? endpoint.assignedAgentName).replace(/^@/, "")} you there?`;
  const resourcesQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.resources(endpointId),
    queryFn: () => chatEndpointsApi.listResources(endpointId),
  });
  const saveResources = useMutation({
    mutationFn: (resource: Pick<ChatEndpointResource, "id" | "enabled">) =>
      chatEndpointsApi.updateResources(endpointId, [resource]),
    onSuccess: (resources) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.resources(endpointId),
        resources,
      ),
    onError: (error) =>
      pushToast({
        title: t("chatendpointdetail.general.couldnotupdatedestination"),
        body: error instanceof Error ? error.message : t("chatendpointdetail.general.tryagainwithperiod"),
        tone: "error",
      }),
  });
  const updateEndpoint = useMutation({
    mutationFn: chatEndpointsApi.update.bind(null, endpointId),
    onSuccess: (next) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.detail(endpointId),
        next,
      ),
    onError: (error) =>
      pushToast({
        title: t("chatendpointdetail.general.couldnotupdatesettings"),
        body: error instanceof Error ? error.message : t("chatendpointdetail.general.tryagainwithperiod"),
        tone: "error",
      }),
  });
  const resources = resourcesQuery.data ?? [];
  const destinationResources = resources.filter((resource) =>
    isIndividuallyToggleableResource(endpoint.provider, resource.type),
  );
  const toggleResource = (resource: ChatEndpointResource, enabled: boolean) =>
    // A cached inventory must not overwrite another operator's unrelated edits.
    saveResources.mutate({ id: resource.id, enabled });
  return (
    <section className="max-w-3xl space-y-7">
      {endpoint.provider === "imessage-photon" && <p className="text-sm text-muted-foreground">{endpoint.photonAllocation === "shared" ? t("chatendpointdetail.general.sharedphotonprojectdirectmessagesonlyenroll") : t("chatendpointdetail.general.enableeachgroupindividuallyagentrepliesare")}</p>}
      {endpoint.provider === "slack" && endpoint.setup?.command && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("chatendpointdetail.general.slackcommand")}</h2>
          <div className="rounded-lg border border-border p-3 text-sm">
            <code>{endpoint.setup.command}</code>
            <p className="mt-2 text-muted-foreground">
              {t("chatendpointdetail.general.startworkwith")}{" "}
              <code>{endpoint.setup.command} {t("chatendpointdetail.general.investigatethis")}</code>{t("chatendpointdetail.general.inadirectmessageuse")}<code>{endpoint.setup.command} {t("chatendpointdetail.general.status")}</code>,{" "}
              <code>{endpoint.setup.command} {t("chatendpointdetail.general.new")}</code>{t("chatendpointdetail.general.or")}{" "}
              <code>{endpoint.setup.command} {t("chatendpointdetail.general.close")}</code>{t("chatendpointdetail.general.slackapossbare")}{" "}
              <code>/status</code> {t("chatendpointdetail.general.commandisnotapaperclipcontrol")}</p>
          </div>
        </div>
      )}
      {endpoint.provider === "slack" && (
        <div className="space-y-2 text-sm">
          <h2 className="text-lg font-semibold">{t("chatendpointdetail.general.chatinslack")}</h2>
          <p>{t("chatendpointdetail.general.invitethebottoachannelthenmention")}</p>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <code>{mentionMessage}</code>
            <Button size="icon" variant="ghost" aria-label={messageCopied ? t("chatendpointdetail.general.messagecopied") : t("chatendpointdetail.general.copymessage")} onClick={() => {
              void copyTextToClipboard(mentionMessage).then(() => setMessageCopied(true), () => pushToast({ title: t("chatendpointdetail.general.couldntcopythemessage"), body: t("chatendpointdetail.general.selectandcopyitmanually"), tone: "error" }));
            }}>{messageCopied ? <Check className="size-4" /> : <Copy className="size-4" />}</Button>
          </div>
        </div>
      )}
      {endpoint.provider === "slack" && (
        avatarAgent.isPending ? <p role="status" className="text-sm text-muted-foreground">{t("chatendpointdetail.general.loadingagentavatar")}</p>
          : avatarAgent.isError ? <p role="alert" className="text-sm text-destructive">{t("chatendpointdetail.general.couldntloadtheagentsavatar")} <button className="underline" onClick={() => void avatarAgent.refetch()}>{t("chatendpointdetail.general.tryagain")}</button></p>
          : <SlackAvatarSettings
              agentName={avatarAgent.data?.name ?? endpoint.assignedAgentName}
              appName={endpoint.setup?.slackApp?.appName ?? defaultSlackAppName(avatarAgent.data?.name ?? endpoint.assignedAgentName)}
              avatarUrl={agentAvatarUrl(resolveAgentAppearance(avatarAgent.data?.appearance, endpoint.assignedAgentId), 512, 1, "rest")}
            />
      )}
      {endpoint.provider === "slack" && <SlackToolsSettings companyId={endpoint.companyId} endpointId={endpointId} connectionId={endpoint.connectionId} />}
      {endpoint.provider === "slack" && <ChatCommunicationInstructions
        key={endpoint.id}
        value={endpoint.communicationInstructions ?? ""}
        onSave={async (communicationInstructions) => {
          const next = await chatEndpointsApi.update(endpointId, { communicationInstructions });
          queryClient.setQueryData(queryKeys.chatEndpoints.detail(endpointId), next);
        }}
      />}
      {endpoint.provider === "telegram" && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("chatendpointdetail.general.telegramgroupcommand")}</h2>
          <div className="rounded-lg border border-border p-3 text-sm">
            <code>
              /task@
              {endpoint.botUsername?.replace(/^@/, "") ?? t("chatendpointdetail.general.botusername")}{" "}
              {t("chatendpointdetail.general.ltrequestgt")}</code>
            <p className="mt-2 text-muted-foreground">
              {t("chatendpointdetail.general.telegramapossdefaultprivacymodedoes")}</p>
          </div>
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold">{t("chatendpointdetail.general.wherethisagentcanwork")}</h2>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{endpoint.provider === "slack" ? t("chatendpointdetail.general.allowedchannels") : t("chatendpointdetail.general.destinations")}</h3>
        {resourcesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("chatendpointdetail.general.loadingdestinations")}</p>
        ) : destinationResources.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("chatendpointdetail.general.noproviderdestinationshavebeendiscoveredyet")}</p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {destinationResources.map((resource) => (
              <div key={resource.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {resource.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {resource.availability === "available"
                      ? (resource.detail ?? resource.type)
                      : t("chatendpointdetail.general.unavailableatprovider")}
                  </p>
                  {resource.participants?.length ? <p className="mt-1 break-words text-xs text-muted-foreground">{t("chatendpointdetail.general.participants")} {resource.participants.join(", ")}</p> : null}
                </div>
                <ToggleSwitch
                  aria-label={t("chatendpointdetail.general.enableresource", { name: resource.label })}
                  checked={resource.enabled}
                  disabled={
                    endpoint.photonAllocation === "shared" ||
                    resource.availability !== "available" ||
                    saveResources.isPending
                  }
                  onCheckedChange={(enabled) =>
                    toggleResource(resource, enabled)
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {endpoint.provider !== "github" && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("chatendpointdetail.general.privateconversations")}</h3>
          <SettingToggle
            label={t("chatendpointdetail.general.allowdirectmessages")}
            detail={
              endpoint.provider === "discord"
                ? t("chatendpointdetail.general.discorddirectmessagesdetail")
                : t("chatendpointdetail.general.directmessagesdetail")
            }
            checked={endpoint.allowDirectMessages ?? false}
            pending={updateEndpoint.isPending}
            onChange={(allowDirectMessages) =>
              updateEndpoint.mutate({ allowDirectMessages })
            }
          />
          {endpoint.provider === "microsoft-teams" && (
            <SettingToggle
              label={t("chatendpointdetail.general.allowgroupchats")}
              detail={t("chatendpointdetail.general.groupchatsdetail")}
              checked={endpoint.allowGroupChats ?? false}
              pending={updateEndpoint.isPending}
              onChange={(allowGroupChats) =>
                updateEndpoint.mutate({ allowGroupChats })
              }
            />
          )}
        </div>
      )}
    </section>
  );
}

function SettingToggle({
  label,
  detail,
  checked,
  pending,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  pending: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-y border-border py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <ToggleSwitch
        aria-label={label}
        checked={checked}
        disabled={pending}
        onCheckedChange={onChange}
      />
    </div>
  );
}

function Access({
  endpointId,
  allowUnlinked,
  endpoint,
}: {
  endpointId: string;
  allowUnlinked: boolean;
  endpoint: ChatEndpoint;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [confirmationUrl, setConfirmationUrl] = useState<string | null>(null);
  const [joinCommandCopied, setJoinCommandCopied] = useState(false);
  const joinCommand = `${endpoint.setup?.slackApp?.command ?? endpoint.setup?.command ?? "/paperclip"} connect`;
  const linksQuery = useQuery({
    queryKey: queryKeys.chatEndpoints.principals(endpointId),
    queryFn: () => chatEndpointsApi.listPrincipals(endpointId),
  });
  const updatePolicy = useMutation({
    mutationFn: (value: boolean) =>
      chatEndpointsApi.update(endpointId, { allowUnlinkedPeople: value }),
    onSuccess: (next) =>
      queryClient.setQueryData(
        queryKeys.chatEndpoints.detail(endpointId),
        next,
      ),
    onError: (error) => pushToast({ title: "Couldn’t update access", body: error instanceof Error ? error.message : "Try again.", tone: "error" }),
  });
  const createIntent = useMutation({
    mutationFn: (principalId: string) =>
      chatEndpointsApi.createLinkIntent(endpointId, principalId),
    onSuccess: ({ confirmationUrl }) => {
      setConfirmationUrl(
        new URL(confirmationUrl, window.location.origin).toString(),
      );
      pushToast({
        title: t("chatendpointdetail.general.privateidentitylinkcreated"),
        body: t("chatendpointdetail.general.sendidentitylinkonly"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("chatendpointdetail.general.couldnotcreateidentitylink"),
        body: error instanceof Error ? error.message : t("chatendpointdetail.general.tryagainwithperiod"),
        tone: "error",
      }),
  });
  const revoke = useMutation({
    mutationFn: (principalId: string) =>
      chatEndpointsApi.revokeLink(endpointId, principalId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.principals(endpointId),
      }),
  });
  const links = linksQuery.data ?? [];
  return (
    <section className="max-w-3xl space-y-7">
      <div>
        <h2 className="text-lg font-semibold">{t("chatendpointdetail.general.externalidentityaccess")}</h2>
      </div>
      {endpoint.provider === "slack" && <SlackSearchAccess companyId={endpoint.companyId} endpointId={endpointId} />}
      {endpoint.provider === "slack" && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("chatendpointdetail.general.inviteotherstoconnecttheirslackaccounts")}</h3>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              {t("chatendpointdetail.general.askthemtosendthiscommandin")}
              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <code>{joinCommand}</code>
                <Button size="sm" variant="ghost" onClick={() => {
                  void copyTextToClipboard(joinCommand).then(() => setJoinCommandCopied(true), () => pushToast({ title: t("chatendpointdetail.general.couldntcopythecommand"), body: t("chatendpointdetail.general.selectandcopyitmanually"), tone: "error" }));
                }}><Copy className="size-4" />{joinCommandCopied ? t("chatendpointdetail.general.copied") : t("chatendpointdetail.general.copycommand")}</Button>
              </div>
            </li>
            <li>{t("chatendpointdetail.general.opentheprivatelinkfromthebot")}</li>
            <li>{t("chatendpointdetail.general.iftheyarentamemberof")} <strong>{t("chatendpointdetail.general.requestaccess")}</strong>{t("chatendpointdetail.general.anadminmustapprovetheirrequestbefore")}</li>
          </ol>
          <p className="text-sm text-muted-foreground">{t("chatendpointdetail.general.eachpersonlinkstheirownaccountand")}</p>
        </div>
      )}
      <SettingToggle
        label={t("chatendpointdetail.general.allowunlinkedpeople")}
        detail={t("chatendpointdetail.general.unlinkedpeopledetail")}
        checked={allowUnlinked}
        pending={updatePolicy.isPending}
        onChange={(value) => updatePolicy.mutate(value)}
      />
      {confirmationUrl && (
        <div className="space-y-2 border-y border-border py-3">
          <p className="text-sm font-medium">{t("chatendpointdetail.general.privateconfirmationlink")}</p>
          <p className="break-all text-xs text-muted-foreground">
            {confirmationUrl}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void copyTextToClipboard(confirmationUrl).then(
                () =>
                  pushToast({
                    title: t("chatendpointdetail.general.confirmationlinkcopied"),
                    tone: "success",
                  }),
                () =>
                  pushToast({
                    title: t("chatendpointdetail.general.couldnotcopylink"),
                    body: t("chatendpointdetail.general.selectandcopymanually"),
                    tone: "error",
                  }),
              );
            }}
          >
            <Copy />
            {t("chatendpointdetail.general.copylink")}</Button>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("chatendpointdetail.general.identitylinks")}</h3>
        {links.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("chatendpointdetail.general.externalpeopleappearhereaftertheymessage")}</p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{link.externalLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {link.paperclipUserLabel
                      ? t("chatendpointdetail.general.linkedto", { name: link.paperclipUserLabel })
                      : (link.externalDetail ?? t("chatendpointdetail.general.notlinked"))}
                  </p>
                </div>
                {link.status === "linked" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(link.principalId)}
                  >
                    <Unlink />
                    {t("chatendpointdetail.general.revoke")}</Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={createIntent.isPending}
                    onClick={() => createIntent.mutate(link.principalId)}
                  >
                    {t("chatendpointdetail.general.createprivatelink")}</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Conversations({
  endpointId,
  provider,
}: {
  endpointId: string;
  provider: ChatProvider;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: queryKeys.chatEndpoints.conversations(endpointId),
    queryFn: () => chatEndpointsApi.listConversations(endpointId),
    ...liveChatQueryOptions,
  });
  const rows = query.data ?? [];
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("chatendpointdetail.general.conversations")}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("chatendpointdetail.general.noconversationsyetaddresstheagentin")}</p>
      ) : (
        <ul aria-label={t("chatendpointdetail.general.conversations")} className="divide-y divide-border overflow-x-auto border-y border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex min-w-xl items-center gap-3 px-2 py-3 text-sm transition-colors hover:bg-accent/50">
              <AppLogo name={providerNames[provider]} brandKey={provider} compact className="size-5! rounded-sm bg-transparent" />
              <div className="flex min-w-0 max-w-56 items-center gap-2">
                <span className="truncate font-medium" title={row.externalLabel}>{row.externalLabel}</span>
                {row.externalUrl && <a href={row.externalUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">{t("chatendpointdetail.general.open")} {providerNames[provider]}<ExternalLink className="size-3" /></a>}
              </div>
              <span aria-hidden="true" className="text-muted-foreground">·</span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate" title={row.issueTitle ?? undefined}>{row.issueTitle ?? t("chatendpointdetail.general.waitingfortask")}</span>
                {row.issueId && <Link to={`/issues/${row.issueId}`} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">{t("chatendpointdetail.general.opentask")}<ExternalLink className="size-3" /></Link>}
              </div>
              <span className="hidden shrink-0 text-xs text-muted-foreground xl:inline">{row.issueIdentifier}</span>
              {row.state !== "active" && <StatusBadge status={row.state} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Activity({
  endpointId,
  endpoint,
}: {
  endpointId: string;
  endpoint: Awaited<ReturnType<typeof chatEndpointsApi.get>>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [resolutionItem, setResolutionItem] = useState<ChatActivityItem | null>(
    null,
  );
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors[cursors.length - 1];
  useEffect(() => setCursors([undefined]), [endpointId]);
  const query = useQuery({
    queryKey: [...queryKeys.chatEndpoints.activity(endpointId), cursor ?? null],
    queryFn: () => chatEndpointsApi.listActivityPage(endpointId, cursor),
    ...liveChatQueryOptions,
    refetchInterval: cursor ? false : liveChatQueryOptions.refetchInterval,
  });
  const replay = useMutation({
    mutationFn: (item: ChatActivityItem) =>
      item.kind === "publication"
        ? chatEndpointsApi.replayPublication(endpointId, item.id)
        : chatEndpointsApi.replayDelivery(endpointId, item.id),
    onSuccess: async (_result, item) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.activity(endpointId),
      });
      pushToast({
        title:
          item.kind === "publication"
            ? t("chatendpointdetail.general.publicationqueuedforreplay")
            : t("chatendpointdetail.general.deliveryqueuedforreplay"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("chatendpointdetail.general.couldnotreplayactivity"),
        body: error instanceof Error ? error.message : t("chatendpointdetail.general.tryagainwithperiod"),
        tone: "error",
      }),
  });
  const resolveActivity = useMutation({
    mutationFn: (input: {
      item: ChatActivityItem;
      action: "mark_delivered" | "retry_anyway" | "cancel";
    }) => {
      if (input.item.kind === "publication") {
        return chatEndpointsApi.resolvePublication(
          endpointId,
          input.item.id,
          input.action,
          input.item.fileTransfer
            ? {
                phase: input.item.fileTransfer.phase,
                version: input.item.fileTransfer.version,
              }
            : undefined,
        );
      }
      return chatEndpointsApi.resolveAction(
        endpointId,
        input.item.id,
        input.action,
      );
    },
    onSuccess: async (_result, input) => {
      setResolutionItem(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.activity(endpointId),
      });
      pushToast({
        title:
          input.item.actionType === "slash_task_start" &&
          input.action === "retry_anyway"
            ? t("chatendpointdetail.general.taskstartretried")
            : input.item.actionType === "slash_task_start"
              ? t("chatendpointdetail.general.taskstartcancelled")
              : input.item.actionType === "provider_effect" &&
                  input.action === "mark_delivered"
                ? t("chatendpointdetail.general.providerreplymarkeddelivered")
                : input.item.actionType === "provider_effect" &&
                    input.action === "retry_anyway"
                  ? t("chatendpointdetail.general.providerreplyretried")
                  : input.item.actionType === "provider_effect"
                    ? t("chatendpointdetail.general.providerreplycancelled")
                    : input.action === "mark_delivered"
                      ? t("chatendpointdetail.general.publicationmarkeddelivered")
                      : input.action === "retry_anyway"
                        ? t("chatendpointdetail.general.publicationqueuedforretry")
                        : t("chatendpointdetail.general.publicationcancelled"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("chatendpointdetail.general.couldnotresolveactivity"),
        body: error instanceof Error ? error.message : t("chatendpointdetail.general.tryagainwithperiod"),
        tone: "error",
      }),
  });
  const lifecycle = useMutation({
    mutationFn: (action: "pause" | "resume" | "remove") =>
      chatEndpointsApi.setup(endpointId, { action }),
    onSuccess: async (next, action) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.chatEndpoints.list(next.companyId),
      });
      if (action === "remove") {
        navigate("/apps");
        return;
      }
      queryClient.setQueryData(
        queryKeys.chatEndpoints.detail(endpointId),
        next,
      );
      pushToast({
        title:
          action === "pause"
            ? t("chatendpointdetail.general.connectionpausedtoast")
            : t("chatendpointdetail.general.connectionresumed"),
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({
        title: t("chatendpointdetail.general.couldnotupdateconnection"),
        body: error instanceof Error ? error.message : t("chatendpointdetail.general.tryagainwithperiod"),
        tone: "error",
      }),
  });
  const rows = query.data?.items ?? [];
  const { status } = endpoint;
  const health = connectionHealthPresentation(endpoint, t);
  const lifecycleGuidance = providerLifecycleGuidance(t);
  const lifecycleAction = lifecycle.variables;
  const callbackSurfaceRows = endpoint.setup?.callbackSurfaces
    ? ([
        [t("chatendpointdetail.general.eventsapi"), endpoint.setup.callbackSurfaces.events],
        [t("chatendpointdetail.general.interactivity"), endpoint.setup.callbackSurfaces.interactivity],
        [t("chatendpointdetail.general.slashcommand"), endpoint.setup.callbackSurfaces.slashCommands],
      ] as const)
    : [];
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-semibold">{t("chatendpointdetail.general.connectionactivity")}</h2>
      {((status !== "active" && health.message) || health.error) && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${status === "attention" || status === "revoked" ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/30 text-foreground"}`}
        >
          {(status === "attention" || status === "revoked") && (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            {health.message && <p>{health.message}</p>}
            {health.previousHealth && (
              <p className="mt-1 text-xs opacity-80">
                <span className="font-medium">{t("chatendpointdetail.general.lastreportedhealth")}</span>{" "}
                {health.previousHealth}
              </p>
            )}
            {health.error && (
              <p className="mt-1 text-xs opacity-80">
                <span className="font-medium">{health.errorLabel}:</span>{" "}
                {health.error}
              </p>
            )}
          </div>
        </div>
      )}
      <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium chat-connection-health-summary">
          <span>{t("chatendpointdetail.general.connectionhealthandcontrols")}</span>
          <span className="flex items-center gap-2">
            {endpoint.setup?.callbacksNeedUpdate && <span className="text-xs text-(--status-task-blocked)">{t("chatendpointdetail.general.callbackurlsneedattention")}</span>}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="space-y-5 border-t border-border p-4">
      {endpoint.provider === "slack" && callbackSurfaceRows.length > 0 && (
        <div
          className="space-y-3 text-sm"
        >
          <p className="font-medium">{t("chatendpointdetail.general.slackcallbackhealth")}</p>
          <p className="text-xs text-muted-foreground">
            {endpoint.setup?.callbacksNeedUpdate
              ? t("chatendpointdetail.general.slackcallbackurlsneedanupdatesave")
              : t("chatendpointdetail.general.papercliprecordseachcallbacksurfaceindependentlyafter")}
          </p>
          <div className="divide-y divide-border border-y border-border">
            {callbackSurfaceRows.map(([label, surface]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <p className="text-xs font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {surface.status === "current"
                    ? t("chatendpointdetail.general.current")
                    : surface.status === "stale"
                      ? t("chatendpointdetail.general.staleurl")
                      : t("chatendpointdetail.general.notobserved")}
                </p>
                {surface.observedAt && (
                  <p className="text-xs text-muted-foreground">
                    {t("chatendpointdetail.general.lastobserved")}{" "}
                    <time
                      dateTime={surface.observedAt}
                      title={surface.observedAt}
                      className="font-mono"
                    >
                      {formatDateTime(surface.observedAt, {
                        includeSeconds: true,
                      })}
                    </time>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {status !== "archived" && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {status === "active" && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate("pause")}
              >
                {lifecycle.isPending && lifecycleAction === "pause" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Pause />
                )}
                {t("chatendpointdetail.general.pause")}</Button>
            )}
            {status === "paused" && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate("resume")}
              >
                {lifecycle.isPending && lifecycleAction === "resume" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play />
                )}
                {t("chatendpointdetail.general.resume")}</Button>
            )}
            {[
              "active",
              "paused",
              "attention",
              "revoked",
              "draft",
              "verifying",
            ].includes(status) && (
              <Button
                variant="outline"
                disabled={lifecycle.isPending}
                onClick={() =>
                  navigate(
                    `/apps/chat/connect?provider=${endpoint.provider}&purpose=chat&resume=${endpoint.id}${status === "draft" || status === "verifying" ? "" : "&reconnect=1"}`,
                  )
                }
              >
                <RefreshCw />
                {status === "draft" || status === "verifying"
                  ? t("chatendpointdetail.general.finishsetup")
                  : t("chatendpointdetail.general.reconnect")}
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={lifecycle.isPending}
              onClick={() => setRemoveOpen(true)}
            >
              <Trash2 />
              {t("chatendpointdetail.general.removeconnection")}</Button>
          </div>
          {status !== "draft" && status !== "verifying" && (
            <p className="text-xs text-muted-foreground">
              {lifecycleGuidance[endpoint.provider].reconnect}
            </p>
          )}
        </div>
      )}
        </div>
      </details>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          {t("chatendpointdetail.general.recentactivity")}
        </h3>
        <div className="divide-y divide-border border-y border-border">
          {query.isLoading && (
            <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("chatendpointdetail.general.loadingactivity")}</div>
          )}
          {query.isError && (
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <p className="text-sm text-destructive" role="alert">
                {t("chatendpointdetail.general.connectionactivitycouldnotbeloaded")}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => query.refetch()}
              >
                {t("chatendpointdetail.general.tryagain1")}</Button>
            </div>
          )}
          {!query.isLoading &&
            !query.isError &&
            rows.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-2 py-3 transition-colors hover:bg-accent/50"
              >
                <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
                  {item.kind === "delivery" ? <ArrowDownLeft className="size-4" /> : item.kind === "publication" ? <ArrowUpRight className="size-4" /> : <ActivityIcon className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 text-sm font-medium">{item.summary}</p>
                    <StatusBadge status={item.status} />
                    <time dateTime={item.createdAt} title={item.createdAt} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(item.createdAt, { includeSeconds: true })}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{activityKindLabel(item.kind, t)}</p>
                  {item.fileTransfer && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.fileTransfer.filename} —{" "}
                      {t(fileTransferPhaseLabelKeys[item.fileTransfer.phase])}
                    </p>
                  )}
                  {item.detail && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {activityDetailLabel(item, t)}:
                      </span>{" "}
                      {item.detail}
                    </p>
                  )}
                </div>
                {isReplayEligible(item) && (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={t("chatendpointdetail.general.replayfailed", {
                      kind: activityKindLabel(item.kind, t),
                    })}
                    disabled={replay.isPending}
                    onClick={() => replay.mutate(item)}
                  >
                    {replay.isPending && replay.variables?.id === item.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw />
                    )}
                    {t("chatendpointdetail.general.replay")}</Button>
                )}
                {isResolutionEligible(item) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResolutionItem(item)}
                  >
                    {t("chatendpointdetail.general.resolve")}</Button>
                )}
              </div>
            ))}
          {!query.isLoading && !query.isError && rows.length === 0 && (
            <p className="py-5 text-sm text-muted-foreground">
              {t("chatendpointdetail.general.noconnectionactivityyet")}</p>
          )}
        </div>
      </div>
      <nav aria-label={t("chatendpointdetail.general.activitypagination")} className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{t("chatendpointdetail.general.page", { page: cursors.length })}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={cursors.length === 1 || query.isFetching} onClick={() => setCursors((pages) => pages.slice(0, -1))}>{t("chatendpointdetail.general.previous")}</Button>
          <Button size="sm" variant="outline" disabled={!query.data?.nextCursor || query.isFetching || query.isError} onClick={() => { if (query.data?.nextCursor) setCursors((pages) => [...pages, query.data.nextCursor!]); }}>{t("chatendpointdetail.general.next")}</Button>
        </div>
      </nav>
      <AlertDialog
        open={resolutionItem !== null}
        onOpenChange={(open) => !open && setResolutionItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resolutionItem?.actionType === "slash_task_start"
                ? t("chatendpointdetail.general.resolveunconfirmedtaskstart")
                : resolutionItem?.actionType === "provider_effect"
                  ? t("chatendpointdetail.general.resolveunconfirmedproviderreply")
                  : t("chatendpointdetail.general.resolveunconfirmeddelivery")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resolutionItem?.actionType === "slash_task_start"
                ? t("chatendpointdetail.general.papercliplostconfirmationafteraskingslackto")
                : resolutionItem?.actionType === "provider_effect"
                  ? t("chatendpointdetail.general.papercliplostconfirmationaftersendingthisprovider")
                  : resolutionItem
                    ? activityResolutionDescription(resolutionItem, t)
                    : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel disabled={resolveActivity.isPending}>
              {t("chatendpointdetail.general.keepunresolved")}</AlertDialogCancel>
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes("cancel") && (
                <Button
                  variant="outline"
                  disabled={resolveActivity.isPending}
                  onClick={() =>
                    resolutionItem &&
                    resolveActivity.mutate({
                      item: resolutionItem,
                      action: "cancel",
                    })
                  }
                >
                  {resolutionItem.actionType === "slash_task_start"
                    ? t("chatendpointdetail.general.canceltaskstart")
                    : resolutionItem.actionType === "provider_effect"
                      ? t("chatendpointdetail.general.cancelproviderreply")
                      : resolutionItem.fileTransfer
                        ? t("chatendpointdetail.general.cancelfiletransfer")
                        : t("chatendpointdetail.general.cancelpublication")}
                </Button>
              )}
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes(
                "retry_anyway",
              ) && (
                <Button
                  variant="outline"
                  disabled={resolveActivity.isPending}
                  onClick={() =>
                    resolutionItem &&
                    resolveActivity.mutate({
                      item: resolutionItem,
                      action: "retry_anyway",
                    })
                  }
                >
                  {resolutionItem.fileTransfer
                    ? t("chatendpointdetail.general.retryfilenotification")
                    : t("chatendpointdetail.general.retryanyway")}
                </Button>
              )}
            {resolutionItem &&
              activityResolutionActions(resolutionItem).includes(
                "mark_delivered",
              ) && (
                <AlertDialogAction
                  disabled={resolveActivity.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    if (resolutionItem) {
                      resolveActivity.mutate({
                        item: resolutionItem,
                        action: "mark_delivered",
                      });
                    }
                  }}
                >
                  {t("chatendpointdetail.general.markdelivered")}</AlertDialogAction>
              )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chatendpointdetail.general.removethisconnection")}</AlertDialogTitle>
            <AlertDialogDescription>
              {endpoint.assignedAgentName} {t("chatendpointdetail.general.willstopreceivingnewworkfrom")}              {` ${providerNames[endpoint.provider]}`}{t("chatendpointdetail.general.existingpapercliptasksremainavailable")}{" "}
              {lifecycleGuidance[endpoint.provider].remove}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("chatendpointdetail.general.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={lifecycle.isPending}
              onClick={() => lifecycle.mutate("remove")}
            >
              {lifecycle.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t("chatendpointdetail.general.removeconnection2")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
