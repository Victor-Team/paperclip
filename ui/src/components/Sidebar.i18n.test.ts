import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";

const files = ["Sidebar.tsx", "Sidebar.production.tsx", "SidebarNavItem.tsx", "SidebarNavItem.production.tsx"];
const usedKeys = [
  ...new Set(
    files.flatMap((file) => {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      return source.match(/"sidebar(?:navitem)?\.general\.\w+"/g) ?? [];
    }),
  ),
].map((key) => key.slice(1, -1));

describe("Sidebar i18n wiring", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("reads only keys that exist in both English and Chinese", async () => {
    expect(usedKeys.length).toBeGreaterThan(30);
    for (const lng of ["en", "zh-CN"]) {
      await i18n.changeLanguage(lng);
      for (const key of usedKeys) expect(i18n.exists(key), `${lng} is missing ${key}`).toBe(true);
    }
  });

  it("keeps the English wording that screen readers announce on the collapsed rail", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("sidebarnavitem.general.live", { liveCount: 3 })).toBe("3 live");
    expect(i18n.t("sidebarnavitem.general.attentionNeeded")).toBe("attention needed");
  });

  it("fills the live-run count in Chinese and separates the Org section from the /org link", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("sidebarnavitem.general.live", { liveCount: 3 })).toBe("3 运行中");
    expect(i18n.t("sidebar.general.sectionOrg")).toBe("公司");
    expect(i18n.t("sidebar.general.labelOrg")).toBe("组织");
  });
});
