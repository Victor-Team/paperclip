import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { SlackCommandHelp } from "./ChatEndpointDetail";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("Slack command help", () => {
  it.each([
    ["en", "investigate this", "Start work with"],
    ["zh-CN", "调查此事", "使用"],
  ])("keeps executable controls in English while explaining them in %s", async (locale, example, explanation) => {
    await i18n.changeLanguage(locale);
    const html = renderToStaticMarkup(<SlackCommandHelp command="/paperclip" />);
    const commands = [...html.matchAll(/<code>(.*?)<\/code>/g)].map((match) => match[1]);

    expect(commands).toEqual([
      `/paperclip ${example}`,
      "/paperclip status",
      "/paperclip new",
      "/paperclip close",
      "/status",
    ]);
    expect(html).toContain(explanation);
    expect(html).not.toContain("{{");
  });
});
