import { t } from "../i18n";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

// Uses the module-level `t` (not the `useTranslation` hook) because this
// function is called from 30+ files outside component bodies; see
// `ui/src/i18n/index.ts`. Language switches still render correctly because
// callers live inside components that already re-render on `languageChanged`.
export function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.round((now - then) / 1000);

  if (seconds < MINUTE) return t("common.timeago.justNow");
  if (seconds < HOUR) {
    const m = Math.floor(seconds / MINUTE);
    return t("common.timeago.minutes", { count: m });
  }
  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    return t("common.timeago.hours", { count: h });
  }
  if (seconds < WEEK) {
    const d = Math.floor(seconds / DAY);
    return t("common.timeago.days", { count: d });
  }
  if (seconds < MONTH) {
    const w = Math.floor(seconds / WEEK);
    return t("common.timeago.weeks", { count: w });
  }
  const mo = Math.floor(seconds / MONTH);
  return t("common.timeago.months", { count: mo });
}
