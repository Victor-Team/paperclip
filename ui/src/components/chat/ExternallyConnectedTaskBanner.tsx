import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Paperclip, Radio } from "lucide-react";
import type {
  ChatPublicationState,
  ChatFileTransferPhase,
  IssueAttachment,
} from "@paperclipai/shared";
import {
  chatEndpointsApi,
  type ChatProvider,
  type ChatPublicationSummary,
  type ExternalChannelBindingSummary,
} from "@/api/chatEndpoints";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/context/ToastContext";
import { Link } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { useChatConnectorsEnabled } from "@/hooks/useChatConnectorsEnabled";
import { issuesApi } from "@/api/issues";
import {
  boardSendDraftKey,
  clearBoardSendDraft,
  canDismissBoardSendBatch,
  readBoardSendDraft,
  readBoardSendRejection,
  writeBoardSendDraft,
  type BoardSendRejection,
  type RetainedBoardSend,
} from "./board-send-draft";
import { useTranslation } from "@/i18n";

const providerNames: Record<ChatProvider, string> = {
  slack: "Slack",
  github: "GitHub",
  discord: "Discord",
  "microsoft-teams": "Microsoft Teams",
  telegram: "Telegram",
  agentmail: "AgentMail",
  "imessage-photon": "iMessage Photon",
};

type PublicationFeedback = {
  titleKey: string;
  bodyKey: string;
  tone: "info" | "success" | "warn" | "error";
};

const publicationFeedback: Record<ChatPublicationState, PublicationFeedback> = {
  awaiting_consent: {
    titleKey: "externallyconnectedtaskbanner.general.waitingforfileconsent",
    bodyKey: "externallyconnectedtaskbanner.general.therecipientmustacceptthefilecard",
    tone: "info",
  },
  published: {
    titleKey: "externallyconnectedtaskbanner.general.senttochannel",
    bodyKey: "externallyconnectedtaskbanner.general.theboardupdatewaspublishedtotheconnected",
    tone: "success",
  },
  pending: {
    titleKey: "externallyconnectedtaskbanner.general.queuedforchannel",
    bodyKey: "externallyconnectedtaskbanner.general.deliveryisstillpendingyourdraftiskept",
    tone: "info",
  },
  streaming: {
    titleKey: "externallyconnectedtaskbanner.general.publishingtochannel",
    bodyKey: "externallyconnectedtaskbanner.general.deliveryisstillinprogressyourdraftiskept",
    tone: "info",
  },
  retry: {
    titleKey: "externallyconnectedtaskbanner.general.deliveryretryscheduled",
    bodyKey: "externallyconnectedtaskbanner.general.paperclipwillretrythispublicationyourdraft",
    tone: "warn",
  },
  delivery_unknown: {
    titleKey: "externallyconnectedtaskbanner.general.deliverynotconfirmed",
    bodyKey: "externallyconnectedtaskbanner.general.theprovidermayhaveacceptedthisupdate",
    tone: "warn",
  },
  failed: {
    titleKey: "externallyconnectedtaskbanner.general.channeldeliveryfailed",
    bodyKey: "externallyconnectedtaskbanner.general.yourdraftiskeptopenactivitytoretrythis",
    tone: "error",
  },
  cancelled: {
    titleKey: "externallyconnectedtaskbanner.general.channeldeliverycancelled",
    bodyKey: "externallyconnectedtaskbanner.general.yourdraftiskeptsomepartsmayalreadyhave",
    tone: "info",
  },
};

const filePhaseLabelKeys: Record<ChatFileTransferPhase, string> = {
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

function resolvePublicationFeedback(
  t: (key: string) => string,
  feedback: PublicationFeedback,
) {
  return {
    title: t(feedback.titleKey),
    body: t(feedback.bodyKey),
    tone: feedback.tone,
  };
}

export function useIssueChatBinding(companyId: string, issueId: string) {
  const { enabled } = useChatConnectorsEnabled();
  const queryEnabled = enabled && Boolean(companyId && issueId) && !issueId.startsWith("chat:");
  const query = useQuery({
    queryKey: ["issue-chat-binding", companyId, issueId],
    queryFn: () => chatEndpointsApi.getIssueBinding(issueId),
    enabled: queryEnabled,
  });
  return {
    binding: queryEnabled ? (query.data ?? null) : null,
    isLoading: queryEnabled && query.isLoading,
  };
}

type ConnectedTaskProps = {
  attachments?: IssueAttachment[];
  companyId: string;
  issueId: string;
  issueCacheRefs?: string[];
};

export function ExternallyConnectedTaskBanner(props: ConnectedTaskProps) {
  const { binding } = useIssueChatBinding(props.companyId, props.issueId);
  if (!binding || binding.provider === "agentmail") return null;
  return (
    <ConnectedTaskComposer
      key={boardSendDraftKey(
        props.companyId,
        props.issueId,
        binding.endpointId,
        binding.conversationId,
      )}
      {...props}
      binding={binding}
    />
  );
}

function ConnectedTaskComposer({
  attachments = [],
  companyId,
  issueId,
  issueCacheRefs,
  binding,
}: ConnectedTaskProps & { binding: ExternalChannelBindingSummary }) {
  const { t } = useTranslation();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>(
    [],
  );
  const [publication, setPublication] = useState<ChatPublicationSummary | null>(
    null,
  );
  const idempotencyKey = useRef<string | null>(null);
  const retainedSend = useRef<RetainedBoardSend | null>(null);
  const retainedScopeKey = useRef<string | null>(null);
  const [unconfirmedRequest, setUnconfirmedRequest] = useState(false);
  const [rejection, setRejection] = useState<BoardSendRejection | null>(null);
  const [excludedAttachmentIds, setExcludedAttachmentIds] = useState<string[]>(
    [],
  );
  const [selectionNotice, setSelectionNotice] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadInFlight = useRef(false);
  const mounted = useRef(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAttachments, setUploadedAttachments] = useState<
    IssueAttachment[]
  >([]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const storageKey = binding
    ? boardSendDraftKey(
        companyId,
        issueId,
        binding.endpointId,
        binding.conversationId,
      )
    : null;
  const loadedStorageKey = useRef<string | null>(null);
  useEffect(() => {
    if (!storageKey || loadedStorageKey.current === storageKey) return;
    loadedStorageKey.current = storageKey;
    try {
      const saved = readBoardSendDraft(storageKey);
      retainedScopeKey.current = storageKey;
      retainedSend.current = saved;
      idempotencyKey.current = saved?.idempotencyKey ?? null;
      setBody(saved?.body ?? "");
      setSelectedAttachmentIds(saved?.attachmentIds ?? []);
      setPublication(saved?.publication ?? null);
      setUnconfirmedRequest(
        Boolean(saved && !saved.publication && !saved.rejection),
      );
      setRejection(saved?.rejection ?? null);
      setComposing(Boolean(saved));
      setStorageError(null);
    } catch {
      setStorageError(
        t("externallyconnectedtaskbanner.general.saveddeliveryidentitycouldnotberead"),
      );
      setComposing(true);
    }
  }, [storageKey, t]);
  const deliveryScopeReady = Boolean(
    storageKey &&
    loadedStorageKey.current === storageKey &&
    retainedScopeKey.current === storageKey,
  );
  const invalidateTask = useCallback(() => {
    for (const ref of new Set([issueId, ...(issueCacheRefs ?? [])])) {
      for (const queryKey of [
        queryKeys.issues.comments(ref),
        queryKeys.issues.attachments(ref),
        queryKeys.issues.detail(ref),
        queryKeys.issues.activity(ref),
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }
  }, [issueId, issueCacheRefs, queryClient]);
  const finishPublication = useCallback(() => {
    if (storageKey) {
      try {
        clearBoardSendDraft(storageKey);
      } catch {
        /* The retained anchor remains safe to recheck after reload. */
      }
    }
    retainedSend.current = null;
    setUnconfirmedRequest(false);
    setRejection(null);
    setSelectionNotice(false);
    setPublication(null);
    idempotencyKey.current = null;
    setBody("");
    setSelectedAttachmentIds([]);
    setUploadedAttachments([]);
    setUploadError(null);
    setComposing(false);
    invalidateTask();
    pushToast(resolvePublicationFeedback(t, publicationFeedback.published));
  }, [invalidateTask, pushToast, storageKey, t]);
  // Keep the first returned ID as the anchor. A batch's blocking row may
  // change as text and files finish; no read is allowed to submit another send.
  const publicationStatus = useQuery({
    queryKey: [
      "chat-publication-batch",
      companyId,
      binding?.endpointId,
      binding?.conversationId,
      publication?.id,
    ],
    queryFn: () =>
      chatEndpointsApi.getPublicationBatchStatus(
        binding!.endpointId,
        binding!.conversationId,
        publication!.id,
      ),
    enabled: deliveryScopeReady && Boolean(publication),
    staleTime: 0,
    refetchInterval: 2_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  useEffect(() => {
    const batch = publicationStatus.data;
    if (
      publication &&
      batch &&
      batch.total > 0 &&
      batch.published === batch.total &&
      batch.publication.state === "published"
    ) {
      finishPublication();
    }
  }, [publication, publicationStatus.data, finishPublication]);
  const publish = useMutation({
    mutationFn: (input: {
      attachmentIds: string[];
      body: string;
      idempotencyKey: string;
      endpointId: string;
      conversationId: string;
    }) =>
      chatEndpointsApi.publishBoardMessage(
        input.endpointId,
        input.conversationId,
        input.body,
        input.idempotencyKey,
        input.attachmentIds,
      ),
    onSuccess: (result) => {
      invalidateTask();
      const feedback = publicationFeedback[result.state];
      setPublication(result.state === "published" ? null : result);
      if (result.state === "published") {
        finishPublication();
        return;
      }
      setUnconfirmedRequest(false);
      if (storageKey && retainedSend.current) {
        retainedSend.current = {
          ...retainedSend.current,
          publication: {
            id: result.id,
            state: result.state,
            attempts: result.attempts,
          },
        };
        try {
          writeBoardSendDraft(storageKey, retainedSend.current);
        } catch {
          // The pre-POST payload/key is already persisted. It remains a safe,
          // explicit same-request retry when the publication ID cannot be saved.
        }
      }
      pushToast({
        ...resolvePublicationFeedback(t, feedback),
        action: {
          label: t("externallyconnectedtaskbanner.general.viewactivity"),
          href: `/apps/chat/${binding!.endpointId}/activity`,
        },
      });
    },
    onError: (error, request) => {
      const rejected = readBoardSendRejection(error, request);
      if (rejected && retainedSend.current && storageKey) {
        const saved = { ...retainedSend.current, rejection: rejected };
        try {
          // Keep the negative receipt through reload before offering a new key.
          writeBoardSendDraft(storageKey, saved);
        } catch {
          setStorageError(
            t("externallyconnectedtaskbanner.general.therejectedsendcouldnotbesaved"),
          );
          return;
        }
        retainedSend.current = saved;
        setRejection(rejected);
        setUnconfirmedRequest(false);
        invalidateTask();
        pushToast({
          title: t("externallyconnectedtaskbanner.general.updatewasnotsent"),
          body: t("externallyconnectedtaskbanner.general.aselectedfilealreadybelongstoanother"),
          tone: "error",
        });
        return;
      }
      pushToast({
        title: t("externallyconnectedtaskbanner.general.couldntconfirmchanneldelivery"),
        body:
          error instanceof Error
            ? t("externallyconnectedtaskbanner.general.deliveryerrorwithmessage", { error: error.message })
            : t("externallyconnectedtaskbanner.general.yourdraftiskeptretryingherereusesthe"),
        tone: "error",
      });
    },
  });
  const uploadDisabled = Boolean(
    retainedSend.current ||
    publication ||
    publish.isPending ||
    publish.isError ||
    unconfirmedRequest ||
    storageError ||
    !deliveryScopeReady ||
    uploading,
  );
  async function uploadFile(file: File) {
    if (uploadDisabled || uploadInFlight.current || retainedSend.current)
      return;
    uploadInFlight.current = true;
    setUploading(true);
    setUploadError(null);
    try {
      const attachment = await issuesApi.uploadAttachment(
        companyId,
        issueId,
        file,
      );
      if (!mounted.current) return;
      setUploadedAttachments((current) => [...current, attachment]);
      setSelectedAttachmentIds((current) => [...current, attachment.id]);
      idempotencyKey.current = null;
    } catch (error) {
      if (mounted.current) {
        setUploadError(
          error instanceof Error
            ? t("externallyconnectedtaskbanner.general.uploaderrorwithmessage", { error: error.message })
            : t("externallyconnectedtaskbanner.general.uploadcouldnotbeconfirmednochannelsent"),
        );
      }
    } finally {
      uploadInFlight.current = false;
      if (mounted.current) setUploading(false);
      // An interrupted response may still have stored the file on this task.
      invalidateTask();
    }
  }
  // Keep newly uploaded files usable before the task refetch completes. Once
  // present, server metadata wins (especially a file bound to a sent comment).
  const taskAttachments = [
    ...new Map(
      [...uploadedAttachments, ...attachments].map((attachment) => [
        attachment.id,
        attachment,
      ]),
    ).values(),
  ];
  useEffect(() => {
    // Metadata may arrive after this file was selected but before Send. Never
    // silently keep a now-hidden selection, and never rewrite a retained send.
    if (retainedSend.current) return;
    const newlyBound = attachments
      .filter((file) => file.issueCommentId !== null)
      .map((file) => file.id);
    if (!selectedAttachmentIds.some((id) => newlyBound.includes(id))) return;
    setSelectedAttachmentIds((current) =>
      current.filter((id) => !newlyBound.includes(id)),
    );
    setSelectionNotice(true);
    idempotencyKey.current = null;
  }, [attachments, selectedAttachmentIds]);
  const showingRetainedFiles = Boolean(retainedSend.current);
  // Comment binding removes files from new-send eligibility, not from the
  // immutable receipt for the current send. Saved names survive reload while
  // task metadata is loading (or a selected attachment has since been removed).
  const visibleAttachments = retainedSend.current
    ? retainedSend.current.attachmentIds.map((id) => ({
        id,
        originalFilename:
          retainedSend.current?.attachmentNames?.find((file) => file.id === id)
            ?.name ??
          taskAttachments.find((attachment) => attachment.id === id)
            ?.originalFilename ??
          t("externallyconnectedtaskbanner.general.selectedtaskfiledetailsunavailable"),
      }))
    : taskAttachments.filter(
        (attachment) =>
          attachment.issueCommentId === null &&
          !excludedAttachmentIds.includes(attachment.id),
      );
  const currentPublication = publicationStatus.data?.publication ?? publication;
  const batch = publicationStatus.data;
  const dismissible =
    !publicationStatus.isError &&
    !publicationStatus.isFetching &&
    canDismissBoardSendBatch(batch);
  const mixedTerminal =
    canDismissBoardSendBatch(batch) && batch!.published < batch!.total;
  const currentFeedback = mixedTerminal
    ? resolvePublicationFeedback(t, {
        titleKey: "externallyconnectedtaskbanner.general.deliverysettledwithmixedoutcomes",
        bodyKey: "externallyconnectedtaskbanner.general.noteverypartwasconfirmeddeliveredreviewthe",
        tone: "info",
      })
    : currentPublication?.state === "cancelled" &&
        (batch?.awaitingConsent ?? 0) > 0
      ? resolvePublicationFeedback(t, {
          titleKey: "externallyconnectedtaskbanner.general.waitingforremainingfileconsent",
          bodyKey: "externallyconnectedtaskbanner.general.somepartshavesettledtheremainingfilecards",
          tone: "info",
        })
      : currentPublication
        ? resolvePublicationFeedback(t, publicationFeedback[currentPublication.state])
        : null;
  const activityPath = `/apps/chat/${binding.endpointId}/activity`;
  return (
    <section
      aria-label={t("externallyconnectedtaskbanner.general.externalconversation")}
      className="space-y-3 rounded-lg border border-border bg-muted/40 p-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
          <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {t("externallyconnectedtaskbanner.general.connectedto")} {providerNames[binding.provider]}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {binding.externalLabel} {t("externallyconnectedtaskbanner.general.agentassignmentisfixedforthisexternal")}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {binding.externalUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={binding.externalUrl} target="_blank" rel="noreferrer">
                {t("externallyconnectedtaskbanner.general.open")} {providerNames[binding.provider]} <ExternalLink />
              </a>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setComposing((value) => !value)}
          >
            {t("externallyconnectedtaskbanner.general.sendtochannel")}</Button>
          <Button asChild size="sm" variant="ghost">
            <Link to={`/apps/chat/${binding.endpointId}/conversations`}>
              {t("externallyconnectedtaskbanner.general.connection")}</Link>
          </Button>
        </div>
      </div>
      {composing && (
        <div className="space-y-2 border-t border-border pt-3">
          <label
            className="text-xs font-medium"
            htmlFor="external-board-update"
          >
            {t("externallyconnectedtaskbanner.general.boardupdate")}</label>
          <Textarea
            id="external-board-update"
            value={body}
            disabled={
              Boolean(publication) ||
              Boolean(rejection) ||
              publish.isError ||
              unconfirmedRequest ||
              Boolean(storageError) ||
              !deliveryScopeReady
            }
            onChange={(event) => {
              setBody(event.target.value);
              idempotencyKey.current = null;
              publish.reset();
            }}
            placeholder={t("externallyconnectedtaskbanner.general.writeonlywhatshouldbevisiblein")}
          />
          {selectedAttachmentIds.length > 0 && !body.trim() && (
            <p className="text-xs text-muted-foreground">
              {t("externallyconnectedtaskbanner.general.addamessagetosendwithyour")}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              aria-label={t("externallyconnectedtaskbanner.general.attachfiletochannelupdate")}
              disabled={uploadDisabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadFile(file);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploadDisabled}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip />
              {uploading ? t("externallyconnectedtaskbanner.general.uploading") : t("externallyconnectedtaskbanner.general.attachfile")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("externallyconnectedtaskbanner.general.filesstayonthistaskuntilyou")}</p>
          </div>
          {uploadError && (
            <p role="alert" className="text-xs text-destructive">
              {uploadError}
            </p>
          )}
          {selectionNotice && (
            <p role="status" className="text-xs text-muted-foreground">
              {t("externallyconnectedtaskbanner.general.afilealreadyattachedtoanothercomment")}</p>
          )}
          {visibleAttachments.length > 0 && (
            <fieldset
              className="space-y-2 rounded-md border border-border bg-background p-3"
              disabled={
                showingRetainedFiles ||
                Boolean(publication) ||
                publish.isError ||
                unconfirmedRequest ||
                Boolean(storageError) ||
                !deliveryScopeReady
              }
            >
              <legend className="px-1 text-xs font-medium">
                {showingRetainedFiles
                  ? t("externallyconnectedtaskbanner.general.filesinthissend")
                  : t("externallyconnectedtaskbanner.general.includetaskfiles")}
              </legend>
              <p className="text-xs text-muted-foreground">
                {binding.provider === "github"
                  ? t("externallyconnectedtaskbanner.general.githubappscannotuploadfilebytesin")
                  : binding.provider === "microsoft-teams" &&
                      !showingRetainedFiles
                    ? t("externallyconnectedtaskbanner.general.inpersonalteamschatsrecipientsaccepteach")
                    : showingRetainedFiles
                      ? t("externallyconnectedtaskbanner.general.thesearethefilesselectedforthis")
                      : t("externallyconnectedtaskbanner.general.onlycheckedfileswillbepublishedto")}
              </p>
              <div className="space-y-2">
                {visibleAttachments.map((attachment) => {
                  const label =
                    attachment.originalFilename ??
                    t("externallyconnectedtaskbanner.general.unnamedattachment");
                  return (
                    <label
                      className="flex items-center gap-2 text-xs"
                      key={attachment.id}
                    >
                      <Checkbox
                        disabled={showingRetainedFiles}
                        checked={selectedAttachmentIds.includes(attachment.id)}
                        onCheckedChange={(checked) => {
                          setSelectedAttachmentIds((current) =>
                            checked === true
                              ? [...current, attachment.id]
                              : current.filter((id) => id !== attachment.id),
                          );
                          idempotencyKey.current = null;
                          publish.reset();
                        }}
                      />
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {storageError && (
            <p role="alert" className="text-xs text-destructive">
              {storageError}
            </p>
          )}
          {rejection && (
            <div
              role="alert"
              className="space-y-1 rounded-md border border-border bg-background p-3 text-xs"
            >
              <p className="font-medium">{t("externallyconnectedtaskbanner.general.updatewasnotsent")}</p>
              <p className="text-muted-foreground">
                {t("externallyconnectedtaskbanner.general.aselectedfilealreadybelongstoanother")}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(storageError)}
                onClick={() => {
                  if (!storageKey || !retainedSend.current?.rejection) return;
                  try {
                    clearBoardSendDraft(storageKey);
                  } catch {
                    setStorageError(
                      t("externallyconnectedtaskbanner.general.savedrejectioncouldnotbecleared"),
                    );
                    return;
                  }
                  const invalidIds =
                    retainedSend.current.rejection.attachmentIds;
                  setExcludedAttachmentIds((current) => [
                    ...new Set([...current, ...invalidIds]),
                  ]);
                  setSelectedAttachmentIds((current) =>
                    current.filter((id) => !invalidIds.includes(id)),
                  );
                  setUploadedAttachments((current) =>
                    current.filter((file) => !invalidIds.includes(file.id)),
                  );
                  retainedSend.current = null;
                  idempotencyKey.current = null;
                  setRejection(null);
                  setUnconfirmedRequest(false);
                  setSelectionNotice(true);
                  publish.reset();
                }}
              >
                {t("externallyconnectedtaskbanner.general.editrejectedsend")}</Button>
            </div>
          )}
          {!rejection &&
            (publish.isError || unconfirmedRequest) &&
            !publish.isPending &&
            !publication && (
              <div
                role="alert"
                className="space-y-1 rounded-md border border-border bg-background p-3 text-xs"
              >
                <p className="font-medium">{t("externallyconnectedtaskbanner.general.deliveryresultnotconfirmed")}</p>
                <p className="text-muted-foreground">
                  {t("externallyconnectedtaskbanner.general.yourexactdraftandrequestidentityare")}</p>
                <Link
                  className="inline-block font-medium underline underline-offset-4"
                  to={activityPath}
                >
                  {t("externallyconnectedtaskbanner.general.openactivity")}</Link>
              </div>
            )}
          {publication && currentPublication && currentFeedback && (
            <div
              role={
                currentPublication.state === "failed" ||
                currentPublication.state === "delivery_unknown"
                  ? "alert"
                  : "status"
              }
              className="space-y-1 rounded-md border border-border bg-background p-3 text-xs"
            >
              <p className="font-medium">{currentFeedback.title}</p>
              <p className="text-muted-foreground">{currentFeedback.body}</p>
              {batch && (
                <p className="text-muted-foreground">
                  {batch.declined !== undefined &&
                  batch.expired !== undefined &&
                  batch.cancelled !== undefined &&
                  batch.awaitingConsent !== undefined
                    ? [
                        t("externallyconnectedtaskbanner.general.publishedcount", { count: batch.published }),
                        ...(batch.awaitingConsent
                          ? [t("externallyconnectedtaskbanner.general.awaitingconsentcount", { count: batch.awaitingConsent })]
                          : []),
                        ...(batch.declined
                          ? [t("externallyconnectedtaskbanner.general.declinedcount", { count: batch.declined })]
                          : []),
                        ...(batch.expired ? [t("externallyconnectedtaskbanner.general.expiredcount", { count: batch.expired })] : []),
                        ...(batch.cancelled
                          ? [t("externallyconnectedtaskbanner.general.cancelledcount", { count: batch.cancelled })]
                          : []),
                      ].join(" · ")
                    : t("externallyconnectedtaskbanner.general.partspublishedcount", { published: batch.published, total: batch.total })}
                </p>
              )}
              {batch?.parts?.some((part) => part.fileTransfer) && (
                <ul
                  className="space-y-1 text-muted-foreground"
                  aria-label={t("externallyconnectedtaskbanner.general.filedeliveryoutcomes")}
                >
                  {batch.parts
                    .filter((part) => part.fileTransfer)
                    .map((part) => (
                      <li key={part.id}>
                        {part.fileTransfer!.filename} —{" "}
                        {t(filePhaseLabelKeys[part.fileTransfer!.phase])}
                      </li>
                    ))}
                </ul>
              )}
              {publicationStatus.isError && (
                <p role="alert" className="text-muted-foreground">
                  {t("externallyconnectedtaskbanner.general.deliverystatuscouldnotberefreshedyour")}</p>
              )}
              {currentPublication.redactedError && (
                <p className="text-muted-foreground">
                  {t("externallyconnectedtaskbanner.general.providerdetail")} {currentPublication.redactedError}
                </p>
              )}
              <Link
                className="inline-block font-medium underline underline-offset-4"
                to={activityPath}
              >
                {t("externallyconnectedtaskbanner.general.openactivity1")}</Link>
              {dismissible && (
                <Button
                  className="ml-3"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (storageKey) {
                      try {
                        clearBoardSendDraft(storageKey);
                      } catch {
                        setStorageError(
                          t("externallyconnectedtaskbanner.general.saveddeliveryidentitycouldnotbecleared"),
                        );
                        return;
                      }
                    }
                    setStorageError(null);
                    retainedSend.current = null;
                    setUnconfirmedRequest(false);
                    setPublication(null);
                    setBody("");
                    setSelectedAttachmentIds([]);
                    setUploadedAttachments([]);
                    setUploadError(null);
                    idempotencyKey.current = null;
                    publish.reset();
                  }}
                >
                  {t("externallyconnectedtaskbanner.general.dismissdeliveryreceipt")}</Button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t("externallyconnectedtaskbanner.general.ordinaryboardcommentsremainpapercliponly")}</p>
            <Button
              size="sm"
              disabled={
                !body.trim() ||
                publish.isPending ||
                uploading ||
                Boolean(publication) ||
                Boolean(rejection) ||
                Boolean(storageError) ||
                !deliveryScopeReady
              }
              onClick={() => {
                if (
                  uploadInFlight.current ||
                  !storageKey ||
                  loadedStorageKey.current !== storageKey ||
                  retainedScopeKey.current !== storageKey
                )
                  return;
                idempotencyKey.current ??= crypto.randomUUID();
                const input = retainedSend.current ?? {
                  attachmentIds: selectedAttachmentIds,
                  attachmentNames: selectedAttachmentIds.map((id) => ({
                    id,
                    name:
                      taskAttachments.find((attachment) => attachment.id === id)
                        ?.originalFilename ??
                      t("externallyconnectedtaskbanner.general.unnamedattachment"),
                  })),
                  body: body.trim(),
                  idempotencyKey: idempotencyKey.current,
                  publication: null,
                };
                try {
                  if (!storageKey) throw new Error("Missing delivery scope");
                  writeBoardSendDraft(storageKey, input);
                } catch {
                  setStorageError(
                    t("externallyconnectedtaskbanner.general.browserstoragecouldnotpreservethisdelivery"),
                  );
                  return;
                }
                retainedSend.current = input;
                setUnconfirmedRequest(true);
                publish.mutate({
                  ...input,
                  endpointId: binding.endpointId,
                  conversationId: binding.conversationId,
                });
              }}
            >
              {publish.isPending
                ? t("externallyconnectedtaskbanner.general.sending")
                : !rejection && (publish.isError || unconfirmedRequest)
                  ? t("externallyconnectedtaskbanner.general.retrysafely")
                  : t("externallyconnectedtaskbanner.general.sendtochannel2")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
