import { renderToStaticMarkup } from "react-dom/server";
import { Trans } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("Telegram setup instructions", () => {
  it.each([
    ["en", "Open BotFather", "Choose an available username", "start or continue work"],
    ["zh-CN", "打开 BotFather", "选择一个", "开始或继续工作"],
  ])("keeps executable bot commands intact in %s", async (locale, first, second, group) => {
    await i18n.changeLanguage(locale);
    const render = (key: string) => renderToStaticMarkup(
      <Trans
        i18nKey={key}
        values={{ requestPlaceholder: "<request>" }}
        components={{ code: <code /> }}
      />,
    );
    const instructions = [
      render("chatendpointsetup.telegram.openbotfatherinstruction"),
      render("chatendpointsetup.telegram.chooseusernameinstruction"),
      render("chatendpointsetup.telegram.groupnotice"),
    ];

    expect(instructions[0]).toContain(first);
    expect(instructions[1]).toContain(second);
    expect(instructions[2]).toContain(group);
    expect(instructions.map((html) => [...html.matchAll(/<code>(.*?)<\/code>/g)].map((match) => match[1]))).toEqual([
      ["/newbot"],
      ["bot"],
      ["/task@bot_username &lt;request&gt;"],
    ]);
  });
});
