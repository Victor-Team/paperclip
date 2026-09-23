// @vitest-environment jsdom

import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { MembershipAction } from "./MembershipAction";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

describe("MembershipAction", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null;

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
  });

  afterEach(async () => {
    const currentRoot = root;
    if (currentRoot) {
      await act(async () => {
        currentRoot.unmount();
      });
    }
    container.remove();
    document.body.innerHTML = "";
    await i18n.changeLanguage("en");
  });

  async function renderAction(element: ReactNode) {
    const currentRoot = createRoot(container);
    root = currentRoot;
    await act(async () => {
      currentRoot.render(element);
    });
  }

  function button() {
    const element = container.querySelector("button");
    expect(element).not.toBeNull();
    return element as HTMLButtonElement;
  }

  it("renders a leave action for joined resources", async () => {
    await renderAction(
      <MembershipAction
        state="joined"
        resourceName="Growth"
        onJoin={() => {}}
        onLeave={() => {}}
      />,
    );

    expect(button().getAttribute("aria-label")).toBe("Leave Growth");
    expect(button().textContent).toContain("Leave");
  });

  it("renders a join action for left resources", async () => {
    await renderAction(
      <MembershipAction
        state="left"
        resourceName="Growth"
        onJoin={() => {}}
        onLeave={() => {}}
      />,
    );

    expect(button().getAttribute("aria-label")).toBe("Join Growth");
    expect(button().textContent).toContain("Join");
  });

  it("prevents row navigation when clicked", async () => {
    const onLeave = vi.fn();
    const parentClick = vi.fn();
    await renderAction(
      <a href="/projects/growth" onClick={parentClick}>
        <MembershipAction
          state="joined"
          resourceName="Growth"
          onJoin={() => {}}
          onLeave={onLeave}
        />
      </a>,
    );

    await act(async () => {
      button().dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("marks pending actions busy and disabled", async () => {
    await renderAction(
      <MembershipAction
        state="left"
        pending
        pendingState="joined"
        resourceName="Growth"
        onJoin={() => {}}
        onLeave={() => {}}
      />,
    );

    expect(button().getAttribute("aria-busy")).toBe("true");
    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain("Joining...");
  });

  it("retranslates join, leave, and pending copy without translating the resource name", async () => {
    const onJoin = vi.fn();
    const onLeave = vi.fn();
    await renderAction(
      <>
        <MembershipAction state="left" resourceName="Growth 项目" onJoin={onJoin} onLeave={onLeave} />
        <MembershipAction state="joined" resourceName="Growth 项目" onJoin={onJoin} onLeave={onLeave} />
        <MembershipAction
          state="left"
          pending
          pendingState="joined"
          resourceName="Growth 项目"
          onJoin={onJoin}
          onLeave={onLeave}
        />
        <MembershipAction
          state="joined"
          pending
          pendingState="left"
          resourceName="Growth 项目"
          onJoin={onJoin}
          onLeave={onLeave}
        />
      </>,
    );

    const labels = () => Array.from(container.querySelectorAll("button")).map((el) => ({
      text: el.textContent,
      aria: el.getAttribute("aria-label"),
    }));
    expect(labels()).toEqual([
      { text: expect.stringContaining("Join"), aria: "Join Growth 项目" },
      { text: expect.stringContaining("Leave"), aria: "Leave Growth 项目" },
      { text: expect.stringContaining("Joining..."), aria: "Join Growth 项目" },
      { text: expect.stringContaining("Leaving..."), aria: "Leave Growth 项目" },
    ]);

    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });

    expect(labels()).toEqual([
      { text: expect.stringContaining("加入"), aria: "加入 Growth 项目" },
      { text: expect.stringContaining("退出"), aria: "退出 Growth 项目" },
      { text: expect.stringContaining("加入中…"), aria: "加入 Growth 项目" },
      { text: expect.stringContaining("退出中…"), aria: "退出 Growth 项目" },
    ]);
    expect(container.querySelector("button")?.getAttribute("aria-label")).toContain("Growth 项目");
    expect(container.textContent).not.toContain("Growth 项目");
    expect(container.textContent).not.toContain("Join");
    expect(container.textContent).not.toContain("Leave");

    const joinButton = container.querySelector("button");
    await act(async () => {
      joinButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });
});
