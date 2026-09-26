import { describe, expect, it } from "vitest";
import {
  EXPLICIT_LOCALE_HEADER,
  normalizeLocaleTag,
  resolveLocaleFromAcceptLanguage,
  resolveRequestLocale,
} from "./locale.js";

describe("normalizeLocaleTag", () => {
  it("maps the Simplified Chinese family to zh-CN", () => {
    for (const tag of ["zh", "zh-CN", "zh-cn", "ZH-HANS", "zh-Hans-CN", "zh-SG", "zh-MY", "cmn-Hans"]) {
      expect(normalizeLocaleTag(tag)).toBe("zh-CN");
    }
  });

  it("maps English variants to en", () => {
    for (const tag of ["en", "EN", "en-US", "en-GB"]) {
      expect(normalizeLocaleTag(tag)).toBe("en");
    }
  });

  it("rejects unsupported and Traditional Chinese tags (no catalog)", () => {
    for (const tag of ["zh-TW", "zh-Hant", "zh-HK", "fr", "de", "", "  ", "english"]) {
      expect(normalizeLocaleTag(tag)).toBeNull();
    }
  });
});

describe("resolveLocaleFromAcceptLanguage", () => {
  it("returns en when the header is absent", () => {
    expect(resolveLocaleFromAcceptLanguage(undefined)).toBe("en");
    expect(resolveLocaleFromAcceptLanguage("")).toBe("en");
  });

  it("picks the highest-quality supported tag", () => {
    expect(resolveLocaleFromAcceptLanguage("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh-CN");
    expect(resolveLocaleFromAcceptLanguage("en;q=0.9,zh;q=0.8")).toBe("en");
    expect(resolveLocaleFromAcceptLanguage("fr;q=1,zh;q=0.5,en;q=0.1")).toBe("zh-CN");
  });

  it("defaults a bare tag to q=1 so it beats lower weights", () => {
    expect(resolveLocaleFromAcceptLanguage("zh,en;q=0.9")).toBe("zh-CN");
  });

  it("ignores malformed entries, wildcards, and zero weights", () => {
    expect(resolveLocaleFromAcceptLanguage("*, fr, ;q=1, zh;q=0, garbage;q=abc")).toBe("en");
  });

  it("falls back to English when nothing supported remains", () => {
    expect(resolveLocaleFromAcceptLanguage("fr-CA,de;q=0.9")).toBe("en");
    expect(resolveLocaleFromAcceptLanguage("zh-TW")).toBe("en");
  });

  it("survives a garbage header", () => {
    expect(resolveLocaleFromAcceptLanguage(",,;;,;q=")).toBe("en");
  });
});

describe("resolveRequestLocale", () => {
  it("uses no headers → en (the historical default path)", () => {
    expect(resolveRequestLocale({})).toBe("en");
  });

  it("reads Accept-Language", () => {
    expect(
      resolveRequestLocale({ "accept-language": "zh-CN,zh;q=0.9,en;q=0.8" }),
    ).toBe("zh-CN");
  });

  it("lets the explicit header override Accept-Language", () => {
    expect(
      resolveRequestLocale({
        [EXPLICIT_LOCALE_HEADER]: "zh-CN",
        "accept-language": "en;q=1,fr;q=0.9",
      }),
    ).toBe("zh-CN");
    expect(
      resolveRequestLocale({
        [EXPLICIT_LOCALE_HEADER]: "en",
        "accept-language": "zh-CN",
      }),
    ).toBe("en");
  });

  it("falls through to Accept-Language when the explicit header is unsupported", () => {
    expect(
      resolveRequestLocale({
        [EXPLICIT_LOCALE_HEADER]: "fr",
        "accept-language": "zh-CN,zh;q=0.9",
      }),
    ).toBe("zh-CN");
  });

  it("accepts array-valued headers (repeated header lines)", () => {
    expect(resolveRequestLocale({ "accept-language": ["zh-CN", "en"] })).toBe("zh-CN");
  });

  it("resolves en when only the explicit header is present and unsupported", () => {
    expect(resolveRequestLocale({ [EXPLICIT_LOCALE_HEADER]: "de" })).toBe("en");
  });
});
