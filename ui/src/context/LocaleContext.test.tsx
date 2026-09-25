// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LanguageToggle } from "../components/LanguageToggle";
import { i18n, LOCALE_STORAGE_KEY, selectableLocales } from "../i18n";
import { DEFAULT_LOCALE, supportedLocales } from "../i18n/locales";
import { LocaleProvider, useLocale } from "./LocaleContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("LocaleContext", () => {
  let container: HTMLDivElement;
  let observedLocale: string | null = null;
  let setLocale: ((locale: string) => void) | null = null;

  function Probe() {
    const ctx = useLocale();
    observedLocale = ctx.locale;
    setLocale = ctx.setLocale;
    return null;
  }

  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage(DEFAULT_LOCALE);
    document.documentElement.lang = "en";
    observedLocale = null;
    setLocale = null;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    document.body.innerHTML = "";
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  it("only offers locales that exist as locale files", () => {
    expect(selectableLocales.map((option) => option.code)).toContain(DEFAULT_LOCALE);
    for (const option of selectableLocales) {
      expect(supportedLocales).toContain(option.code);
    }
  });

  it("switches i18next, the <html lang> attribute and the saved preference together", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <LocaleProvider>
          <Probe />
        </LocaleProvider>,
      );
    });
    expect(observedLocale).toBe("en");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();

    await act(async () => {
      setLocale?.("zh-CN");
    });
    expect(i18n.language).toBe("zh-CN");
    expect(observedLocale).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-CN");

    await act(async () => {
      setLocale?.("en");
    });
    expect(i18n.language).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");

    await act(async () => {
      root.unmount();
    });
  });

  it("ignores locales that are not offered, even if a locale file exists", async () => {
    const placeholderLocale = supportedLocales.find(
      (code) => !selectableLocales.some((option) => option.code === code),
    );
    expect(placeholderLocale).toBeDefined();

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <LocaleProvider>
          <Probe />
        </LocaleProvider>,
      );
    });
    await act(async () => {
      setLocale?.(placeholderLocale as string);
    });
    expect(i18n.language).toBe("en");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("LanguageToggle lists exactly the offered locales and changes language on select", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <LocaleProvider>
          <LanguageToggle variant="compact-menu-action" />
        </LocaleProvider>,
      );
    });

    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    expect(Array.from(select!.options).map((option) => option.value)).toEqual(
      selectableLocales.map((option) => option.code),
    );
    expect(select!.value).toBe("en");
    expect(select!.getAttribute("aria-label")).toBe("Language");

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      setValue.call(select, "zh-CN");
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(i18n.language).toBe("zh-CN");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-CN");
    expect(container.querySelector("select")!.getAttribute("aria-label")).toBe("语言");

    await act(async () => {
      root.unmount();
    });
  });
});
