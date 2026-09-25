// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { defaultGitHubReviewPolicy } from "@paperclipai/shared";
import { i18n } from "@/i18n";
import { GitHubPolicyEditor } from "./GitHubBotConfiguration";

describe("GitHub policy language switching", () => {
  const container = document.createElement("div");
  const root = createRoot(container);

  afterEach(async () => {
    flushSync(() => root.unmount());
    container.remove();
    await i18n.changeLanguage("en");
  });

  it("updates event, filter, prompt, and rating labels", async () => {
    await i18n.changeLanguage("en");
    document.body.appendChild(container);
    const policy = defaultGitHubReviewPolicy();
    flushSync(() => root.render(<GitHubPolicyEditor policy={policy} onChange={() => undefined} />));
    expect(container.textContent).toContain("New pull request");
    expect(container.textContent).toContain("Included authors");
    expect(container.textContent).toContain("Require at least 5/5");

    await i18n.changeLanguage("zh-CN");
    flushSync(() => root.render(<GitHubPolicyEditor policy={policy} onChange={() => undefined} />));
    expect(container.textContent).toContain("新建拉取请求");
    expect(container.textContent).toContain("包含的作者");
    expect(container.textContent).toContain("至少达到 5/5");
    expect(container.querySelector('textarea[aria-label="新建拉取请求提示词"]')).toBeTruthy();
  });
});
