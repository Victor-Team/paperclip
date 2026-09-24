// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { ReviewQueueCard } from "./ReviewQueueCard";

const listActionRequestsMock = vi.hoisted(() => vi.fn());
const approveActionRequestMock = vi.hoisted(() => vi.fn());
const createTrustRuleFromActionRequestMock = vi.hoisted(() => vi.fn());
const pushToastMock = vi.hoisted(() => vi.fn());

vi.mock("@/api/tools", () => ({
  toolsApi: {
    listActionRequests: (companyId: string, status: string) => listActionRequestsMock(companyId, status),
    approveActionRequest: (companyId: string, actionRequestId: string, rememberAction?: boolean) =>
      approveActionRequestMock(companyId, actionRequestId, rememberAction),
    createTrustRuleFromActionRequest: (companyId: string, actionRequestId: string, input: unknown) =>
      createTrustRuleFromActionRequestMock(companyId, actionRequestId, input),
  },
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
    selectedCompany: { id: "company-1", name: "Paperclip" },
  }),
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({ pushToast: pushToastMock }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

function pendingRequest() {
  return {
    request: {
      id: "request-1",
      companyId: "company-1",
      invocationId: "invocation-1",
      issueId: "issue-1",
      interactionId: null,
      approvalId: null,
      status: "pending",
      canonicalArgumentsHash: "hash-1",
      canonicalArgumentsSummary: {},
      signedArguments: "signed",
      previewMarkdown: null,
      requestedByAgentId: "agent-1",
      requestedByUserId: null,
      resolvedByAgentId: null,
      resolvedByUserId: null,
      decidedByAgentId: null,
      decidedByUserId: null,
      decidedAt: null,
      expiresAt: null,
      resolvedAt: null,
      createdAt: new Date("2026-06-16T12:00:00Z"),
      updatedAt: new Date("2026-06-16T12:00:00Z"),
    },
    toolName: "send_email",
    toolTitle: "Send email",
    connectionId: "connection-1",
    connectionName: "Mail",
    applicationName: "Mail",
    riskLevel: "write",
    requestedByAgentId: "agent-1",
  };
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function buttonContaining(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll("button")).find(
    (button) => button.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
}

describe("ReviewQueueCard", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    container = document.createElement("div");
    document.body.appendChild(container);
    listActionRequestsMock.mockResolvedValue({ actionRequests: [pendingRequest()] });
    approveActionRequestMock.mockResolvedValue({ ...pendingRequest().request, status: "approved" });
    createTrustRuleFromActionRequestMock.mockResolvedValue({ id: "policy-1" });
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  async function render() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <ReviewQueueCard emptyState="reassure" />
        </QueryClientProvider>,
      );
    });
    await flushReact();
  }

  it("submits approval and remembered permission as one atomic decision", async () => {
    const calls: string[] = [];
    approveActionRequestMock.mockImplementation(async () => {
      calls.push("approve");
      return { ...pendingRequest().request, status: "approved" };
    });
    createTrustRuleFromActionRequestMock.mockImplementation(async () => {
      calls.push("trust-rule");
      return { id: "policy-1" };
    });
    await render();

    await act(async () => {
      buttonContaining("Always allow")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    await flushReact();

    expect(calls).toEqual(["approve"]);
    expect(approveActionRequestMock).toHaveBeenCalledWith("company-1", "request-1", true);
    expect(createTrustRuleFromActionRequestMock).not.toHaveBeenCalled();
    expect(pushToastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Always allowed" }));
  });

  it("renders approval controls and policy guidance in Simplified Chinese", async () => {
    await i18n.changeLanguage("zh-CN");

    await render();

    expect(container.textContent).toContain("等待您的确认");
    expect(container.textContent).toContain("有智能体想要运行此操作。您的连接策略要求先获得批准。");
    expect(container.textContent).toContain("始终允许会让此智能体在此连接上使用不同参数运行此操作");
    expect(buttonContaining("允许一次")).toBeDefined();
    expect(buttonContaining("始终允许")).toBeDefined();
    expect(buttonContaining("拒绝")).toBeDefined();
  });
});
