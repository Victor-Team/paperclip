// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageTabBar } from "./PageTabBar";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../context/SidebarContext", () => ({ useSidebar: () => ({ isMobile: true }) }));

const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];
afterEach(async () => {
  for (const { root, container } of roots) {
    await act(async () => root.unmount());
    container.remove();
  }
  roots.length = 0;
});

describe("PageTabBar mobile labels", () => {
  it("uses translated JSX text and preserves result counts without exposing raw values", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push({ root, container });
    await act(async () => root.render(<PageTabBar
      value="proposals"
      onValueChange={() => {}}
      items={[
        { value: "proposals", label: <span>提案 <span>3</span></span> },
        { value: "issues", label: <span>任务 <span>12</span></span>, mobileLabel: "任务 (12)" },
      ]}
    />));
    const options = [...container.querySelectorAll("option")].map((option) => option.textContent);
    expect(options).toEqual(["提案 3", "任务 (12)"]);
    expect(options).not.toContain("proposals");
  });
});
