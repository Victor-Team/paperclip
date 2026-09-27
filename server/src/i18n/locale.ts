/**
 * Server-side UI locale resolution (TOK-224).
 *
 * The server emits user-visible strings (HTTP `error` messages). The web UI
 * renders those strings verbatim in toasts and error banners, so they must be
 * localizable by language. The request's language is resolved here:
 *
 *   1. `X-Paperclip-Locale` header — explicit override, sent by the UI's
 *      language switcher (frontend integration contract; see
 *      交付/TOK-224/后端交付.md). Wins when it maps to a supported locale.
 *   2. `Accept-Language` header — standard browser negotiation, parsed with
 *      q-values. Browsers send this automatically; Node/CLI HTTP clients do
 *      not, so machine callers keep the English default.
 *   3. `"en"` — the default and the historical behavior. Any locale that has
 *      no message catalog resolves to `"en"`, which leaves responses byte-for-byte
 *      unchanged.
 */

export const DEFAULT_UI_LOCALE = "en" as const;
/** Locales the server can translate messages for. Others fall back to English. */
export type UiLocale = "en" | "zh-CN";

/**
 * Simplified-Chinese (zh-Hans) family. All of these render with the zh-CN
 * catalog. Traditional-Chinese tags (zh-TW, zh-HK, zh-Hant, …) are
 * deliberately NOT included: this task ships a Simplified Chinese catalog
 * only, and those users fall back to English rather than receiving the wrong
 * Chinese variant.
 */
const ZH_HANS_TAGS: Record<string, true> = {
  zh: true,
  "zh-cn": true,
  "zh-hans": true,
  "zh-hans-cn": true,
  "zh-sg": true,
  "zh-my": true,
  cmn: true,
  "cmn-cn": true,
  "cmn-hans": true,
};

export const EXPLICIT_LOCALE_HEADER = "x-paperclip-locale";
const ACCEPT_LANGUAGE_HEADER = "accept-language";


/** Map one language tag to a supported locale, or null when unsupported. */
export function normalizeLocaleTag(tag: string): UiLocale | null {
  const lower = tag.trim().toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (ZH_HANS_TAGS[lower] === true) return "zh-CN";
  return null;
}

/**
 * Pick the best supported locale from an `Accept-Language` header value.
 * Handles q-weights ("zh-CN,zh;q=0.9,en;q=0.8") and tolerates malformed
 * entries by skipping them. Unsupported or zero-weighted tags never win.
 */
export function resolveLocaleFromAcceptLanguage(
  header: string | undefined,
  fallback: UiLocale = DEFAULT_UI_LOCALE,
): UiLocale {
  if (!header) return fallback;
  let best: { locale: UiLocale; q: number } | null = null;
  for (const part of header.split(",")) {
    const segments = part.trim().split(";");
    const tag = (segments[0] ?? "").trim();
    if (!tag || tag === "*") continue;
    let q = 1;
    for (const param of segments.slice(1)) {
      const match = /^\s*q\s*=\s*([0-9]*\.?[0-9]+)\s*$/i.exec(param);
      if (!match) continue;
      const parsed = Number.parseFloat(match[1]);
      if (!Number.isNaN(parsed) && parsed >= 0) q = Math.min(parsed, 1);
    }
    if (q <= 0) continue;
    const locale = normalizeLocaleTag(tag);
    if (!locale) continue;
    if (!best || q > best.q) best = { locale, q };
  }
  return best ? best.locale : fallback;
}

type HeaderValue = string | string[] | undefined;

function readHeader(
  headers: Record<string, HeaderValue>,
  name: string,
): string | undefined {
  const value = headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return undefined;
}

/**
 * Resolve the locale for one request. `headers` is a plain object of
 * lower-cased header names, exactly the shape Express provides
 * (`req.headers`).
 */
export function resolveRequestLocale(
  headers: Record<string, HeaderValue>,
): UiLocale {
  const explicit = readHeader(headers, EXPLICIT_LOCALE_HEADER);
  if (explicit) {
    const normalized = normalizeLocaleTag(explicit);
    // An explicit but unsupported header (e.g. a UI locale with no catalog)
    // falls through to browser negotiation instead of forcing English.
    if (normalized) return normalized;
  }
  return resolveLocaleFromAcceptLanguage(
    readHeader(headers, ACCEPT_LANGUAGE_HEADER),
  );
}
