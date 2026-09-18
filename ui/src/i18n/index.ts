import i18n, { type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import { DEFAULT_LOCALE, i18nextResources, supportedLocales } from "./locales";

// Read-only this round: honors `?lng=` or a previously saved `paperclip.locale`
// so `/search?lng=zh-CN` can prove the pilot wiring. The language switcher UI
// that writes `paperclip.locale` lands in a later batch.
function initialLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const candidate =
    new URLSearchParams(window.location.search).get("lng")
    ?? window.localStorage.getItem("paperclip.locale");
  return candidate && supportedLocales.includes(candidate) ? candidate : DEFAULT_LOCALE;
}

const i18nextOptions: InitOptions = {
  resources: i18nextResources,
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

void i18n.use(initReactI18next).init(i18nextOptions).catch((error: unknown) => {
  console.error("Failed to initialize i18next", error);
});

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

export const useTranslation = useReactI18nextTranslation;
export { i18n };
