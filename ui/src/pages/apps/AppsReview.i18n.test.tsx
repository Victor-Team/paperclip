import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";

const appsReview = readFileSync(
  resolve(process.cwd(), "ui/src/pages/apps/AppsReview.tsx"),
  "utf8",
);
const unverifiedServerBadge = readFileSync(
  resolve(process.cwd(), "ui/src/pages/apps/UnverifiedServerBadge.tsx"),
  "utf8",
);

describe("apps review i18n wiring", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("resolves the approval page and unverified-server copy in Chinese", async () => {
    await i18n.changeLanguage("zh-CN");

    expect(i18n.t("appsreview.general.review")).toBe("审查");
    expect(i18n.t("appsreview.general.waitingforyourok")).toBe("等待您的确认");
    expect(i18n.t("appsreview.general.selectanorganizationtoreviewapprovals")).toBe(
      "请选择组织以查看审批。",
    );
    expect(i18n.t("unverifiedserverbadge.general.unverifiedserver")).toBe(
      "未验证服务器",
    );
  });

  it("looks up visible copy at render time", () => {
    expect(appsReview).toContain('useTranslation');
    expect(appsReview).toContain('t("appsreview.general.review")');
    expect(unverifiedServerBadge).toContain('t("unverifiedserverbadge.general.unverifiedserver")');
  });
});
