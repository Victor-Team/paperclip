import { useMemo, useState } from "react";
import { Activity as ActivityIcon, Play, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { timeAgo } from "../../lib/timeAgo";
import { runRowSubtitle, dedupedTriggerLabel } from "../../lib/routine-run-display";
import { EmptyState } from "../EmptyState";
import { EntityRow } from "../EntityRow";
import { FilterBar, type FilterValue } from "../FilterBar";
import { LiveRunWidget } from "../LiveRunWidget";
import { RoutineHistoryTab } from "../RoutineHistoryTab";
import { RoutineActivityRow } from "../RoutineActivityRow";
import { useRoutineDetail } from "./context";
import { useTranslation } from "@/i18n";

const DATE_WINDOW_OPTIONS: { value: string; labelKey: string; ms: number | null }[] = [
  { value: "any", labelKey: "operatesections.general.anytime", ms: null },
  { value: "24h", labelKey: "operatesections.general.last24hours", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", labelKey: "operatesections.general.last7days", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", labelKey: "operatesections.general.last30days", ms: 30 * 24 * 60 * 60 * 1000 },
];

const ROUTINE_RUN_SOURCE_KEYS: Record<string, string> = {
  schedule: "operatesections.general.sourceSchedule",
  manual: "operatesections.general.sourceManual",
  api: "operatesections.general.sourceApi",
  webhook: "operatesections.general.sourceWebhook",
};

const ROUTINE_RUN_STATUS_KEYS: Record<string, string> = {
  received: "operatesections.general.statusReceived",
  coalesced: "operatesections.general.statusCoalesced",
  skipped: "operatesections.general.statusSkipped",
  issue_created: "operatesections.general.statusIssueCreated",
  completed: "operatesections.general.statusCompleted",
  failed: "operatesections.general.statusFailed",
};

export function RunsSection() {
  const { t } = useTranslation();
  const ctx = useRoutineDetail();
  const { routine, routineRuns, hasLiveRun, activeIssueId, onOpenRunDialog } = ctx;
  const runs = useMemo(() => routineRuns ?? [], [routineRuns]);

  const [sourceFilter, setSourceFilter] = useState("any");
  const [statusFilter, setStatusFilter] = useState("any");
  const [dateFilter, setDateFilter] = useState("any");

  const sourceOptions = useMemo(
    () => [...new Set(runs.map((run) => run.source))].sort(),
    [runs],
  );
  const statusOptions = useMemo(
    () => [...new Set(runs.map((run) => run.status))].sort(),
    [runs],
  );

  const filtered = useMemo(() => {
    const windowMs = DATE_WINDOW_OPTIONS.find((option) => option.value === dateFilter)?.ms ?? null;
    const cutoff = windowMs == null ? null : Date.now() - windowMs;
    return runs.filter((run) => {
      if (sourceFilter !== "any" && run.source !== sourceFilter) return false;
      if (statusFilter !== "any" && run.status !== statusFilter) return false;
      if (cutoff != null && new Date(run.triggeredAt).getTime() < cutoff) return false;
      return true;
    });
  }, [runs, sourceFilter, statusFilter, dateFilter]);

  const activeFilters = useMemo<FilterValue[]>(() => {
    const list: FilterValue[] = [];
    if (sourceFilter !== "any") {
      list.push({
        key: "source",
        label: t("operatesections.general.sourceFilterLabel"),
        value: t(ROUTINE_RUN_SOURCE_KEYS[sourceFilter] ?? sourceFilter),
      });
    }
    if (statusFilter !== "any") {
      list.push({
        key: "status",
        label: t("operatesections.general.statusFilterLabel"),
        value: t(ROUTINE_RUN_STATUS_KEYS[statusFilter] ?? statusFilter.replaceAll("_", " ")),
      });
    }
    if (dateFilter !== "any") {
      const labelKey = DATE_WINDOW_OPTIONS.find((option) => option.value === dateFilter)?.labelKey;
      list.push({ key: "date", label: t("operatesections.general.dateFilterLabel"), value: t(labelKey ?? dateFilter) });
    }
    return list;
  }, [dateFilter, sourceFilter, statusFilter, t]);

  function clearFilters() {
    setSourceFilter("any");
    setStatusFilter("any");
    setDateFilter("any");
  }

  function removeFilter(key: string) {
    if (key === "source") setSourceFilter("any");
    if (key === "status") setStatusFilter("any");
    if (key === "date") setDateFilter("any");
  }

  return (
    <div className="space-y-4">
      {hasLiveRun && activeIssueId ? (
        <LiveRunWidget issueId={activeIssueId} companyId={routine.companyId} />
      ) : null}

      {runs.length === 0 ? (
        <EmptyState
          icon={Play}
          message={t("operatesections.general.noRunsYetMessage")}
          action={t("operatesections.general.runNow")}
          onAction={onOpenRunDialog}
        />
      ) : (
        <>
          {/* Filter chips row (§3.6) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 text-xs" aria-label={t("operatesections.general.filterbysource")}>
                  <span className="text-muted-foreground">{t("operatesections.general.source")}</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("operatesections.general.any")}</SelectItem>
                  {sourceOptions.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 text-xs" aria-label={t("operatesections.general.filterbystatus")}>
                  <span className="text-muted-foreground">{t("operatesections.general.status")}</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("operatesections.general.any1")}</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 text-xs" aria-label={t("operatesections.general.filterbydate")}>
                  <span className="text-muted-foreground">{t("operatesections.general.date")}</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_WINDOW_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FilterBar filters={activeFilters} onRemove={removeFilter} onClear={clearFilters} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              message={t("operatesections.general.noRunsMatchFilters")}
              action={t("operatesections.general.clearFilters")}
              onAction={clearFilters}
            />
          ) : (
            <div className="rounded-lg border border-border">
              {filtered.map((run) => {
                const label = dedupedTriggerLabel(run.trigger);
                const title = run.linkedIssue?.title ?? label ?? t("operatesections.general.runFallback");
                return (
                  <EntityRow
                    key={run.id}
                    leading={
                      <>
                        <Badge variant="outline" className="shrink-0">
                          {t(ROUTINE_RUN_SOURCE_KEYS[run.source] ?? run.source)}
                        </Badge>
                        <Badge
                          variant={run.status === "failed" ? "destructive" : "secondary"}
                          className="shrink-0"
                        >
                          {t(ROUTINE_RUN_STATUS_KEYS[run.status] ?? run.status.replaceAll("_", " "))}
                        </Badge>
                      </>
                    }
                    identifier={
                      run.linkedIssue
                        ? run.linkedIssue.identifier ?? run.linkedIssue.id.slice(0, 8)
                        : undefined
                    }
                    title={title}
                    subtitle={runRowSubtitle(run, routine.variables, t)}
                    reserveSubtitleSpace
                    trailing={
                      <span className="text-xs text-muted-foreground">{timeAgo(run.triggeredAt)}</span>
                    }
                    to={
                      run.linkedIssue
                        ? `/issues/${run.linkedIssue.identifier ?? run.linkedIssue.id}`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ActivitySection() {
  const { t, i18n } = useTranslation();
  const ctx = useRoutineDetail();
  const { activity } = ctx;
  const events = activity ?? [];

  const groups = useMemo(() => {
    const byDay = new Map<string, typeof events>();
    for (const event of events) {
      let label = t("operatesections.general.earlier");
      try {
        label = new Date(event.createdAt).toLocaleDateString(i18n.language, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      } catch {
        /* keep fallback label */
      }
      const bucket = byDay.get(label) ?? [];
      bucket.push(event);
      byDay.set(label, bucket);
    }
    return Array.from(byDay.entries());
  }, [events, i18n.language, t]);

  if (events.length === 0) {
    return <EmptyState icon={ActivityIcon} message={t("operatesections.general.noActivityYet")} />;
  }

  return (
    <div className="space-y-4">
      {groups.map(([day, dayEvents]) => (
        <div key={day}>
          <div className="sticky top-0 bg-background py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {day}
          </div>
          <div>
            {dayEvents.map((event) => (
              <RoutineActivityRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HistorySection() {
  const ctx = useRoutineDetail();
  const {
    routine,
    isEditDirty,
    dirtyFields,
    routineDefaults,
    setEditDraft,
    saveRoutine,
    agentById,
    projectById,
    availableSecrets,
    onHistoryRestoreSecretMaterials,
    onHistoryRestored,
  } = ctx;

  return (
    <RoutineHistoryTab
      routine={routine}
      isEditDirty={isEditDirty}
      dirtyFields={dirtyFields}
      onDiscardEdits={() => setEditDraft(routineDefaults)}
      onSaveEdits={() => {
        if (!saveRoutine.isPending && routine.title.trim()) {
          saveRoutine.mutate();
        }
      }}
      agents={agentById}
      projects={projectById}
      secrets={availableSecrets}
      onRestoreSecretMaterials={onHistoryRestoreSecretMaterials}
      onRestored={onHistoryRestored}
    />
  );
}
