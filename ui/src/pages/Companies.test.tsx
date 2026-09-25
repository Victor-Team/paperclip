// @vitest-environment jsdom

import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { queryKeys } from "@/lib/queryKeys";
import { Companies } from "./Companies";

const mockCompaniesApi = vi.hoisted(() => ({
  stats: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
const mockOpenOnboarding = vi.hoisted(() => vi.fn());
const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());

vi.mock("../api/companies", () => ({
  companiesApi: mockCompaniesApi,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    companies: [
      {
        id: "company-1",
        issuePrefix: "PAP",
        name: "Acme Labs",
        description: "Steely description",
        status: "active",
        budgetMonthlyCents: 0,
        spentMonthlyCents: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: "company-2",
        issuePrefix: "ARC",
        name: "Archived Co",
        status: "archived",
        budgetMonthlyCents: 0,
        spentMonthlyCents: 0,
        createdAt: new Date().toISOString(),
      },
    ],
    selectedCompanyId: "company-1",
    setSelectedCompanyId: vi.fn(),
    loading: false,
    error: null,
  }),
}));

vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({ openOnboarding: mockOpenOnboarding }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: mockSetBreadcrumbs }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  await flushSync(callback);
}

async function flushReact() {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

const CLOUD_HEALTH = {
  status: "ok" as const,
  cloud: {
    managed: true as const,
    managedBy: "paperclip-cloud" as const,
    stackSlug: "acme-labs",
    cloudBaseUrl: "https://cloud.example.test",
  },
};

describe("Companies page", () => {
  let container: HTMLDivElement;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    await i18n.changeLanguage("en");
    mockCompaniesApi.stats.mockResolvedValue({
      "company-1": { agentCount: 1, issueCount: 2 },
      "company-2": { agentCount: 0, issueCount: 0 },
    });
  });

  afterEach(async () => {
    container.remove();
    document.body.innerHTML = "";
    await i18n.changeLanguage("en");
    vi.clearAllMocks();
  });

  async function renderPage({ cloud }: { cloud?: boolean } = {}) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    if (cloud) queryClient.setQueryData(queryKeys.health, CLOUD_HEALTH);
    const root = createRoot(container);
    await act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Companies />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();
    return root;
  }

  it("offers the company wizard when self-hosted", async () => {
    const root = await renderPage();

    expect(container.textContent).toContain("New Organization");

    await act(() => {
      root.unmount();
    });
  });

  it("hides the company wizard on a cloud-managed instance", async () => {
    const root = await renderPage({ cloud: true });

    // Cloud stacks hold exactly one company and POST /companies is a 403 floor,
    // so the entry point must not be offered at all.
    expect(container.textContent).not.toContain("New Organization");
    expect(container.textContent).toContain("Acme Labs");
    expect(mockOpenOnboarding).not.toHaveBeenCalled();

    await act(() => {
      root.unmount();
    });
  });

  it("retranslates chrome, counts, menu, and delete confirm on a live Chinese switch", async () => {
    const root = await renderPage();

    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([{ label: "Organizations" }]);
    expect(container.textContent).toContain("New Organization");
    expect(container.textContent).toContain("Active");
    expect(container.textContent).toContain("Archived");
    expect(container.textContent).toContain("1 agent");
    expect(container.textContent).toContain("2 tasks");
    expect(container.textContent).toContain("Unlimited budget");
    expect(container.textContent).toContain("Created just now");
    expect(container.textContent).toContain("Rename");
    expect(container.textContent).toContain("Unarchive");
    expect(container.textContent).toContain("Delete Organization");
    expect(container.textContent).toContain("Acme Labs");
    expect(container.textContent).toContain("Archived Co");
    expect(container.textContent).toContain("Steely description");
    expect(container.textContent).not.toContain("新建公司");

    const deleteOrgButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Delete Organization"),
    );
    expect(deleteOrgButton).toBeTruthy();
    await act(() => {
      deleteOrgButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(container.textContent).toContain(
      "Delete this organization and all its data? This cannot be undone.",
    );
    expect(
      Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Cancel"),
    ).toBe(true);
    expect(
      Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Delete"),
    ).toBe(true);

    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });
    await flushReact();

    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([{ label: "公司" }]);
    expect(container.textContent).toContain("新建公司");
    expect(container.textContent).toContain("活跃");
    expect(container.textContent).toContain("已归档");
    expect(container.textContent).toContain("1 个智能体");
    expect(container.textContent).toContain("2 个任务");
    expect(container.textContent).toContain("预算不限");
    expect(container.textContent).toContain("创建于 刚刚");
    expect(container.textContent).toContain("重命名");
    expect(container.textContent).toContain("解除归档");
    expect(container.textContent).toContain("删除公司");
    expect(container.textContent).toContain("删除这家公司及其全部数据？此操作无法撤销。");
    expect(
      Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "取消"),
    ).toBe(true);
    expect(
      Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "删除"),
    ).toBe(true);
    expect(container.textContent).toContain("Acme Labs");
    expect(container.textContent).toContain("Archived Co");
    expect(container.textContent).toContain("Steely description");
    expect(container.textContent).not.toContain("New Organization");
    expect(container.textContent).not.toContain("Unlimited budget");
    expect(container.textContent).not.toContain("Delete Organization");
    expect(container.textContent).not.toContain("Created just now");

    await act(() => {
      root.unmount();
    });
  });
});
