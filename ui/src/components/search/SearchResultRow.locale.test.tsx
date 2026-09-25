// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { CompanySearchResult } from "@paperclipai/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { SearchResultRow, formatSearchRelativeTime } from "./SearchResultRow";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/lib/router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  await i18n.changeLanguage("en");
});

describe("SearchResultRow locale", () => {
  it("labels a waiting in-review conversation as idle in English and Chinese", async () => {
    const result: CompanySearchResult = {
      id: "issue-1", type: "issue", score: 1, title: "Example", href: "/issues/1",
      matchedFields: [], sourceLabel: "", snippet: "", snippets: [],
      issue: {
        id: "issue-1", identifier: "TOK-1", title: "Example", status: "in_review", priority: "medium",
        externalConversationState: "waiting", assigneeAgentId: null, assigneeUserId: null,
        projectId: null, updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(), previewImageUrl: null,
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root?.render(<SearchResultRow result={result} />));
    const statusIcon = () => container?.querySelector('svg[role="img"]');
    expect(statusIcon()?.getAttribute("aria-label")).toBe("Idle");
    expect(statusIcon()?.querySelector("title")?.textContent).toBe("Idle");

    await act(async () => { await i18n.changeLanguage("zh-CN"); });
    expect(statusIcon()?.getAttribute("aria-label")).toBe("空闲");
    expect(statusIcon()?.querySelector("title")?.textContent).toBe("空闲");

    await act(async () => root?.render(<SearchResultRow result={{
      ...result, issue: { ...result.issue!, externalConversationState: "active" },
    }} />));
    expect(statusIcon()?.getAttribute("aria-label")).toBe("审查中");
  });

  it("keeps English shorthand and formats Chinese relative time", () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    const earlier = "2026-09-20T12:00:00Z";
    expect(formatSearchRelativeTime(earlier, "en", now)).toBe("5d");
    expect(formatSearchRelativeTime(earlier, "zh-CN", now)).toContain("5天前");
  });

  it("renders translated source labels and updates them with the locale", async () => {
    const result: CompanySearchResult = {
      id: "issue-1", type: "issue", score: 1, title: "Example", href: "/issues/1",
      matchedFields: ["description", "comment"], sourceLabel: "Description", snippet: "Example",
      snippets: [
        { field: "description", label: "Description", text: "Body", highlights: [] },
        { field: "comment", label: "Comment", text: "Reply", highlights: [] },
      ],
      issue: {
        id: "issue-1", identifier: "TOK-1", title: "Example", status: "todo", priority: "medium",
        assigneeAgentId: null, assigneeUserId: null, projectId: null, updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(), previewImageUrl: null,
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root?.render(<SearchResultRow result={result} />));
    expect(container.textContent).toContain("Description");
    await act(async () => { await i18n.changeLanguage("zh-CN"); });
    expect(container.textContent).toContain("描述");
    expect(container.textContent).toContain("评论");
    expect(container.textContent).not.toContain("Description");
  });
});
