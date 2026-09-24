import type { StatusCardRefreshPolicy, StatusCardUpdate } from "@paperclipai/shared";
import { formatDateTime, relativeTime } from "@/lib/utils";

/** "1.1k tok" / "940 tok" — compact token count for footers and chips. */
export function formatTokens(tokens: number | null | undefined, locale = "en"): string | null {
  if (tokens === null || tokens === undefined) return null;
  const unit = locale === "zh-CN" ? " 词元" : " tok";
  if (tokens < 1000) return `${tokens}${unit}`;
  return `${(tokens / 1000).toFixed(1)}k${unit}`;
}

/**
 * Dollar cost from integer cents. Uses more precision for sub-cent amounts so a
 * $0.006 incremental update does not collapse to $0.01.
 */
export function formatCents(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null;
  const dollars = cents / 100;
  if (dollars === 0) return "$0.00";
  if (dollars < 0.1) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(2)}`;
}

export interface StatusCardRollup {
  updateCount: number;
  totalTokens: number;
  totalCostCents: number;
}

// `compile` rows are cheap query (re)compiles, not summary updates. They still
// cost tokens (so they count toward token/cost totals), but they must not be
// counted as "updates" in the ledger's update count.
function accumulate(updates: StatusCardUpdate[]): StatusCardRollup {
  return updates.reduce(
    (acc, update) => ({
      updateCount: acc.updateCount + (update.kind === "compile" ? 0 : 1),
      totalTokens: acc.totalTokens + update.inputTokens + update.outputTokens,
      totalCostCents: acc.totalCostCents + update.costCents,
    }),
    { updateCount: 0, totalTokens: 0, totalCostCents: 0 },
  );
}

/**
 * Lifetime rollup across the whole update ledger — used for the archived-row
 * "lifetime" cost label.
 */
export function rollupUpdates(updates: StatusCardUpdate[]): StatusCardRollup {
  return accumulate(updates);
}

/**
 * Today-scoped rollup — only updates started since the start of the UTC
 * calendar day, matching the server-side daily token cap boundary.
 */
export function rollupUpdatesToday(updates: StatusCardUpdate[], now = new Date()): StatusCardRollup {
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();
  return accumulate(updates.filter((update) => new Date(update.startedAt).getTime() >= startMs));
}

// Rough per-update estimates for the create/settings cost preview. These anchor
// on observed ledger data (a full rebuild ≈ 4.5k tokens ≈ 3¢; an incremental
// re-reads only the changed issues and runs cheaper). The preview is an
// upper-bound guide only — real cost is recorded per update in the ledger.
const EST_FULL_TOKENS = 4_500;
const EST_FULL_CENTS = 3;
const EST_INCREMENTAL_TOKENS = 2_000;
const EST_INCREMENTAL_CENTS = 1;

/** Minutes per day the card may auto-update, honouring the active-hours window. */
function activeWindowMinutes(policy: StatusCardRefreshPolicy): number {
  const hours = policy.activeHours;
  if (!hours) return 24 * 60;
  const [startH, startM] = hours.start.split(":").map(Number);
  const [endH, endM] = hours.end.split(":").map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  const span = end > start ? end - start : 24 * 60 - (start - end);
  return span > 0 ? span : 24 * 60;
}

export interface StatusCardCostEstimate {
  /** Bare cost, e.g. "$0.48 · 96.0k tok" — shown to the right of the "=" sign. */
  cost: string;
  /** Headline cost line, e.g. "Up to ~48 updates/day ≈ $0.48 · 96.0k tok". */
  primary: string;
  /** Secondary qualifier (cap / no-op-check / manual-only), or null. */
  note: string | null;
}

/**
 * Derive a per-day / per-update token + cost preview from the chosen refresh
 * policy. Reacts to mode (manual / interval / reactive), interval, active
 * hours, and the daily token cap.
 */
export function estimateStatusCardCost(policy: StatusCardRefreshPolicy, t?: StatusCardTranslate, locale = "en"): StatusCardCostEstimate {
  if (policy.mode === "manual") {
    const cost = `${formatCents(EST_FULL_CENTS)} · ${formatTokens(EST_FULL_TOKENS, locale)}`;
    return {
      cost,
      primary: t ? t("statuscards.common.rebuildperrefresh", { cost }) : `~1 rebuild per refresh ≈ ${cost}`,
      note: t ? t("statuscards.common.manualcostnote") : "Manual cards only cost tokens when you press Refresh.",
    };
  }

  const windowMinutes = activeWindowMinutes(policy);
  let maxPerDay: number;
  let cadence: string;
  if (policy.mode === "interval") {
    const interval = policy.intervalMinutes ?? 15;
    maxPerDay = Math.floor(windowMinutes / interval);
    cadence = `every ${interval} min`;
  } else {
    const perHour = policy.maxUpdatesPerHour ?? 6;
    maxPerDay = Math.round((windowMinutes / 60) * perHour);
    cadence = `up to ${perHour}/hour`;
  }

  const cap = policy.dailyTokenCap ?? null;
  const maxByCap = cap !== null ? Math.floor(cap / EST_INCREMENTAL_TOKENS) : Infinity;
  const effective = Math.max(0, Math.min(maxPerDay, maxByCap));
  const cappedByTokenCap = cap !== null && maxByCap < maxPerDay;

  const tokens = effective * EST_INCREMENTAL_TOKENS;
  const cents = effective * EST_INCREMENTAL_CENTS;
  const withinHours = policy.activeHours ? " during active hours" : "";
  const cost = `${formatCents(cents)} · ${formatTokens(tokens, locale)}`;

  return {
    cost,
    primary: t ? t("statuscards.common.updatesperday", { count: effective, cadence: policy.mode === "interval" ? t("statuscards.common.everyminutes", { count: policy.intervalMinutes ?? 15 }) : t("statuscards.common.uptoperhour", { count: policy.maxUpdatesPerHour ?? 6 }), hours: policy.activeHours ? t("statuscards.common.duringactivehours") : "", cost }) : `Up to ~${effective} updates/day (${cadence}${withinHours}) ≈ ${cost}`,
    note: cappedByTokenCap
      ? (t ? t("statuscards.common.cappedbytokens", { tokens: formatTokens(cap!, locale) ?? "" }) : `Capped by your ${formatTokens(cap!, locale)} daily token cap — the card pauses when it's hit.`)
      : (t ? t("statuscards.common.onlyonchange") : "Only runs when something changed; a cheap no-op check otherwise."),
  };
}

/** "0.4k in / 0.2k out" — the per-update token split shown in history rows. */
export function formatTokenSplit(inputTokens: number, outputTokens: number, t?: StatusCardTranslate): string {
  const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);
  return t ? t("statuscards.common.tokensplit", { input: fmt(inputTokens), output: fmt(outputTokens) }) : `${fmt(inputTokens)} in / ${fmt(outputTokens)} out`;
}

/** Human label for an update's kind. */
export function updateKindLabel(kind: StatusCardUpdate["kind"]): string {
  switch (kind) {
    case "compile":
      return "compile";
    case "full":
      return "full rebuild";
    case "incremental":
      return "incremental";
    default:
      return kind;
  }
}

/** Labels local to Status Cards; the shared state helpers retain their English API. */
export type StatusCardTranslate = (key: string, options?: Record<string, string | number>) => string;

export function statusCardRelativeTime(date: Date | string, locale: string): string {
  if (locale !== "zh-CN") return relativeTime(date);
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "刚刚";
  const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto", style: "short" });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return formatter.format(-days, "day");
  return new Date(date).toLocaleDateString("zh-CN", { month: "short", day: "numeric", year: "numeric" });
}

export function statusCardDateTime(date: Date | string, locale: string): string {
  if (locale !== "zh-CN") return formatDateTime(date);
  return new Date(date).toLocaleString("zh-CN", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function statusCardPolicyLabel(policy: StatusCardRefreshPolicy, t: StatusCardTranslate): string {
  if (policy.mode === "interval") {
    return policy.intervalMinutes
      ? t("statuscards.common.everyminutesifchanged", { count: policy.intervalMinutes })
      : t("statuscards.common.scheduleifchanged");
  }
  if (policy.mode === "reactive") {
    return t("statuscards.common.onchange", { seconds: policy.debounceSeconds ?? 60 });
  }
  return t("statuscards.common.manual");
}
