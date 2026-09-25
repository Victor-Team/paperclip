// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { CompanyProvider, useCompany } from "@/context/CompanyContext";
import { i18n } from "@/i18n";
import { InstanceAccess } from "./InstanceAccess";

const mocks = vi.hoisted(() => ({
  list: vi.fn(), directory: vi.fn(), detachInflightList: vi.fn(), detachInflightDirectory: vi.fn(),
  getSession: vi.fn(), searchAdminUsers: vi.fn(), getUserCompanyAccess: vi.fn(),
  setUserCompanyAccess: vi.fn(), setBreadcrumbs: vi.fn(), pushToast: vi.fn(),
}));
vi.mock("@/api/companies", () => ({ companiesApi: mocks }));
vi.mock("@/api/auth", () => ({ authApi: mocks }));
vi.mock("@/api/access", () => ({ accessApi: mocks }));
vi.mock("@/context/BreadcrumbContext", () => ({ useBreadcrumbs: () => mocks }));
vi.mock("@/context/ToastContext", () => ({ useToast: () => mocks }));

const companyA = { id: "company-a", name: "Company A", issuePrefix: "CPA", status: "active" };
const companyB = { id: "company-b", name: "Company B", issuePrefix: "CPB", status: "active" };
const user = {
  id: "admin", name: "Admin", email: "admin@example.com", isInstanceAdmin: true,
  activeCompanyMembershipCount: 1,
};
const membershipA = {
  id: "membership-a", companyId: companyA.id, companyName: companyA.name,
  status: "active", membershipRole: "owner", updatedAt: "2020-01-01T00:00:00Z",
};
const membershipUnknown = {
  id: "membership-unknown", companyId: "company-x", companyName: "Company X",
  status: "mystery", membershipRole: "custom-role", updatedAt: "2020-01-01T00:00:00Z",
};
const membershipUnset = {
  id: "membership-unset", companyId: "company-y", companyName: "Company Y",
  status: "active", membershipRole: null, updatedAt: "2020-01-01T00:00:00Z",
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

function NavigationProbe() {
  const { companies } = useCompany();
  return <nav data-testid="navigation">{companies.map((company) => company.name).join(", ")}</nav>;
}

async function renderPage() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <CompanyProvider><NavigationProbe /><InstanceAccess /></CompanyProvider>
      </QueryClientProvider>,
    );
  });
}

async function eventually(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    assertion();
  });
}

function button(text: string) {
  return [...container.querySelectorAll("button")].find((element) => element.textContent === text);
}

beforeEach(async () => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  await i18n.changeLanguage("en");
  mocks.getSession.mockResolvedValue({ session: { id: "session-admin", userId: user.id }, user });
  mocks.list.mockResolvedValue([companyA]);
  mocks.directory.mockResolvedValue([companyA, companyB]);
  mocks.searchAdminUsers.mockResolvedValue([user]);
  mocks.getUserCompanyAccess.mockResolvedValue({ user, companyAccess: [membershipA] });
  mocks.setUserCompanyAccess.mockResolvedValue({});
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

describe("InstanceAccess company directory", () => {
  it("lets admins grant access outside their navigation list and refreshes their own navigation", async () => {
    await renderPage();
    await eventually(() => {
      expect(button("Save organization access")).toBeDefined();
      expect(container.querySelector("nav")?.textContent).toBe("Company A");
    });
    const otherCompany = [...container.querySelectorAll("label")].find((label) => label.textContent?.includes("Company B"));
    const checkbox = otherCompany?.querySelector<HTMLButtonElement>('[role="checkbox"]');
    expect(checkbox?.getAttribute("aria-checked")).toBe("false");
    mocks.setUserCompanyAccess.mockImplementation(async () => {
      mocks.list.mockResolvedValue([companyA, companyB]);
      mocks.getUserCompanyAccess.mockResolvedValue({ user, companyAccess: [membershipA, {
        ...membershipA, id: "membership-b", companyId: companyB.id, companyName: companyB.name,
      }] });
      return {};
    });
    await act(async () => checkbox!.click());
    await act(async () => button("Save organization access")!.click());
    await eventually(() => {
      expect(mocks.setUserCompanyAccess).toHaveBeenCalledWith(user.id, [companyA.id, companyB.id]);
      expect(container.querySelector("nav")?.textContent).toBe("Company A, Company B");
    });
  });

  it("prevents editing an incomplete directory and lets the admin retry", async () => {
    mocks.directory.mockRejectedValue(new Error("Unavailable"));
    await renderPage();
    await eventually(() => {
      expect(container.textContent).toContain("Failed to load organizations.");
      expect(container.querySelector("nav")?.textContent).toBe("Company A");
    });
    expect(button("Save organization access")).toBeUndefined();
    expect(mocks.setUserCompanyAccess).not.toHaveBeenCalled();
    mocks.directory.mockResolvedValue([companyA, companyB]);
    await act(async () => button("Try again")!.click());
    await eventually(() => expect(button("Save organization access")).toBeDefined());
  });

  it("does not request the directory when instance administration is forbidden", async () => {
    mocks.searchAdminUsers.mockRejectedValue(new ApiError("Forbidden", 403, {}));
    await renderPage();
    await eventually(() => expect(container.textContent).toContain("Instance admin access is required"));
    expect(mocks.directory).not.toHaveBeenCalled();
  });

  it("retranslates page chrome, enum labels, and dates live instead of a frozen snapshot", async () => {
    mocks.getUserCompanyAccess.mockResolvedValue({
      user,
      companyAccess: [membershipA, membershipUnknown, membershipUnset],
    });
    await renderPage();
    const enDate = new Date(membershipA.updatedAt).toLocaleDateString("en");
    await eventually(() => {
      expect(container.textContent).toContain("Instance Access");
      expect(container.textContent).toContain("Search users");
      expect(container.textContent).toContain("Organization access");
      expect(container.textContent).toContain("Current memberships");
      expect(container.textContent).toContain("1 active organization membership");
      expect(container.textContent).toContain("owner");
      expect(container.textContent).toContain("active");
      expect(container.textContent).toContain("unset");
      expect(container.textContent).toContain("custom-role");
      expect(container.textContent).toContain("mystery");
      expect(container.textContent).toContain(enDate);
      expect(container.textContent).toContain("Admin");
      expect(container.textContent).toContain("admin@example.com");
      expect(container.textContent).toContain("Company A");
      expect(container.textContent).toContain("CPA");
      expect(container.textContent).not.toContain("实例访问权限");
    });
    expect(mocks.setBreadcrumbs).toHaveBeenCalledWith([
      { label: "Settings", href: "/company/settings" },
      { label: "Instance settings", href: "/company/settings/instance/general" },
      { label: "Access" },
    ]);

    await act(async () => {
      await i18n.changeLanguage("zh-CN");
    });
    const zhDate = new Date(membershipA.updatedAt).toLocaleDateString("zh-CN");
    await eventually(() => {
      expect(container.textContent).toContain("实例访问权限");
      expect(container.textContent).toContain("搜索用户");
      expect(container.textContent).toContain("公司访问权限");
      expect(container.textContent).toContain("当前成员关系");
      expect(container.textContent).toContain("1 个活跃公司成员关系");
      expect(container.textContent).toContain("所有者");
      expect(container.textContent).toContain("活跃");
      expect(container.textContent).toContain("未设置");
      expect(container.textContent).toContain("custom-role");
      expect(container.textContent).toContain("mystery");
      expect(container.textContent).toContain(zhDate);
      expect(container.textContent).toContain("Admin");
      expect(container.textContent).toContain("admin@example.com");
      expect(container.textContent).toContain("Company A");
      expect(container.textContent).toContain("CPA");
      expect(container.textContent).not.toContain("Instance Access");
      expect(container.textContent).not.toContain("Search users");
      expect(container.textContent).not.toContain("Organization access");
      expect(container.textContent).not.toContain("Current memberships");
    });
    expect(zhDate).not.toBe(enDate);
    expect(mocks.setBreadcrumbs).toHaveBeenCalledWith([
      { label: "设置", href: "/company/settings" },
      { label: "实例设置", href: "/company/settings/instance/general" },
      { label: "访问权限" },
    ]);
  });
});
