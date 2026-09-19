import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";

const files = [
  "SidebarAccountMenu.tsx",
  "SidebarAccountMenu.production.tsx",
  "SidebarCompanyMenu.tsx",
  "SidebarCompanyMenu.production.tsx",
  "CompanySwitcher.tsx",
  "Layout.tsx",
  "Layout.production.tsx",
  "MobileBottomNav.tsx",
  "SidebarSection.tsx",
  "ThemeToggle.tsx",
  "BreadcrumbBar.tsx",
  "BreadcrumbBar.production.tsx",
  "SidebarShell.tsx",
  "SidebarShell.production.tsx",
];
const keyPattern = /"((?:sidebaraccountmenu|sidebarcompanymenu|companyswitcher|layout|mobilebottomnav|sidebarsection|themetoggle|breadcrumbbar|sidebarshell)\.general\.\w+)"/g;
const usedKeys = [
  ...new Set(
    files.flatMap((file) => {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      return [...source.matchAll(keyPattern)].map((match) => match[1]);
    }),
  ),
];

describe("Sidebar chrome i18n wiring", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("reads only keys that exist in both English and Chinese", async () => {
    expect(usedKeys.length).toBeGreaterThan(50);
    for (const lng of ["en", "zh-CN"]) {
      await i18n.changeLanguage(lng);
      for (const key of usedKeys) expect(i18n.exists(key), `${lng} is missing ${key}`).toBe(true);
    }
  });

  it("keeps the English wording the default interface shows", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("sidebaraccountmenu.general.signOut")).toBe("Sign out");
    expect(i18n.t("sidebarcompanymenu.general.openSwitcherNamed", { name: "ANC", noun: "organization" })).toBe(
      "Open ANC organization switcher",
    );
    expect(i18n.t("sidebarsection.general.collapseSection", { label: "Work" })).toBe("Collapse Work");
    expect(i18n.t("layout.general.archivedCompany", { name: "ANC" })).toBe("ANC is archived");
    expect(i18n.t("themetoggle.general.switchToDark")).toBe("Switch to dark mode");
    expect(i18n.t("breadcrumbbar.general.openSidebar")).toBe("Open sidebar");
    expect(i18n.t("sidebarshell.general.resizeSidebar")).toBe("Resize sidebar");
  });

  it("fills interpolated values in Chinese and uses 公司 for the tenant entity", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("sidebarcompanymenu.general.openSwitcherNamed", { name: "ANC", noun: i18n.t("sidebarcompanymenu.general.nounCompany") })).toBe(
      "打开 ANC 公司切换器",
    );
    expect(i18n.t("sidebarcompanymenu.general.organizations")).toBe("公司");
    expect(i18n.t("companyswitcher.general.manageOrganizations")).toBe("管理公司");
    expect(i18n.t("sidebarsection.general.collapseSection", { label: "工作" })).toBe("折叠工作");
    expect(i18n.t("layout.general.switchedTo", { name: "ANC" })).toBe("已切换到 ANC。");
    expect(i18n.t("themetoggle.general.switchToDark")).toBe("切换到深色模式");
    expect(i18n.t("themetoggle.general.switchToLight")).toBe("切换到浅色模式");
    expect(i18n.t("breadcrumbbar.general.openSidebar")).toBe("打开侧边栏");
    expect(i18n.t("sidebarshell.general.resizeSidebar")).toBe("调整侧边栏宽度");
  });
});
