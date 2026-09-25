// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolCatalogEntry } from "@paperclipai/shared";
import { i18n } from "@/i18n";
import { QuarantinedActionsReview } from "./SetupPanel";

describe("QuarantinedActionsReview", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-CN");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    flushSync(() => root.unmount());
    container.remove();
    await i18n.changeLanguage("en");
  });

  it("renders review controls in Simplified Chinese while retaining the dynamic action name", () => {
    const entries = [{ id: "tool-1", title: "Create issue", toolName: "create_issue", description: null }] as ToolCatalogEntry[];

    flushSync(() => {
      root.render(<QuarantinedActionsReview entries={entries} disabled={false} onSubmit={() => undefined} />);
    });

    expect(container.textContent).toContain("审查 1 个新操作");
    expect(container.textContent).toContain("Create issue");
    expect(container.textContent).toContain("全部开启");
    expect(container.querySelector('[aria-label="允许 Create issue"]')).toBeTruthy();
  });
});
