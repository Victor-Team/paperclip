// @vitest-environment jsdom
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { GitHubChatSetup } from "./GitHubChatSetup";

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: null }),
}));
vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));
vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({ pushToast: vi.fn() }),
}));
vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({ isMobile: false, setSidebarOpen: vi.fn() }),
}));
vi.mock("@/lib/router", () => ({
  useSearchParams: () => [new URLSearchParams("provider=github"), vi.fn()],
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

describe("GitHub chat setup language switching", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("updates the wizard navigation and first step without changing the selected agent", async () => {
    await i18n.changeLanguage("en");
    const node = document.createElement("div");
    document.body.append(node);
    const root = createRoot(node);
    const client = new QueryClient();
    const content = <QueryClientProvider client={client}><GitHubChatSetup /></QueryClientProvider>;
    flushSync(() => root.render(content));
    expect(node.textContent).toContain("Choose agent");
    expect(node.textContent).toContain("GitHub conversations run as Paperclip tasks");

    await i18n.changeLanguage("zh-CN");
    flushSync(() => root.render(content));
    expect(node.textContent).toContain("选择智能体");
    expect(node.textContent).toContain("GitHub 对话会作为 Paperclip 任务");
    expect(node.textContent).toContain("第 1 步，共 8 步");
    flushSync(() => root.unmount());
    node.remove();
    client.clear();
  });
});
