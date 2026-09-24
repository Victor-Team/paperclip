import { useEffect, useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import type { IssueExternalObjectGroup } from "../../hooks/useIssueExternalObjects";
import {
  externalObjectIconForKey,
  externalObjectProviderLabel,
  externalObjectToneSeverity,
} from "../../lib/external-objects";
import {
  externalObjectStatusIcon,
  externalObjectStatusIconDefault,
} from "../../lib/status-colors";
import { cn } from "../../lib/utils";
import { ExternalObjectStatusIcon } from "../ExternalObjectStatusIcon";
import { PropertyRow } from "./primitives";
import { ExpandRelationListButton } from "./relation-controls";
import { useTranslation } from "@/i18n";

const EXTERNAL_OBJECT_PROPERTY_PREVIEW_COUNT = 5;

const EXTERNAL_OBJECT_STATUS_KEYS: Record<string, string> = {
  unknown: "externalobjectrows.general.statusnotyetresolved",
  open: "externalobjectrows.general.statusopen",
  waiting: "externalobjectrows.general.statuswaiting",
  running: "externalobjectrows.general.statusrunning",
  succeeded: "externalobjectrows.general.statussucceeded",
  failed: "externalobjectrows.general.statusfailed",
  blocked: "externalobjectrows.general.statusblocked",
  closed: "externalobjectrows.general.statusclosed",
  archived: "externalobjectrows.general.statusarchived",
  auth_required: "externalobjectrows.general.statusauthorizationrequired",
  unreachable: "externalobjectrows.general.statusunreachable",
};

const EXTERNAL_OBJECT_LIVENESS_KEYS: Record<string, string> = {
  unknown: "externalobjectrows.general.livenessnotyetrefreshed",
  fresh: "externalobjectrows.general.livenessfresh",
  stale: "externalobjectrows.general.livenessstale",
  auth_required: "externalobjectrows.general.livenessrequiresauth",
  unreachable: "externalobjectrows.general.statusunreachable",
};

const EXTERNAL_OBJECT_TYPE_KEYS: Record<string, string> = {
  pull_request: "externalobjectrows.general.pullrequest",
  issue: "externalobjectrows.general.issue",
  deployment: "externalobjectrows.general.deployment",
  workflow_run: "externalobjectrows.general.workflowrun",
  ticket: "externalobjectrows.general.ticket",
  lead: "externalobjectrows.general.lead",
  url_link: "externalobjectrows.general.url",
};

function sortExternalObjectGroups(groups: IssueExternalObjectGroup[]) {
  return [...groups].sort((a, b) => {
    const aTone = externalObjectToneSeverity(a.group.object?.statusTone);
    const bTone = externalObjectToneSeverity(b.group.object?.statusTone);
    return bTone - aTone;
  });
}

function externalObjectProviderDisplayLabel(
  providerKey: string | null | undefined,
  t: TFunction,
): string {
  return providerKey ? externalObjectProviderLabel(providerKey) : t("externalobjectrows.general.external");
}

function externalObjectTypeDisplayLabel(
  objectType: string | null | undefined,
  t: TFunction,
): string {
  if (!objectType) return t("externalobjectrows.general.object");
  const key = EXTERNAL_OBJECT_TYPE_KEYS[objectType];
  return key
    ? t(key)
    : t("externalobjectrows.general.objecttypefallback", { type: objectType.replace(/_/g, " ") });
}

function externalObjectStatusLabel(group: IssueExternalObjectGroup, t: TFunction): string {
  const { pill } = group;
  const trimmedStatusLabel = pill.statusLabel?.trim();
  if (trimmedStatusLabel) return trimmedStatusLabel;

  const isGenericUrl = pill.providerKey === "url" && pill.objectType === "link";
  const hasKnownObjectType = Boolean(pill.providerKey && pill.objectType);
  if (pill.statusCategory === "unknown" && hasKnownObjectType && !isGenericUrl) {
    return pill.liveness === "fresh"
      ? t("externalobjectrows.general.statusunavailable")
      : t(EXTERNAL_OBJECT_LIVENESS_KEYS[pill.liveness] ?? "externalobjectrows.general.livenessfallback", {
          state: pill.liveness.replace(/_/g, " "),
        });
  }

  return t(EXTERNAL_OBJECT_STATUS_KEYS[pill.statusCategory] ?? "externalobjectrows.general.statusfallback", {
    status: pill.statusCategory.replace(/_/g, " "),
  });
}

function externalObjectRowDisplayKey(group: IssueExternalObjectGroup, t: TFunction): string {
  const { pill } = group;
  const displayKey = pill.displayKey?.trim();
  if (displayKey) return displayKey;
  if (pill.providerKey === "github") {
    if (pill.objectType === "pull_request") return t("externalobjectrows.general.githubpullrequest");
    if (pill.objectType === "issue") return t("externalobjectrows.general.githubissue");
  }
  return t("externalobjectrows.general.providerobject", {
    provider: externalObjectProviderDisplayLabel(pill.providerKey, t),
    type: externalObjectTypeDisplayLabel(pill.objectType, t),
  });
}

function externalObjectRowLabel(group: IssueExternalObjectGroup, t: TFunction): ReactNode {
  const { pill } = group;
  const displayKey = externalObjectRowDisplayKey(group, t);
  const Icon = externalObjectIconForKey(pill.iconKey);
  return (
    <span className="inline-flex min-w-0 items-start gap-1" title={displayKey}>
      {Icon ? <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : null}
      <span className="truncate">{displayKey}</span>
    </span>
  );
}

function githubObjectPropertyValue(url: string | null | undefined, t: TFunction): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const [, owner, repo, kind, number] = parsed.pathname.split("/");
    if (!owner || !repo || !number) return null;
    if (kind === "pull") return t("externalobjectrows.general.pullrequestnumber", { number });
    if (kind === "issues") return t("externalobjectrows.general.issuenumber", { number });
    return null;
  } catch {
    return null;
  }
}

function externalObjectPropertyValue(group: IssueExternalObjectGroup, t: TFunction): string {
  const { pill } = group;
  const statusLabel = externalObjectStatusLabel(group, t);
  const githubLabel = pill.providerKey === "github" ? githubObjectPropertyValue(pill.url, t) : null;
  const base = githubLabel ?? pill.displayTitle?.trim() ?? externalObjectRowDisplayKey(group, t);
  return statusLabel ? t("externalobjectrows.general.objectwithstatus", { base, status: statusLabel }) : base;
}

function isMergedExternalObject(group: IssueExternalObjectGroup, t: TFunction): boolean {
  const statusLabel = externalObjectStatusLabel(group, t);
  return group.pill.statusIconKey === "git-merge" || statusLabel.toLowerCase() === "merged";
}

function externalObjectPropertyTone(group: IssueExternalObjectGroup, t: TFunction): string {
  const tone = isMergedExternalObject(group, t)
    ? externalObjectStatusIcon.merged
    : externalObjectStatusIcon[group.pill.statusCategory] ?? externalObjectStatusIconDefault;
  return tone.split(" ").filter((c) => c.startsWith("text-")).join(" ");
}

function externalObjectPropertyStatusIconKey(group: IssueExternalObjectGroup, t: TFunction): string | null | undefined {
  if (isMergedExternalObject(group, t)) return group.pill.statusIconKey ?? "git-merge";
  return group.pill.statusIconKey;
}

function externalObjectPropertyTitle(group: IssueExternalObjectGroup, t: TFunction): string {
  const { pill, sourceLabels } = group;
  const base = pill.displayTitle ?? externalObjectPropertyValue(group, t);
  return sourceLabels.length > 0
    ? t("externalobjectrows.general.objectwithsources", { base, sources: sourceLabels.join(", ") })
    : base;
}

function ExternalObjectPropertyValue({ group }: { group: IssueExternalObjectGroup }) {
  const { t } = useTranslation();
  const { pill } = group;
  const statusLabel = externalObjectStatusLabel(group, t);
  const providerLabel = externalObjectProviderDisplayLabel(pill.providerKey, t);
  const typeLabel = externalObjectTypeDisplayLabel(pill.objectType, t);
  const value = externalObjectPropertyValue(group, t);
  const content = (
    <>
      <ExternalObjectStatusIcon
        category={pill.statusCategory}
        liveness={pill.liveness}
        statusIconKey={externalObjectPropertyStatusIconKey(group, t)}
        sizeClassName="h-3.5 w-3.5"
        label={t("externalobjectrows.general.providerstatus", { provider: providerLabel, status: statusLabel })}
      />
      <span className="min-w-0 truncate">{value}</span>
    </>
  );
  const className = cn(
    "inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm no-underline",
    externalObjectPropertyTone(group, t),
    pill.url ? "hover:underline focus-visible:outline-none focus-visible:ring-(length:--rad-3) focus-visible:ring-ring" : "",
  );

  if (pill.url) {
    return (
      <a
        href={pill.url}
        target="_blank"
        rel="noopener noreferrer"
        data-mention-kind="external-object"
        data-external-status={pill.statusCategory}
        data-external-liveness={pill.liveness}
        className={className}
        title={externalObjectPropertyTitle(group, t)}
        aria-label={t("externalobjectrows.general.objectaria", {
          provider: providerLabel,
          type: typeLabel,
          status: statusLabel,
          title: pill.displayTitle ?? value,
        })}
      >
        {content}
      </a>
    );
  }

  return (
    <span
      data-mention-kind="external-object"
      data-external-status={pill.statusCategory}
      data-external-liveness={pill.liveness}
      className={className}
      title={externalObjectPropertyTitle(group, t)}
      aria-label={t("externalobjectrows.general.objectaria", {
        provider: providerLabel,
        type: typeLabel,
        status: statusLabel,
        title: pill.displayTitle ?? value,
      })}
    >
      {content}
    </span>
  );
}

export function ExternalObjectRows({
  externalObjects,
  externalObjectsLoading,
  externalObjectsError,
  onRetryExternalObjects,
}: {
  externalObjects?: IssueExternalObjectGroup[];
  externalObjectsLoading?: boolean;
  externalObjectsError?: boolean;
  onRetryExternalObjects?: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [externalObjects]);

  if (externalObjectsError) {
    return (
      <PropertyRow label={t("externalobjectrows.general.externalobjects")}>
        <span className="text-xs text-muted-foreground">
          {t("externalobjectrows.general.couldntloadexternalobjects")}          {onRetryExternalObjects ? (
            <>
              {" "}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={onRetryExternalObjects}
              >
                {t("externalobjectrows.general.retry")}</button>
            </>
          ) : null}
        </span>
      </PropertyRow>
    );
  }

  if (externalObjectsLoading) {
    return (
      <PropertyRow label={t("externalobjectrows.general.externalobjects1")}>
        <span className="h-4 w-24 animate-pulse rounded bg-muted/40" />
      </PropertyRow>
    );
  }

  if (!externalObjects || externalObjects.length === 0) return null;

  const sortedExternalObjects = sortExternalObjectGroups(externalObjects);
  const visibleExternalObjects = expanded
    ? sortedExternalObjects
    : sortedExternalObjects.slice(0, EXTERNAL_OBJECT_PROPERTY_PREVIEW_COUNT);
  const hiddenExternalObjectCount = sortedExternalObjects.length - visibleExternalObjects.length;

  return (
    <>
      {visibleExternalObjects
        .map((externalObject) => {
          const { pill, group } = externalObject;
          return (
            <PropertyRow
              key={group.object?.id ?? `${pill.providerKey}:${pill.objectType}:${pill.url ?? "anon"}`}
              label={externalObjectRowLabel(externalObject, t)}
            >
              <ExternalObjectPropertyValue group={externalObject} />
            </PropertyRow>
          );
        })}
      {expanded || hiddenExternalObjectCount > 0 ? (
        <PropertyRow label={t("externalobjectrows.general.references")}>
          <ExpandRelationListButton
            hiddenCount={hiddenExternalObjectCount}
            expanded={expanded}
            onClick={() => setExpanded((next) => !next)}
          />
        </PropertyRow>
      ) : null}
    </>
  );
}
