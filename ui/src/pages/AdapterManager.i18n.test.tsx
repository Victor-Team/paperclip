// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { AdapterManager } from "./AdapterManager";

const mockAdaptersApi = vi.hoisted(() => ({
  list: vi.fn(),
  install: vi.fn(),
  remove: vi.fn(),
  setDisabled: vi.fn(),
  setOverridePaused: vi.fn(),
  reload: vi.fn(),
  reinstall: vi.fn(),
}));

vi.mock("@/api/adapters", () => ({
  adaptersApi: mockAdaptersApi,
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

vi.mock("@/components/PathInstructionsModal", () => ({
  ChoosePathButton: () => null,
}));

const sourcePath = [
  resolve(process.cwd(), "ui/src/pages/AdapterManager.tsx"),
  resolve(process.cwd(), "src/pages/AdapterManager.tsx"),
].find((path) => existsSync(path));
if (!sourcePath) throw new Error("AdapterManager.tsx not found from vitest cwd");
const source = readFileSync(sourcePath, { encoding: "utf8" });
const usedKeys = [...new Set(source.match(/adaptermanager\.general\.\w+/g) ?? [])];

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

describe("AdapterManager i18n wiring", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("reads only keys that exist in both English and Chinese", async () => {
    expect(usedKeys.length).toBe(72);
    for (const lng of ["en", "zh-CN"]) {
      await i18n.changeLanguage(lng);
      for (const key of usedKeys) expect(i18n.exists(key), `${lng} is missing ${key}`).toBe(true);
    }
  });

  it("keeps the English adapter-manager copy that users currently see", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("adaptermanager.general.adapters")).toBe("Adapters");
    expect(i18n.t("adaptermanager.general.installAdapter")).toBe("Install Adapter");
    expect(i18n.t("adaptermanager.general.localPath")).toBe("Local path");
    expect(i18n.t("adaptermanager.general.installExternalAdapter")).toBe("Install External Adapter");
    expect(i18n.t("adaptermanager.general.sourceExternal")).toBe("External");
    expect(i18n.t("adaptermanager.general.sourceBuiltin")).toBe("Built-in");
    expect(i18n.t("adaptermanager.general.installFailed")).toBe("Install failed");
    expect(i18n.t("adaptermanager.general.modelsCount", { count: 3 })).toBe("3 models");
  });

  it("uses accepted terminology for the Chinese adapter-manager copy", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("adaptermanager.general.adapters")).toBe("适配器");
    expect(i18n.t("adaptermanager.general.settings")).toBe("设置");
    expect(i18n.t("adaptermanager.general.installAdapter")).toBe("安装适配器");
    expect(i18n.t("adaptermanager.general.localPath")).toBe("本地路径");
    expect(i18n.t("adaptermanager.general.sourceExternal")).toBe("外部");
    expect(i18n.t("adaptermanager.general.sourceBuiltin")).toBe("内置");
    expect(i18n.t("adaptermanager.general.installFailed")).toBe("安装失败");
    expect(i18n.t("adaptermanager.general.organization")).toBe("公司");
    expect(i18n.t("adaptermanager.general.modelsCount", { count: 3 })).toBe("3 个模型");
    expect(i18n.t("common.actions.cancel")).toBe("取消");
  });

  describe("live render", () => {
    let container: HTMLDivElement;
    let root: Root;
    let queryClient: QueryClient;

    beforeEach(() => {
      mockAdaptersApi.list.mockResolvedValue([]);
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
            <AdapterManager />
          </QueryClientProvider>,
        );
      });
      await waitForText(() => container.textContent, "Install Adapter");
      expect(container.textContent).toContain("Adapters");
      expect(container.textContent).toContain("Install Adapter");
      expect(container.textContent).toContain("No external adapters installed");
      expect(container.textContent).not.toContain("适配器");

      await act(async () => {
        await i18n.changeLanguage("zh-CN");
      });
      await flushReact();
      expect(container.textContent).toContain("适配器");
      expect(container.textContent).toContain("安装适配器");
      expect(container.textContent).toContain("尚未安装外部适配器");
      expect(container.textContent).not.toContain("Install Adapter");
      expect(container.textContent).not.toContain("No external adapters installed");

      await act(async () => {
        await i18n.changeLanguage("en");
      });
      await flushReact();
      expect(container.textContent).toContain("Install Adapter");
      expect(container.textContent).not.toContain("安装适配器");
    });

    it("retranslates the install dialog on a language switch", async () => {
      await i18n.changeLanguage("en");
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <AdapterManager />
          </QueryClientProvider>,
        );
      });
      await waitForText(() => container.textContent, "Install Adapter");

      const installButton = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Install Adapter"),
      );
      expect(installButton).toBeTruthy();
      await act(async () => {
        installButton?.click();
      });
      await flushReact();
      expect(document.body.textContent).toContain("Install External Adapter");
      expect(document.body.textContent).toContain("npm package");

      await act(async () => {
        await i18n.changeLanguage("zh-CN");
      });
      await flushReact();
      expect(document.body.textContent).toContain("安装外部适配器");
      expect(document.body.textContent).toContain("npm 软件包");
      expect(document.body.textContent).toContain("本地路径");
      expect(document.body.textContent).not.toContain("Install External Adapter");
    });
  });
});
