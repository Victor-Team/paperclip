import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { i18n, LOCALE_STORAGE_KEY, selectableLocales } from "@/i18n";

interface LocaleContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  locales: typeof selectableLocales;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function applyDocumentLanguage(locale: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(() => i18n.language);

  // i18next is the source of truth: it already started in the language chosen
  // by `?lng=` / the saved preference, and `setLocale` below changes it.
  useEffect(() => {
    const handleChange = (next: string) => setLocaleState(next);
    i18n.on("languageChanged", handleChange);
    setLocaleState(i18n.language);
    return () => i18n.off("languageChanged", handleChange);
  }, []);

  useEffect(() => {
    applyDocumentLanguage(locale);
  }, [locale]);

  const setLocale = useCallback((next: string) => {
    if (!selectableLocales.some((option) => option.code === next)) return;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
    void i18n.changeLanguage(next);
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, locales: selectableLocales }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
