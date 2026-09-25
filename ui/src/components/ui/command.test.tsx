// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { CommandDialog } from "./command";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("cmdk", () => ({ Command: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }));
vi.mock("radix-ui", () => ({ Dialog: { Close: ({ children }: { children?: React.ReactNode }) => <button>{children}</button> } }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
}));

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  await i18n.changeLanguage("en");
});

describe("CommandDialog accessible defaults", () => {
  it("updates default title and description when language changes and respects explicit values", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root?.render(<CommandDialog open showCloseButton={false}>Actions</CommandDialog>));
    expect(container.querySelector("h2")?.textContent).toBe("Command Palette");
    expect(container.querySelector("p")?.textContent).toBe("Search for a command to run...");
    await act(async () => { await i18n.changeLanguage("zh-CN"); });
    expect(container.querySelector("h2")?.textContent).toBe("命令面板");
    expect(container.querySelector("p")?.textContent).toBe("搜索要执行的命令…");
    await act(async () => root?.render(<CommandDialog open title="Custom" description="Custom help" showCloseButton={false}>Actions</CommandDialog>));
    expect(container.querySelector("h2")?.textContent).toBe("Custom");
    expect(container.querySelector("p")?.textContent).toBe("Custom help");
  });
});
