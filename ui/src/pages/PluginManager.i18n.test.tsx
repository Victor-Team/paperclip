// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { PluginManager } from "./PluginManager";

const mockPluginsApi = vi.hoisted(() => ({
  list: vi.fn(),
  listBundled: vi.fn(),
  install: vi.fn(),
  uninstall: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
}));

vi.mock("@/api/plugins", () => ({
  pluginsApi: mockPluginsApi,
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompany: { id: "company-1", name: "Paperclip" },
    selectedCompanyId: "company-1",
  }),
}));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("@/context/ToastContext", () => ({
  useToastActions: () => ({ pushToast: vi.fn() }),
}));

const sourcePath = [
  resolve(process.cwd(), "ui/src/pages/PluginManager.tsx"),
  resolve(process.cwd(), "src/pages/PluginManager.tsx"),
].find((path) => existsSync(path));
if (!sourcePath) throw new Error("PluginManager.tsx not found from vitest cwd");
const source = readFileSync(sourcePath, { encoding: "utf8" });
const usedKeys = [...new Set(source.match(/pluginmanager\.general\.\w+/g) ?? [])];

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

async function waitForText(getText: () => string | null | undefined, needle: string) {
  for (let i = 0; i < 25; i++) {
    if ((getText() ?? "").includes(needle)) return;
    await flushReact();
  }
  throw new Error(`missing ${needle}`);
}

describe("PluginManager i18n wiring", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("reads only keys that exist in both English and Chinese", async () => {
    expect(usedKeys.length).toBe(60);
    for (const lng of ["en", "zh-CN"]) {
      await i18n.changeLanguage(lng);
      for (const key of usedKeys) expect(i18n.exists(key), `${lng} is missing ${key}`).toBe(true);
    }
  });

  it("keeps the English plugin-manager copy that users currently see", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("pluginmanager.general.pluginManager")).toBe("Plugin Manager");
    expect(i18n.t("pluginmanager.general.installPlugin")).toBe("Install Plugin");
    expect(i18n.t("pluginmanager.general.pluginsAreAlpha")).toBe("Plugins are alpha.");
    expect(i18n.t("pluginmanager.general.availablePlugins")).toBe("Available Plugins");
    expect(i18n.t("pluginmanager.general.bundled")).toBe("Bundled");
    expect(i18n.t("pluginmanager.general.notInstalled")).toBe("Not installed");
    expect(i18n.t("pluginmanager.general.firstParty")).toBe("First-party");
    expect(i18n.t("pluginmanager.general.statusReady")).toBe("ready");
    expect(i18n.t("pluginmanager.general.statusError")).toBe("error");
    expect(i18n.t("pluginmanager.general.areYouSureYou", { name: "Wiki" })).toBe(
      "Are you sure you want to uninstall Wiki? This action cannot be undone.",
    );
  });

  it("uses accepted terminology for the Chinese plugin-manager copy", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("pluginmanager.general.plugins")).toBe("插件");
    expect(i18n.t("pluginmanager.general.settings")).toBe("设置");
    expect(i18n.t("pluginmanager.general.installPlugin")).toBe("安装插件");
    expect(i18n.t("pluginmanager.general.bundled")).toBe("内置");
    expect(i18n.t("pluginmanager.general.notInstalled")).toBe("未安装");
    expect(i18n.t("pluginmanager.general.experimental")).toBe("实验性");
    expect(i18n.t("pluginmanager.general.configure")).toBe("配置");
    expect(i18n.t("pluginmanager.general.disable")).toBe("禁用");
    expect(i18n.t("pluginmanager.general.organization")).toBe("公司");
    expect(i18n.t("common.actions.cancel")).toBe("取消");
    expect(i18n.t("common.actions.close")).toBe("关闭");
  });

  describe("live render", () => {
    let container: HTMLDivElement;
    let root: Root;
    let queryClient: QueryClient;

    beforeEach(() => {
      mockPluginsApi.list.mockResolvedValue([]);
      mockPluginsApi.listBundled.mockResolvedValue([]);
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
      queryClient.clear();
      document.body.innerHTML = "";
    });

    it("resolves page copy live instead of a frozen import-time snapshot", async () => {
      await i18n.changeLanguage("en");
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <PluginManager />
          </QueryClientProvider>,
        );
      });
      await waitForText(() => container.textContent, "Install Plugin");
      expect(container.textContent).toContain("Plugin Manager");
      expect(container.textContent).toContain("Install Plugin");
      expect(container.textContent).toContain("Plugins are alpha.");
      expect(container.textContent).toContain("No plugins installed");
      expect(container.textContent).not.toContain("插件管理");

      await act(async () => {
        await i18n.changeLanguage("zh-CN");
      });
      await flushReact();
      expect(container.textContent).toContain("插件管理");
      expect(container.textContent).toContain("安装插件");
      expect(container.textContent).toContain("尚未安装插件");
      expect(container.textContent).not.toContain("Install Plugin");
      expect(container.textContent).not.toContain("No plugins installed");

      await act(async () => {
        await i18n.changeLanguage("en");
      });
      await flushReact();
      expect(container.textContent).toContain("Install Plugin");
      expect(container.textContent).not.toContain("安装插件");
    });

    it("retranslates the install dialog on a language switch", async () => {
      await i18n.changeLanguage("en");
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <PluginManager />
          </QueryClientProvider>,
        );
      });
      await waitForText(() => container.textContent, "Install Plugin");

      const installButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Install Plugin"),
      );
      expect(installButton).toBeTruthy();
      await act(async () => {
        installButton?.click();
      });
      await flushReact();
      expect(document.body.textContent).toContain("Enter the npm package name of the plugin you wish to install.");
      expect(document.body.textContent).toContain("npm Package Name");
      expect(document.body.textContent).toContain("Cancel");

      await act(async () => {
        await i18n.changeLanguage("zh-CN");
      });
      await flushReact();
      expect(document.body.textContent).toContain("输入要安装的插件的 npm 软件包名称。");
      expect(document.body.textContent).toContain("npm 软件包名称");
      expect(document.body.textContent).toContain("取消");
      expect(document.body.textContent).not.toContain("Enter the npm package name of the plugin you wish to install.");
    });
  });
});
