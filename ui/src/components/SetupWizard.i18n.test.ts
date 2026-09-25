// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";

const keys = [
  "setupwizard.general.chooseagent",
  "setupwizard.general.connectprovider",
  "setupwizard.general.tryit",
  "setupwizard.general.connectionsetupprogress",
  "setupwizard.general.setupprogress",
  "setupwizard.general.saveampexit",
] as const;

describe("SetupWizard shared i18n wiring", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("defines every shared wizard key in English and Chinese", async () => {
    for (const lng of ["en", "zh-CN"]) {
      await i18n.changeLanguage(lng);
      for (const key of keys) expect(i18n.exists(key), `${lng} is missing ${key}`).toBe(true);
    }
  });

  it("keeps English defaults for the footer and screen-reader labels", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("setupwizard.general.saveampexit")).toBe("Save & exit");
    expect(i18n.t("setupwizard.general.setupprogress")).toBe("Setup progress");
    expect(i18n.t("setupwizard.general.connectionsetupprogress")).toBe("Connection setup progress");
    expect(i18n.t("setupwizard.general.chooseagent")).toBe("Choose agent");
    expect(i18n.t("setupwizard.general.connectprovider")).toBe("Connect provider");
    expect(i18n.t("setupwizard.general.tryit")).toBe("Try it");
  });

  it("shows the Chinese footer button and navigation defaults", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("setupwizard.general.saveampexit")).toBe("保存并退出");
    expect(i18n.t("setupwizard.general.setupprogress")).toBe("设置进度");
    expect(i18n.t("setupwizard.general.connectionsetupprogress")).toBe("连接设置进度");
    expect(i18n.t("setupwizard.general.chooseagent")).toBe("选择智能体");
    expect(i18n.t("setupwizard.general.connectprovider")).toBe("连接提供商");
    expect(i18n.t("setupwizard.general.tryit")).toBe("试用");
  });
});
