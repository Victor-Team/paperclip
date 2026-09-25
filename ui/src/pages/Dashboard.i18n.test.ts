import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";

const source = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
const usedKeys = [...new Set(source.match(/"dashboard\.general\.\w+"/g) ?? [])].map((key) => key.slice(1, -1));

describe("Dashboard i18n wiring", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("reads only keys that exist in both English and Chinese", async () => {
    expect(usedKeys.length).toBeGreaterThan(0);
    for (const lng of ["en", "zh-CN"]) {
      await i18n.changeLanguage(lng);
      for (const key of usedKeys) expect(i18n.exists(key), `${lng} is missing ${key}`).toBe(true);
    }
  });

  it("keeps the English wording of the states the browser evidence cannot reach", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("dashboard.general.importedAgentsPausedSingular", { count: 1 })).toBe(
      "1 imported agent is paused and will not run.",
    );
    expect(i18n.t("dashboard.general.importedAgentsPausedPlural", { count: 3 })).toBe(
      "3 imported agents are paused and will not run.",
    );
    expect(i18n.t("dashboard.general.activeBudgetIncidentPlural", { count: 2 })).toBe("2 active budget incidents");
    expect(
      i18n.t("dashboard.general.budgetIncidentSummary", { agents: 1, projects: 2, approvals: 3 }),
    ).toBe("1 agents paused · 2 projects paused · 3 pending budget approvals");
    expect(i18n.t("dashboard.general.budgetUtilization", { percent: 40, budget: "$10.00" })).toBe(
      "40% of $10.00 budget",
    );
    expect(i18n.t("dashboard.general.budgetOverridesAwaiting", { count: 2 })).toBe(
      "2 budget overrides awaiting board review",
    );
  });

  it("fills the interpolations in Chinese", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("dashboard.general.importedAgentsPausedPlural", { count: 3 })).toBe("3 个导入的智能体已暂停，不会运行。");
    expect(
      i18n.t("dashboard.general.budgetIncidentSummary", { agents: 1, projects: 2, approvals: 3 }),
    ).toBe("1 个智能体已暂停 · 2 个项目已暂停 · 3 个待处理预算审批");
    expect(i18n.t("dashboard.general.budgetUtilization", { percent: 40, budget: "$10.00" })).toBe(
      "已使用 $10.00 预算的 40%",
    );
    expect(i18n.t("dashboard.general.budgetOverridesAwaiting", { count: 2 })).toBe(
      "2 项预算超额审批等待董事会审查",
    );
  });
});
