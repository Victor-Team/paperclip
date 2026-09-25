// @vitest-environment jsdom

import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Project } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { ToastProvider } from "../context/ToastContext";
import { Projects } from "./Projects";

const mockProjectsApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockResourceMembershipsApi = vi.hoisted(() => ({
  listMine: vi.fn(),
  updateProject: vi.fn(),
}));

const mockOpenNewProject = vi.hoisted(() => vi.fn());
const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());

vi.mock("@/lib/router", () => ({
  Link: ({ children, to, ...props }: { children?: ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({ openNewProject: mockOpenNewProject }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: mockSetBreadcrumbs }),
}));

vi.mock("../api/projects", () => ({
  projectsApi: mockProjectsApi,
}));

vi.mock("../api/resourceMemberships", () => ({
  resourceMembershipsApi: mockResourceMembershipsApi,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (!globalThis.PointerEvent) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = MouseEvent;
}

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: "project-a",
    companyId: "company-1",
    urlKey: "alpha",
    goalId: null,
    goalIds: [],
    goals: [],
    name: "Alpha",
    description: null,
    status: "in_progress",
    leadAgentId: null,
    targetDate: null,
    color: "#ef4444",
    icon: null,
    env: null,
    pauseReason: null,
    pausedAt: null,
    executionWorkspacePolicy: null,
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "/tmp/project-a",
      effectiveLocalFolder: "/tmp/project-a",
      origin: "local_folder",
    },
    workspaces: [],
    primaryWorkspace: null,
    managedByPlugin: null,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("Projects", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot> | null;
  let queryClient: QueryClient;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    await i18n.changeLanguage("en");
    mockProjectsApi.list.mockResolvedValue([
      makeProject({
        id: "project-c",
        urlKey: "charlie",
        name: "Charlie",
        taskCount: 2,
        updatedAt: new Date("2026-01-10T00:00:00Z"),
      }),
      makeProject({
        id: "project-b",
        urlKey: "bravo",
        name: "Bravo",
        taskCount: 0,
        updatedAt: new Date("2026-01-05T00:00:00Z"),
      }),
      makeProject({
        id: "project-a",
        urlKey: "alpha",
        name: "Alpha",
        description: "First project",
        taskCount: 1,
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ]);
    mockResourceMembershipsApi.listMine.mockResolvedValue({
      projectMemberships: { "project-b": "left" },
      agentMemberships: {},
      updatedAt: null,
    });
    mockResourceMembershipsApi.updateProject.mockResolvedValue({
      resourceType: "project",
      resourceId: "project-b",
      state: "joined",
      updatedAt: new Date("2026-01-05T00:00:00Z"),
    });
  });

  afterEach(async () => {
    const currentRoot = root;
    if (currentRoot) {
      await act(async () => {
        currentRoot.unmount();
      });
    }
    queryClient.clear();
    container.remove();
    document.body.innerHTML = "";
    await i18n.changeLanguage("en");
    vi.clearAllMocks();
  });

  async function renderProjects() {
    const currentRoot = createRoot(container);
    root = currentRoot;

    await act(async () => {
      currentRoot.render(
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <Projects />
          </ToastProvider>
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();
  }

  async function openSortMenu() {
    const trigger = container.querySelector<HTMLButtonElement>('button[title="Sort"]');
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();
  }

  async function chooseSortField(label: string) {
    const item = Array.from(document.body.querySelectorAll("button"))
      .find((element) => element.textContent?.includes(label));
    expect(item).toBeTruthy();

    await act(async () => {
      item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();
  }

  it("groups joined projects above left projects and defaults sorting by name", async () => {
    await renderProjects();

    const content = container.textContent ?? "";
    expect(container.querySelector('button[title="Sort"]')?.textContent).toContain("Sort: Name");
    expect(content.indexOf("My Projects")).toBeLessThan(content.indexOf("Alpha"));
    expect(content.indexOf("Alpha")).toBeLessThan(content.indexOf("Charlie"));
    expect(content.indexOf("Charlie")).toBeLessThan(content.indexOf("Other Projects"));
    expect(content.indexOf("Other Projects")).toBeLessThan(content.indexOf("Bravo"));
    expect(content).toContain("in progress");
  });

  it("sorts grouped projects by the selected field", async () => {
    await renderProjects();
    await openSortMenu();
    await chooseSortField("Updated");

    const content = container.textContent ?? "";
    expect(content.indexOf("My Projects")).toBeLessThan(content.indexOf("Charlie"));
    expect(content.indexOf("Charlie")).toBeLessThan(content.indexOf("Alpha"));
    expect(content.indexOf("Alpha")).toBeLessThan(content.indexOf("Other Projects"));
  });

  it("reserves description line height for projects without descriptions", async () => {
    await renderProjects();

    const bravoLink = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find((link) =>
      link.textContent?.includes("Bravo"),
    );
    const hiddenDescriptionLine = bravoLink?.querySelector("p[aria-hidden='true']");

    expect(hiddenDescriptionLine).not.toBeNull();
    expect(hiddenDescriptionLine?.className).toContain("min-h-4");
  });

  it("retranslates breadcrumbs, sort menu, section titles, and counts on a live Chinese switch", async () => {
    await renderProjects();

    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([{ label: "Projects" }]);
    expect(container.querySelector('button[title="Sort"]')?.textContent).toContain("Sort: Name");
    expect(container.textContent).toContain("My Projects");
    expect(container.textContent).toContain("Other Projects");
    expect(container.textContent).toContain("2 projects");
    expect(container.textContent).toContain("1 project");
    expect(container.textContent).toContain("Add Project");
    expect(container.textContent).toContain("1 task");
    expect(container.textContent).toContain("2 tasks");
    expect(container.textContent).toContain("0 tasks");
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Charlie");
    expect(container.textContent).toContain("Bravo");
    expect(container.textContent).toContain("First project");

    await openSortMenu();
    expect(document.body.textContent).toContain("Updated");
    expect(document.body.textContent).toContain("Created");
    expect(document.body.textContent).toContain("Target date");
    expect(document.body.textContent).toContain("Asc");

    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });
    await flushReact();

    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([{ label: "项目" }]);
    expect(container.querySelector('button[title="排序"]')?.textContent).toContain("排序：名称");
    expect(container.textContent).toContain("我的项目");
    expect(container.textContent).toContain("其他项目");
    expect(container.textContent).toContain("2 个项目");
    expect(container.textContent).toContain("1 个项目");
    expect(container.textContent).toContain("添加项目");
    expect(container.textContent).toContain("1 个任务");
    expect(container.textContent).toContain("2 个任务");
    expect(container.textContent).toContain("0 个任务");
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Charlie");
    expect(container.textContent).toContain("Bravo");
    expect(container.textContent).toContain("First project");
    expect(container.textContent).not.toContain("My Projects");
    expect(container.textContent).not.toContain("Other Projects");
    expect(container.textContent).not.toContain("Add Project");
    expect(container.textContent).not.toContain("Sort: Name");

    const openMenu = document.body.textContent ?? "";
    expect(openMenu).toContain("名称");
    expect(openMenu).toContain("已更新");
    expect(openMenu).toContain("创建时间");
    expect(openMenu).toContain("目标日期");
    expect(openMenu).toContain("升序");
    expect(openMenu).not.toContain("Target date");
    expect(openMenu).not.toContain("Updated");
  });
});
