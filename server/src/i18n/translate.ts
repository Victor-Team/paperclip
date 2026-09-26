import { DEFAULT_UI_LOCALE, type UiLocale } from "./locale.js";
import { ZH_CN_EXACT, ZH_CN_TEMPLATES } from "./zh-cn-messages.js";

/**
 * Translate one server-emitted user-visible message for `locale`.
 *
 * Lookup order: exact catalog entry → anchored frame template → return the
 * original English. The English passthrough is the historical default path —
 * any message without a catalog entry is returned byte-for-byte, so the
 * wire format for untranslated strings never changes.
 */
export function translateServerMessage(
  message: string,
  locale: UiLocale,
): string {
  if (!message) return message;
  if (locale === DEFAULT_UI_LOCALE) return message;
  // Only zh-CN has a catalog today; any other resolved locale falls through.
  if (locale !== "zh-CN") return message;
  const exact = ZH_CN_EXACT[message];
  if (typeof exact === "string") return exact;
  for (const template of ZH_CN_TEMPLATES) {
    const match = template.pattern.exec(message);
    if (match) return template.translate(match);
  }
  return message;
}
