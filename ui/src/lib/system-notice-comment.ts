import type {
  IssueCommentMetadata,
  IssueCommentMetadataRow,
  IssueCommentPresentation,
} from "@paperclipai/shared";
import type {
  SystemNoticeMetadataRow,
  SystemNoticeMetadataSection,
  SystemNoticeProps,
  SystemNoticeTone,
} from "../components/SystemNotice";
import { t } from "@/i18n";
import {
  isStrandedRecoveryNotice,
  localizeRecoveryMetadata,
  localizeRecoveryNoticeTitle,
} from "./system-notice-recovery";

const TONE_LABEL_KEY: Record<SystemNoticeTone, string> = {
  neutral: "tok225review.systemNoticeNeutral",
  info: "tok225review.systemNoticeNeutral",
  success: "tok225review.systemNoticeNeutral",
  warning: "tok225review.systemNoticeWarning",
  danger: "tok225review.systemNoticeAlert",
};

function metadataRowText(row: { label?: string | null }, fallback: string) {
  const label = row.label?.trim();
  return label && label.length > 0 ? label : fallback;
}

function mapMetadataRow(
  row: IssueCommentMetadataRow,
  ctx: { runAgentId?: string | null; recoveryNotice?: boolean },
): SystemNoticeMetadataRow | null {
  const fallback = (key: string, english: string) =>
    ctx.recoveryNotice ? t(`tok225review.${key}`) : english;
  switch (row.type) {
    case "text":
      return { kind: "text", label: metadataRowText(row, fallback("recoveryNoticeFieldDetail", "Detail")), value: row.text };
    case "code":
      return { kind: "code", label: metadataRowText(row, fallback("recoveryNoticeFieldCode", "Code")), value: row.code };
    case "key_value":
      return { kind: "text", label: row.label, value: row.value };
    case "issue_link": {
      const identifier = row.identifier ?? null;
      if (!identifier) {
        return { kind: "text", label: metadataRowText(row, fallback("recoveryNoticeFieldTask", "Task")), value: row.title ?? fallback("recoveryNoticeUnknown", "unknown") };
      }
      return {
        kind: "issue",
        label: metadataRowText(row, fallback("recoveryNoticeFieldTask", "Task")),
        identifier,
        href: `/issues/${identifier}`,
        title: row.title ?? undefined,
      };
    }
    case "agent_link": {
      const name = row.name?.trim() || row.agentId.slice(0, 8);
      return {
        kind: "agent",
        label: metadataRowText(row, fallback("recoveryNoticeFieldAgent", "Agent")),
        name,
        href: `/agents/${row.agentId}`,
      };
    }
    case "run_link": {
      const runAgentId = row.agentId ?? ctx.runAgentId ?? null;
      const href = runAgentId ? `/agents/${runAgentId}/runs/${row.runId}` : undefined;
      return {
        kind: "run",
        label: metadataRowText(row, fallback("recoveryNoticeFieldRun", "Run")),
        runId: row.runId,
        href,
        status: row.title ?? undefined,
      };
    }
    default:
      return null;
  }
}

export function mapCommentMetadataToSystemNoticeSections(
  metadata: IssueCommentMetadata | null | undefined,
  ctx: { runAgentId?: string | null; recoveryNotice?: boolean } = {},
): SystemNoticeMetadataSection[] {
  if (!metadata || !Array.isArray(metadata.sections)) return [];
  return metadata.sections
    .map((section) => {
      const rows = section.rows
        .map((row) => mapMetadataRow(row, ctx))
        .filter((r): r is SystemNoticeMetadataRow => r !== null);
      if (rows.length === 0) return null;
      const out: SystemNoticeMetadataSection = { rows };
      if (section.title) out.title = section.title;
      return out;
    })
    .filter((s): s is SystemNoticeMetadataSection => s !== null);
}

export function systemNoticeLabelForTone(
  tone: SystemNoticeTone,
  presentationTitle?: string | null,
  body?: string,
): string {
  const trimmed = presentationTitle?.trim();
  const recoveryTitle = localizeRecoveryNoticeTitle(trimmed, body);
  if (recoveryTitle) return recoveryTitle;
  if (trimmed === "Missing issue disposition") {
    return t("tok225review.noticeMissingDisposition", { defaultValue: trimmed });
  }
  if (trimmed && trimmed.length > 0) return trimmed;
  return t(TONE_LABEL_KEY[tone]);
}

export function buildSystemNoticeProps(input: {
  presentation: IssueCommentPresentation | null;
  metadata: IssueCommentMetadata | null;
  body: import("react").ReactNode;
  timestamp?: string;
  source?: SystemNoticeProps["source"];
  runAgentId?: string | null;
  bodyText?: string;
}): SystemNoticeProps {
  const tone: SystemNoticeTone = input.presentation?.tone ?? "neutral";
  const recoveryNotice = isStrandedRecoveryNotice({
    title: input.presentation?.title,
    body: input.bodyText ?? "",
    metadata: input.metadata,
  });
  const label = systemNoticeLabelForTone(tone, input.presentation?.title, input.bodyText);
  const detailsDefaultOpen = Boolean(input.presentation?.detailsDefaultOpen);
  const metadata = recoveryNotice ? localizeRecoveryMetadata(input.metadata) : input.metadata;
  const sections = mapCommentMetadataToSystemNoticeSections(metadata, {
    runAgentId: input.runAgentId ?? null,
    recoveryNotice,
  });
  return {
    tone,
    label,
    body: input.body,
    metadata: sections.length > 0 ? sections : undefined,
    detailsDefaultOpen,
    timestamp: input.timestamp,
    source: input.source,
  };
}
