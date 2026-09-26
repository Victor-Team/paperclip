import { ApiError } from "@/api/client";
import { i18n, t } from "@/i18n";

/** Server `error` fields are already localized by X-Paperclip-Locale. */
export function localizedError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    return t("tok225.networkFailed");
  }
  if (error instanceof Error && (i18n.language !== "zh-CN" || /[\u3400-\u9fff]/u.test(error.message))) {
    return error.message;
  }
  return fallback;
}
