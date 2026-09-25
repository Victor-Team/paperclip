import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { adapterLabels, help } from "./agent-config-primitives";

describe("agent-config-primitives i18n wiring", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("resolves help text live through the Proxy instead of a frozen import-time snapshot", async () => {
    await i18n.changeLanguage("en");
    expect(help.name).toBe("Display name for this agent.");
    expect(help.title).toBe("Job title shown in the org chart.");

    await i18n.changeLanguage("zh-CN");
    expect(help.name).toBe("该智能体在界面上显示的名称。");
    expect(help.title).toBe("组织架构图中显示的职位名称。");

    // Switching back must also flip back — proves this is not cached.
    await i18n.changeLanguage("en");
    expect(help.name).toBe("Display name for this agent.");
  });

  it("keeps a literal {{ }} template placeholder untouched by i18next interpolation", () => {
    // promptTemplate documents Paperclip's own {{ agent.id }} template syntax,
    // which collides with i18next's interpolation syntax. i18next leaves an
    // unmatched {{var}} as-is when no matching option is passed, so the
    // literal placeholder must survive verbatim in both languages.
    expect(help.promptTemplate).toContain("{{ agent.id }}");
  });

  it("resolves adapterLabels live so a language switch relabels an already-rendered dropdown", async () => {
    await i18n.changeLanguage("en");
    expect(adapterLabels.hermes_gateway).toBe("Hermes Gateway");

    await i18n.changeLanguage("zh-CN");
    expect(adapterLabels.hermes_gateway).toBe("Hermes 网关");
  });

  it("drops the unused ChoosePathButton keys after the dead export was removed", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.exists("agentconfigprimitives.general.choose")).toBe(false);
    expect(i18n.exists("agentconfigprimitives.general.specifyPathManually")).toBe(false);
    expect(i18n.exists("agentconfigprimitives.general.ok")).toBe(false);
  });
});
