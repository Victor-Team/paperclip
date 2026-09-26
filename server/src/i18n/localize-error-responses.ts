import type { Request, Response, NextFunction, RequestHandler } from "express";
import { DEFAULT_UI_LOCALE, resolveRequestLocale, type UiLocale } from "./locale.js";
import { localizeServerMessage } from "./translate.js";

/**
 * Localize the `error` field of outgoing JSON error responses (TOK-224 / TOK-226).
 *
 * Why wrap `res.json` instead of editing call sites: the server produces
 * `error` strings from ~3.4k `HttpError` helper calls AND ~450 direct
 * `res.status(...).json({ error: ... })` writes, all of which converge on
 * `res.json`. One wrapper at the top of the stack localizes every path —
 * the error handler (including malformed-JSON and crash fallbacks), every
 * route, and the /api 404 fallthrough — without touching business code.
 *
 * Behavior contract:
 *   - Only the top-level `error` string is rewritten for display. `code`,
 *     `reason`, `details`, `remediation`, and every nested/success payload
 *     are untouched (machine-consumed or lib-generated).
 *   - Catalog / template hits become precise Chinese. Uncatalogued English
 *     prose becomes a status-class Chinese sentence so it cannot render as
 *     English in the UI; the original is preserved on `errorOriginal`.
 *   - Technical identifiers and data payloads (paths, URLs, JSON) pass
 *     through verbatim — they are not user-facing copy.
 *   - Requests that resolve to `"en"` (no headers, CLI/agent callers,
 *     unsupported locales) keep byte-for-byte identical responses.
 *   - Crash reporting and error-context logging keep the original English
 *     message: they never pass through this wrapper.
 *   - A failure inside the wrapper must never break the response; it falls
 *     back to the original body.
 */
export function localizeErrorResponses(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    let locale: UiLocale;
    try {
      locale = resolveRequestLocale(
        req.headers as Record<string, string | string[] | undefined>,
      );
    } catch {
      locale = DEFAULT_UI_LOCALE;
    }
    if (locale === DEFAULT_UI_LOCALE) {
      next();
      return;
    }
    const originalJson = res.json.bind(res);
    const localizedJson = (body?: unknown) => {
      let payload = body;
      try {
        if (
          payload !== null &&
          typeof payload === "object" &&
          !Array.isArray(payload) &&
          typeof (payload as { error?: unknown }).error === "string"
        ) {
          const original = (payload as { error: string }).error;
          const localized = localizeServerMessage(
            original,
            locale,
            res.statusCode,
          );
          if (localized.text !== original) {
            const nextBody: Record<string, unknown> = {
              ...(payload as object),
              error: localized.text,
            };
            if (localized.usedFallback && !("errorOriginal" in (payload as object))) {
              nextBody.errorOriginal = original;
            }
            payload = nextBody;
          }
        }
      } catch {
        payload = body;
      }
      return originalJson(payload);
    };
    (res as unknown as { json: (body?: unknown) => Response }).json = localizedJson;
    next();
  };
}
