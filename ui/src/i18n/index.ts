import i18n, { type BackendModule, type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import {
  DEFAULT_LOCALE,
  defaultLocaleMessages,
  loadLocaleMessages,
  supportedLocales,
} from "./locales";

// Startup language: `?lng=` (one-off, e.g. `/search?lng=zh-CN`) wins over the
// choice the user saved with the language switcher (`LocaleContext` writes
// LOCALE_STORAGE_KEY). Unknown codes fall back to DEFAULT_LOCALE.
export const LOCALE_STORAGE_KEY = "paperclip.locale";

// Locales that have real translations and are offered in the language
// switcher. `label` is the language's own name and is intentionally not
// translated. Add a row here once a locale file is translated; the other
// locale files are still English placeholders and must stay out of this list.
export const selectableLocales = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
] as const;

function initialLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const candidate =
    new URLSearchParams(window.location.search).get("lng")
    ?? window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return candidate && supportedLocales.includes(candidate) ? candidate : DEFAULT_LOCALE;
}

// Non-default catalogs are fetched on demand; `changeLanguage` resolves only
// after the target catalog has loaded, so callers never render a mixed page.
const lazyLocaleBackend: BackendModule = {
  type: "backend",
  init() {},
  read(language, _namespace, callback) {
    loadLocaleMessages(language).then(
      (messages) => callback(null, messages),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), false),
    );
  },
};

const i18nextOptions: InitOptions = {
  resources: { [DEFAULT_LOCALE]: { translation: defaultLocaleMessages } },
  partialBundledLanguages: true,
  load: "currentOnly",
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

/**
 * Resolves once the startup language's catalog is loaded. The app entry waits
 * on it before the first render so a saved non-English preference never
 * flashes English first.
 */
export const i18nReady: Promise<unknown> = i18n
  .use(lazyLocaleBackend)
  .use(initReactI18next)
  .init(i18nextOptions)
  .catch((error: unknown) => {
    console.error("Failed to initialize i18next", error);
  });

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

export const useTranslation = useReactI18nextTranslation;
export { i18n };
