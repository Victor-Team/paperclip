// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { ChoosePathButton, PathInstructionsModal } from "./PathInstructionsModal";

const sourcePath = [
  resolve(process.cwd(), "ui/src/components/PathInstructionsModal.tsx"),
  resolve(process.cwd(), "src/components/PathInstructionsModal.tsx"),
].find((path) => existsSync(path));
if (!sourcePath) throw new Error("PathInstructionsModal.tsx not found from vitest cwd");
const source = readFileSync(sourcePath, "utf8");
const usedKeys = [...new Set(source.match(/pathinstructionsmodal\.general\.\w+/g) ?? [])];

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("PathInstructionsModal i18n wiring", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("reads only keys that exist in both English and Chinese", async () => {
    expect(usedKeys.length).toBe(20);
    for (const lng of ["en", "zh-CN"]) {
      await i18n.changeLanguage(lng);
      for (const key of usedKeys) expect(i18n.exists(key), `${lng} is missing ${key}`).toBe(true);
    }
  });

  it("keeps the English modal copy that users currently see", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("pathinstructionsmodal.general.howToGetA")).toBe("How to get a full path");
    expect(i18n.t("pathinstructionsmodal.general.choose")).toBe("Choose");
    expect(i18n.t("pathinstructionsmodal.general.macos")).toBe("macOS");
    expect(i18n.t("pathinstructionsmodal.general.pasteTheAbsolutePath")).toBe(
      "Paste the absolute path (e.g.",
    );
    expect(i18n.t("pathinstructionsmodal.general.intoTheInput")).toBe(") into the input field.");
    expect(i18n.t("pathinstructionsmodal.general.macStepHoldOption")).toContain("Copy as Pathname");
    expect(i18n.t("pathinstructionsmodal.general.windowsTip")).toContain("Copy as path");
  });

  it("uses accepted terminology for the Chinese how-to copy", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("pathinstructionsmodal.general.choose")).toBe("选择");
    expect(i18n.t("pathinstructionsmodal.general.macStepOpenFinder")).toBe("打开 Finder 并进入该文件夹。");
    expect(i18n.t("pathinstructionsmodal.general.windowsStepOpenExplorer")).toBe(
      "打开文件资源管理器并进入该文件夹。",
    );
    expect(i18n.t("pathinstructionsmodal.general.linuxStepOpenTerminal")).toBe(
      "打开终端并用 cd 进入该目录。",
    );
    expect(i18n.t("pathinstructionsmodal.general.linuxTip")).toContain("Ctrl+L");
  });

  describe("live render", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      document.body.innerHTML = "";
    });

    it("resolves Choose button copy live instead of a frozen import-time snapshot", async () => {
      await i18n.changeLanguage("en");
      await act(async () => {
        root.render(<ChoosePathButton />);
      });
      await flushReact();
      expect(container.textContent).toContain("Choose");
      expect(container.textContent).not.toContain("选择");

      await act(async () => {
        await i18n.changeLanguage("zh-CN");
      });
      await flushReact();
      expect(container.textContent).toContain("选择");
      expect(container.textContent).not.toContain("Choose");

      await act(async () => {
        await i18n.changeLanguage("en");
      });
      await flushReact();
      expect(container.textContent).toContain("Choose");
      expect(container.textContent).not.toContain("选择");
    });

    it("retranslates the open modal on a language switch", async () => {
      await i18n.changeLanguage("en");
      await act(async () => {
        root.render(<PathInstructionsModal open onOpenChange={() => undefined} />);
      });
      await flushReact();
      expect(document.body.textContent).toContain("How to get a full path");
      expect(document.body.textContent).toContain("Paste the absolute path (e.g.");

      await act(async () => {
        await i18n.changeLanguage("zh-CN");
      });
      await flushReact();
      expect(document.body.textContent).toContain("如何获取完整路径");
      expect(document.body.textContent).toContain("将绝对路径（例如");
      expect(document.body.textContent).toContain("）粘贴到输入框中。");
      expect(document.body.textContent).not.toContain("How to get a full path");
    });
  });
});
