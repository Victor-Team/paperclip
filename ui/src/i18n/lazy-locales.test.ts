import { afterEach, describe, expect, it } from "vitest";
import { i18n } from ".";
import ja from "./locales/ja.json";
import zhCN from "./locales/zh-CN.json";
import { DEFAULT_LOCALE } from "./locales";

describe("lazy locale catalogs", () => {
  afterEach(async () => {
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  it("starts with only the default catalog in memory", () => {
    expect(i18n.hasResourceBundle(DEFAULT_LOCALE, "translation")).toBe(true);
    expect(i18n.hasResourceBundle("ja", "translation")).toBe(false);
  });

  it("loads a catalog when switching to its language, before the switch resolves", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.hasResourceBundle("zh-CN", "translation")).toBe(true);
    expect(i18n.t("app.noCompanies.title")).toBe(zhCN.app.noCompanies.title);

    await i18n.changeLanguage("ja");
    expect(i18n.getResourceBundle("ja", "translation")).toEqual(ja);
  });
});
