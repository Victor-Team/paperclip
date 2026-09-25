// @vitest-environment jsdom

import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { AgentStatusBadge, IssueStatusBadge, StatusBadge } from "./StatusBadge";
import { agentStatusVar, statusBadge, taskStatusVar } from "../lib/status-colors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Issue/task status chips carry the unified glyph and are recolored from the
 * `--status-task-*` base hue via the `.status-chip` color-mix helper.
 */
describe("IssueStatusBadge", () => {
  it("wires each issue status to its --status-task-* base hue, with a glyph", () => {
    for (const [status, cssVar] of Object.entries(taskStatusVar)) {
      const html = renderToStaticMarkup(<IssueStatusBadge status={status} />);
      expect(html).toContain("status-chip");
      expect(html).toContain("border");
      expect(html).toContain(`var(${cssVar})`);
      expect(html).toContain('viewBox="0 0 24 24"'); // unified glyph
    }
  });

  it("points in_progress at the blue liveness var and todo at the amber var", () => {
    expect(renderToStaticMarkup(<IssueStatusBadge status="in_progress" />)).toContain("var(--status-task-in_progress)");
    expect(renderToStaticMarkup(<IssueStatusBadge status="todo" />)).toContain("var(--status-task-todo)");
  });

  it("sentence-cases the label and uses regular weight", () => {
    const html = renderToStaticMarkup(<IssueStatusBadge status="in_review" />);
    expect(html).toContain("In review");
    expect(html).not.toContain("In Review"); // sentence case, not title case
    expect(html).toContain("font-normal");
    expect(html).not.toContain("font-medium");
  });

  it("strikes through cancelled chips", () => {
    expect(renderToStaticMarkup(<IssueStatusBadge status="cancelled" />)).toContain("line-through");
  });

  it("falls back to the backlog (gray) var for unknown statuses", () => {
    expect(renderToStaticMarkup(<IssueStatusBadge status="mystery" />)).toContain("var(--status-task-backlog)");
  });

  it("renders task chips without depending on the chat flag", () => {
    const html = renderToStaticMarkup(<IssueStatusBadge status="todo" />);
    expect(html).toContain("status-chip");
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain("Todo");
  });
});

/** Agent chips recolor from the `--status-agent-*` base hues. */
describe("AgentStatusBadge", () => {
  it("wires each agent status to its --status-agent-* base hue via status-chip", () => {
    for (const [status, cssVar] of Object.entries(agentStatusVar)) {
      const html = renderToStaticMarkup(<AgentStatusBadge status={status} />);
      expect(html).toContain("status-chip");
      expect(html).toContain(`var(${cssVar})`);
    }
  });

  it('renders "active" as the idle label', () => {
    expect(renderToStaticMarkup(<AgentStatusBadge status="active" />)).toContain("idle");
  });
});

describe("StatusBadge", () => {
  it("uses the graduated brand hues", () => {
    expect(renderToStaticMarkup(<StatusBadge status="todo" />)).toContain("bg-amber-100");
    expect(renderToStaticMarkup(<StatusBadge status="in_progress" />)).toContain("bg-blue-100");
  });
});

describe("status badge live language switch", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null;

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      flushSync(() => {
        root?.unmount();
      });
    }
    container.remove();
    await i18n.changeLanguage("en");
  });

  it("retranslates known badges, keeps explicit labels, and leaves unknown statuses raw", async () => {
    flushSync(() => {
      root?.render(
        <>
          {Object.keys(statusBadge).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
          <StatusBadge status="todo" label="Board note" />
          <StatusBadge status="mystery_state" />
          <AgentStatusBadge status="active" />
          <AgentStatusBadge status="not_a_status" />
          <IssueStatusBadge status="in_review" />
          <IssueStatusBadge status="todo" />
          <IssueStatusBadge status="cancelled" />
          <IssueStatusBadge status="mystery" />
        </>,
      );
    });

    expect(container.textContent).toContain("in progress");
    expect(container.textContent).toContain("Board note");
    expect(container.textContent).toContain("mystery state");
    expect(container.textContent).toContain("idle");
    expect(container.textContent).toContain("not a status");
    expect(container.textContent).toContain("In review");
    expect(container.textContent).toContain("Todo");
    expect(container.textContent).toContain("Mystery");
    expect(container.textContent).not.toContain("待办");

    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });

    expect(container.textContent).toContain("进行中");
    expect(container.textContent).toContain("待办列表");
    expect(container.textContent).toContain("审查中");
    expect(container.textContent).toContain("已阻塞");
    expect(container.textContent).toContain("已完成");
    expect(container.textContent).toContain("已取消");
    expect(container.textContent).toContain("空闲");
    expect(container.textContent).toContain("运行中");
    expect(container.textContent).toContain("已暂停");
    expect(container.textContent).toContain("错误");
    expect(container.textContent).toContain("Board note");
    expect(container.textContent).toContain("mystery state");
    expect(container.textContent).toContain("not a status");
    expect(container.textContent).toContain("Mystery");
    expect(container.textContent).not.toContain("In review");
    expect(container.textContent).not.toContain("in progress");
    expect(container.textContent).not.toContain("statusbadge.general");
    const html = container.innerHTML;
    expect(html).toContain("bg-amber-100");
    expect(html).toContain("line-through");
    expect(html).toContain("var(--status-task-in_review)");
    expect(html).toContain("var(--status-agent-idle)");
  });
});
