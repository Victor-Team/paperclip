import { DEFAULT_UI_LOCALE, type UiLocale } from "./locale.js";
import { ZH_CN_EXACT, ZH_CN_TEMPLATES } from "./zh-cn-messages.js";

/**
 * Result of localizing one server-emitted message.
 *
 * - `text` is what the client should display.
 * - `usedFallback` is true when `text` is a generic status-class message that
 *   no longer carries the specifics of the original English. Callers should
 *   preserve the original string on a side channel (the HTTP layer uses the
 *   `errorOriginal` sibling field) so troubleshooting information survives.
 */
export interface LocalizedMessage {
  text: string;
  usedFallback: boolean;
}

/**
 * Identifier-shaped tokens that stay verbatim, including on zh-CN requests.
 *
 * Requires at least one separator so a single English word (`forbidden`) is
 * not mistaken for a machine code. Covers snake/kebab/colon keys
 * (`dev_server_supervisor_unavailable`, `tools:manage_connections`),
 * ALL_CAPS codes (`ECONNREFUSED`), and UUIDs.
 */
const IDENTIFIER_TOKEN_RE = /^[a-z0-9]+([_.:-][a-z0-9]+)+$/;
const ALL_CAPS_CODE_RE = /^[A-Z][A-Z0-9_]{1,}$/;
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * English prose detector for the fallback: at least two consecutive ASCII
 * letters. Messages without them (numbers, CJK data, symbols) are data, not
 * untranslated copy, and pass through untouched.
 */
const ASCII_PROSE_RE = /[a-zA-Z]{2,}/;

/**
 * Generic zh-CN message for an HTTP status class. Used only when a message
 * is English prose that has no catalog entry — the catalog is the quality
 * path; this is the guarantee that a Simplified-Chinese request never
 * renders uncatalogued English server copy in the UI `error` field.
 */
const ZH_CN_STATUS_FALLBACK: Record<number, string> = {
  400: "请求无效",
  401: "未授权",
  403: "禁止访问",
  404: "未找到",
  408: "请求超时",
  409: "请求冲突",
  410: "资源已不存在",
  412: "前提条件失败",
  413: "请求体过大",
  415: "不支持的媒体类型",
  416: "请求的范围无法满足",
  422: "请求无法处理",
  429: "请求过于频繁",
  500: "服务器内部错误",
  501: "服务器不支持此功能",
  502: "网关错误",
  503: "服务不可用",
  504: "网关超时",
};

const ZH_CN_DEFAULT_FALLBACK = "请求失败";

function zhStatusFallback(status: number | undefined): string {
  if (status === undefined) return ZH_CN_DEFAULT_FALLBACK;
  const exact = ZH_CN_STATUS_FALLBACK[status];
  if (exact) return exact;
  if (status >= 500) return "服务器内部错误";
  if (status >= 400) return ZH_CN_DEFAULT_FALLBACK;
  return ZH_CN_DEFAULT_FALLBACK;
}

function isTechnicalToken(message: string): boolean {
  return (
    IDENTIFIER_TOKEN_RE.test(message) ||
    ALL_CAPS_CODE_RE.test(message) ||
    UUID_RE.test(message)
  );
}

/**
 * Whole-message data payloads: file paths, URLs, JSON. These are values, not
 * server copy, so they stay verbatim even on zh-CN requests.
 */
function isDataPayload(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../")
  ) {
    return true;
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return true;
  return false;
}

/**
 * Translate one server-emitted user-visible message for `locale`.
 *
 * Lookup order:
 *   1. exact catalog entry        — known fixed copy, translated precisely
 *   2. anchored frame template    — known copy with interpolated data, frame
 *                                   translated, data preserved verbatim
 *   3. technical token            — machine codes / identifiers pass through
 *   4. data payload               — paths, URLs, JSON pass through
 *   5. non-English / non-prose    — passes through (nothing to translate)
 *   6. generic status fallback    — uncatalogued English prose becomes a
 *                                   status-class Chinese message; the caller
 *                                   retains the original via `usedFallback`
 *
 * Requests that resolve to `"en"` (or any locale without a catalog) keep
 * byte-for-byte identical messages — the historical default path.
 */
export function localizeServerMessage(
  message: string,
  locale: UiLocale,
  status?: number,
): LocalizedMessage {
  if (!message) return { text: message, usedFallback: false };
  if (locale === DEFAULT_UI_LOCALE) return { text: message, usedFallback: false };
  // Only zh-CN has a catalog today; any other resolved locale falls through.
  if (locale !== "zh-CN") return { text: message, usedFallback: false };

  const exact = ZH_CN_EXACT[message];
  if (typeof exact === "string") return { text: exact, usedFallback: false };
  for (const template of ZH_CN_TEMPLATES) {
    const match = template.pattern.exec(message);
    if (match) return { text: template.translate(match), usedFallback: false };
  }
  if (isTechnicalToken(message) || isDataPayload(message)) {
    return { text: message, usedFallback: false };
  }
  if (!ASCII_PROSE_RE.test(message)) return { text: message, usedFallback: false };
  return { text: zhStatusFallback(status), usedFallback: true };
}

/**
 * Backwards-compatible string API: the translated text alone. The HTTP layer
 * uses `localizeServerMessage` directly so it can also attach `errorOriginal`.
 */
export function translateServerMessage(
  message: string,
  locale: UiLocale,
  status?: number,
): string {
  return localizeServerMessage(message, locale, status).text;
}
